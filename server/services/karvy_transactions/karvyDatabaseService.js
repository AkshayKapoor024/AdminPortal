/**
 * Karvy transactions database persistence service.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * Mirrors `cams_transactions/camsDatabaseService.js` exactly — same
 * idempotency strategy (skip an already-STORED report with a matching
 * transaction count; otherwise atomically rebuild it), same
 * STORED/SKIPPED/FAILED outcome contract — but writes to the separate
 * `KarvyTransactionReport`/`KarvyTransaction` tables using the
 * Karvy-specific field mapping and fingerprinting helpers.
 */
const { prisma } = require("../../init/prisma");
const { transactionData, transactionFingerprint } = require("../../utils/karvy_transactions/karvyTransactionPersistence");
const { buildReportData, findExistingKarvyReport } = require("../../utils/karvy_transactions/karvyReportPersistence");

/**
 * Persist a single parsed Karvy report (and its transactions, if any)
 * to the database.
 *
 * @param {object} report a report object produced by the CSV parsing step
 * @returns {Promise<object>} the saved database row, plus an `outcome`
 *                            field: "STORED", "SKIPPED", or "FAILED"
 */
async function persistKarvyTransactionReport(report) {
    // Step 1: de-duplicate transaction rows within this single report.
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
        ? (report?.error || (isEmptyParsedReport ? "Karvy CSV contains no transaction records" : "Karvy report was not parsed successfully"))
        : null;

    // Step 3: build the row that will be written to the
    // `karvy_transaction_reports` table.
    const data = buildReportData(report || {}, targetStatus, error, records.length);

    // Step 4: everything below happens inside one Prisma transaction, so
    // the report row and its transaction rows are always updated
    // together — never one without the other.
    return prisma.$transaction(async (tx) => {
        const existing = await findExistingKarvyReport(tx, data);

        // Normal cron retries skip an already stored report. A count
        // mismatch signals an earlier incomplete/incorrect parse, so
        // rebuild that one report atomically instead of preserving
        // partial transaction data.
        if (existing?.status === "STORED" && existing.transactionCount === records.length) {
            return { ...existing, outcome: "SKIPPED" };
        }

        // This report did not parse successfully (or has no
        // transactions): just update/create the report row, no
        // transactions.
        if (targetStatus !== "STORED") {
            const completed = existing
                ? await tx.karvyTransactionReport.update({ where: { id: existing.id }, data: { ...data, processingAttempts: { increment: 1 } } })
                : await tx.karvyTransactionReport.create({ data });
            return { ...completed, outcome: targetStatus };
        }

        // This report parsed successfully: create/update the report
        // row, then replace its transactions entirely with the freshly
        // parsed set (delete old rows, insert the new ones).
        const reportRow = existing
            ? await tx.karvyTransactionReport.update({ where: { id: existing.id }, data: { ...data, processingAttempts: { increment: 1 } } })
            : await tx.karvyTransactionReport.create({ data });

        await tx.karvyTransaction.deleteMany({ where: { reportId: reportRow.id } });
        await tx.karvyTransaction.createMany({
            data: records.map((record) => ({ reportId: reportRow.id, fingerprint: transactionFingerprint(record), ...transactionData(record) })),
            skipDuplicates: true,
        });
        return { ...reportRow, outcome: "STORED" };
    });
}

/**
 * Persist a batch of parsed Karvy reports, one at a time.
 *
 * @param {Array<object>} reports
 * @returns {Promise<Array<object>>} one persistence result per input report
 */
async function persistKarvyTransactionReports(reports) {
    if (!Array.isArray(reports)) throw new TypeError("Karvy reports must be an array");
    const results = [];
    for (const report of reports) results.push(await persistKarvyTransactionReport(report));
    return results;
}

module.exports = { persistKarvyTransactionReport, persistKarvyTransactionReports };
