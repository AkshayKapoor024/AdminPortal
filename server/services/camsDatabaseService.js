/**
 * CAMS database persistence service.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * This is the last step of the CAMS pipeline. It takes a parsed report
 * (report info + an array of transaction rows) and safely saves it into
 * PostgreSQL through Prisma. "Safely" here means:
 *   - if we already stored this exact report with the same number of
 *     transactions before, we skip it instead of duplicating data
 *     (idempotency — running the cron job twice must not double-count
 *     transactions);
 *   - if a report previously failed or was only partially stored, we
 *     rebuild it from scratch inside one atomic database transaction so
 *     the report and its transactions can never end up out of sync.
 *
 * Requirements: use report UUIDs as the transaction foreign key, retain CAMS
 * identifiers for idempotency/auditing, atomically store each complete report,
 * and return explicit STORED, SKIPPED, or FAILED outcomes. No raw JSON is stored.
 */
const { prisma } = require("../init/prisma");
const { transactionData, transactionFingerprint } = require("../utils/camsPersistence");
const { buildReportData, findExistingCamsReport } = require("../utils/camsReportPersistence");

/**
 * Persist a single parsed CAMS report (and its transactions, if any) to
 * the database.
 *
 * @param {object} report a report object produced by the CSV parsing step
 * @returns {Promise<object>} the saved database row, plus an `outcome`
 *                            field: "STORED", "SKIPPED", or "FAILED"
 */
async function persistCamsReport(report) {
    // Step 1: de-duplicate transaction rows within this single report.
    // Each row gets a fingerprint (a hash of its field values); if the
    // same fingerprint appears twice, only the first copy is kept.
    const suppliedRecords = Array.isArray(report?.records) ? report.records : [];
    const fingerprints = new Set();
    const records = suppliedRecords.filter((record) => {
        const fingerprint = transactionFingerprint(record);
        if (fingerprints.has(fingerprint)) return false;
        fingerprints.add(fingerprint);
        return true;
    });

    // Step 2: decide what final status this report should be saved with.
    const parsed = report?.status === "PARSED";
    const isEmptyParsedReport = parsed && records.length === 0;
    const targetStatus = parsed && !isEmptyParsedReport
        ? "STORED"
        : report?.status === "SKIPPED" ? "SKIPPED" : "FAILED";
    const error = targetStatus !== "STORED"
        ? (report?.error || (isEmptyParsedReport ? "CAMS CSV contains no transaction records" : "CAMS report was not parsed successfully"))
        : null;

    // Step 3: build the row that will be written to the `camsReport` table.
    const data = buildReportData(report || {}, targetStatus, error, records.length);

    // Step 4: everything below happens inside one Prisma transaction, so
    // the report row and its transaction rows are always updated together
    // — never one without the other.
    return prisma.$transaction(async (tx) => {
        const existing = await findExistingCamsReport(tx, data);

        // Normal cron retries skip an already stored report. A count mismatch
        // signals an earlier incomplete/incorrect parse, so rebuild that one
        // report atomically instead of preserving partial transaction data.
        if (existing?.status === "STORED" && existing.transactionCount === records.length) {
            return { ...existing, outcome: "SKIPPED" };
        }

        // This report did not parse successfully (or has no transactions):
        // just update/create the report row itself, with no transactions.
        if (targetStatus !== "STORED") {
            const completed = existing
                ? await tx.camsReport.update({ where: { id: existing.id }, data: { ...data, processingAttempts: { increment: 1 } } })
                : await tx.camsReport.create({ data });
            return { ...completed, outcome: targetStatus };
        }

        // This report parsed successfully: create/update the report row,
        // then replace its transactions entirely with the freshly parsed
        // set (delete old rows, insert the new ones).
        const reportRow = existing
            ? await tx.camsReport.update({ where: { id: existing.id }, data: { ...data, processingAttempts: { increment: 1 } } })
            : await tx.camsReport.create({ data });

        await tx.camsTransaction.deleteMany({ where: { reportId: reportRow.id } });
        await tx.camsTransaction.createMany({
            data: records.map((record) => ({ reportId: reportRow.id, fingerprint: transactionFingerprint(record), ...transactionData(record) })),
            skipDuplicates: true,
        });
        return { ...reportRow, outcome: "STORED" };
    });
}

/**
 * Persist a batch of parsed CAMS reports, one at a time.
 *
 * @param {Array<object>} reports
 * @returns {Promise<Array<object>>} one persistence result per input report
 */
async function persistCamsReports(reports) {
    if (!Array.isArray(reports)) throw new TypeError("CAMS reports must be an array");
    const results = [];
    for (const report of reports) results.push(await persistCamsReport(report));
    return results;
}

module.exports = { persistCamsReport, persistCamsReports };
