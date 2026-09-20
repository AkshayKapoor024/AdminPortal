/**
 * Karvy database-report helpers. Mirrors `cams_transactions/camsReportPersistence.js`
 * exactly, targeting `karvyTransactionReport` instead of `camsReport`.
 * They centralize status payload construction and idempotency lookup
 * without owning any Prisma transaction or write.
 */
const { reportFingerprint, validDate } = require("./karvyTransactionPersistence");

/**
 * Build the exact row data to write to the `karvy_transaction_reports`
 * table for a given report and target status.
 *
 * @param {object} report the report object flowing through the pipeline
 * @param {string} status  "STORED" | "FAILED" | "SKIPPED"
 * @param {string|null} error an error message, if the report was not stored
 * @param {number} count  how many transactions this report contains
 * @returns {object} a Prisma-ready `karvyTransactionReport` row
 */
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

/**
 * Look up whether this report already exists in the database, first by
 * its email `messageId` and then by its identifier fingerprint. Returns
 * `null` if this report has never been seen before.
 *
 * @param {object} tx   an active Prisma transaction client
 * @param {object} data the row data built by `buildReportData`
 * @returns {Promise<object|null>}
 */
async function findExistingKarvyReport(tx, data) {
    if (data.messageId) {
        const byMessageId = await tx.karvyTransactionReport.findUnique({ where: { messageId: data.messageId } });
        if (byMessageId) return byMessageId;
    }
    return tx.karvyTransactionReport.findUnique({ where: { identifierFingerprint: data.identifierFingerprint } });
}

module.exports = { buildReportData, findExistingKarvyReport };
