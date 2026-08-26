/**
 * CAMS database persistence service.
 *
 * Requirements: use report UUIDs as the transaction foreign key, retain CAMS
 * identifiers for idempotency/auditing, atomically store each complete report,
 * and return explicit STORED, SKIPPED, or FAILED outcomes. No raw JSON is stored.
 */
const { prisma } = require("../init/prisma");
const { transactionData, transactionFingerprint } = require("../utils/camsPersistence");
const { buildReportData, findExistingCamsReport } = require("../utils/camsReportPersistence");

async function persistCamsReport(report) {
    const suppliedRecords = Array.isArray(report?.records) ? report.records : [];
    const fingerprints = new Set();
    const records = suppliedRecords.filter((record) => {
        const fingerprint = transactionFingerprint(record);
        if (fingerprints.has(fingerprint)) return false;
        fingerprints.add(fingerprint);
        return true;
    });
    const parsed = report?.status === "PARSED";
    const isEmptyParsedReport = parsed && records.length === 0;
    const targetStatus = parsed && !isEmptyParsedReport
        ? "STORED"
        : report?.status === "SKIPPED" ? "SKIPPED" : "FAILED";
    const error = targetStatus !== "STORED"
        ? (report?.error || (isEmptyParsedReport ? "CAMS CSV contains no transaction records" : "CAMS report was not parsed successfully"))
        : null;
    const data = buildReportData(report || {}, targetStatus, error, records.length);

    return prisma.$transaction(async (tx) => {
        const existing = await findExistingCamsReport(tx, data);
        // Normal cron retries skip an already stored report. A count mismatch
        // signals an earlier incomplete/incorrect parse, so rebuild that one
        // report atomically instead of preserving partial transaction data.
        if (existing?.status === "STORED" && existing.transactionCount === records.length) {
            return { ...existing, outcome: "SKIPPED" };
        }

        if (targetStatus !== "STORED") {
            const completed = existing
                ? await tx.camsReport.update({ where: { id: existing.id }, data: { ...data, processingAttempts: { increment: 1 } } })
                : await tx.camsReport.create({ data });
            return { ...completed, outcome: targetStatus };
        }

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

async function persistCamsReports(reports) {
    if (!Array.isArray(reports)) throw new TypeError("CAMS reports must be an array");
    const results = [];
    for (const report of reports) results.push(await persistCamsReport(report));
    return results;
}

module.exports = { persistCamsReport, persistCamsReports };
