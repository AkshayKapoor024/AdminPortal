/**
 * CAMS database persistence service.
 *
 * Requirements: use report UUIDs as the transaction foreign key, retain CAMS
 * identifiers for idempotency/auditing, atomically store each complete report,
 * and return explicit STORED, SKIPPED, or FAILED outcomes. No raw JSON is stored.
 */
const { prisma } = require("../init/prisma");
const { reportFingerprint, transactionData, transactionFingerprint, validDate } = require("../utils/camsPersistence");

function reportData(report, status, error, count = 0) {
    const identifiers = report.identifiers || {};
    return {
        messageId: identifiers.messageId || null,
        identifierFingerprint: reportFingerprint(identifiers),
        reportRequestNumber: identifiers.reportRequestNumber || null,
        reportNumber: identifiers.reportNumber || null,
        dispatchDateTime: validDate(identifiers.dispatchDateTime),
        toEmail: identifiers.toEmail || null,
        status,
        error: error || null,
        transactionCount: count,
        parsedAt: status === "PARSED" || status === "STORED" ? new Date() : null,
        storedAt: status === "STORED" ? new Date() : null,
    };
}

async function findExistingReport(tx, data) {
    if (data.messageId) {
        const byMessageId = await tx.camsReport.findUnique({ where: { messageId: data.messageId } });
        if (byMessageId) return byMessageId;
    }
    return tx.camsReport.findUnique({ where: { identifierFingerprint: data.identifierFingerprint } });
}

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
    const data = reportData(report || {}, targetStatus, error, records.length);

    return prisma.$transaction(async (tx) => {
        const existing = await findExistingReport(tx, data);
        if (existing?.status === "STORED") return { ...existing, outcome: "SKIPPED" };

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
