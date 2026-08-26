/**
 * Database-report helpers. They centralize status payload construction and
 * idempotency lookup without owning any Prisma transaction or write.
 */
const { reportFingerprint, validDate } = require("./camsPersistence");

function buildReportData(report, status, error, count = 0) {
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

async function findExistingCamsReport(tx, data) {
    if (data.messageId) {
        const byMessageId = await tx.camsReport.findUnique({ where: { messageId: data.messageId } });
        if (byMessageId) return byMessageId;
    }
    return tx.camsReport.findUnique({ where: { identifierFingerprint: data.identifierFingerprint } });
}

module.exports = { buildReportData, findExistingCamsReport };
