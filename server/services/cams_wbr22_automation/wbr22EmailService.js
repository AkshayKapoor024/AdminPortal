/**
 * WBR22 CAMS email retrieval service.
 *
 * Retrieves only the four approved WBR22 "AuM on a specific date" emails
 * received in the last 24 hours. It returns normalized metadata for the
 * shared report-extraction service; it does not download files or write data.
 */
require("dotenv").config();

const { simpleParser } = require("mailparser");
const {
    createImapClient,
    extractDownloadUrl,
    extractRequestNumber,
    extractReportRequestNumber,
    extractReportNumber,
    extractReportDateRange,
    parseCamsDateTime,
    extractDispatchDateTime,
    formatReadableDate,
} = require("../../utils/cams_wbr22_automation/camsEmailParsingUtils");

const WBR22_SUBJECT_REGEX = /WBR22\.\s*AuM\s+on\s+a\s+specific\s+date\s+by\s+Scheme\s+by\s+Investor/i;
const APPROVED_WBR22_REPORT_REQUEST_NUMBERS = new Set([
    "223330489R22",
    "223330413R22",
    "223330478R22",
    "223330420R22",
]);

/** Convert one MIME email into the metadata shared by CAMS report services. */
function parseWbr22Email(parsed, rawSource) {
    const text = parsed.text || "";
    const subject = parsed.subject || "";
    const emailDate = parsed.date ? new Date(parsed.date) : null;
    const dateRange = extractReportDateRange(text);
    const dispatchDate = parseCamsDateTime(extractDispatchDateTime(text));

    return {
        messageId: parsed.messageId || null,
        emailDate: emailDate ? emailDate.toISOString() : null,
        emailDateReadable: formatReadableDate(emailDate),
        fromEmail: parsed.from?.value?.[0]?.address || null,
        toEmail: parsed.to?.value?.[0]?.address || null,
        subject,
        requestNumber: extractRequestNumber(text, subject),
        reportRequestNumber: extractReportRequestNumber(text),
        reportNumber: extractReportNumber(text),
        downloadUrl: extractDownloadUrl({ rawSource, html: parsed.html || "", text }),
        reportFromDate: dateRange.from,
        reportToDate: dateRange.to,
        dispatchDateTime: dispatchDate ? dispatchDate.toISOString() : null,
        dispatchDateTimeReadable: formatReadableDate(dispatchDate),
    };
}

/**
 * Fetch recent WBR22 emails, subject-filter first, then enforce the report
 * request-number allow-list before an archive can enter the pipeline.
 */
async function retrieveWbr22Emails() {
    const client = createImapClient();
    const reports = [];

    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");

        try {
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const imapSince = new Date(cutoff);
            imapSince.setHours(0, 0, 0, 0);

            for await (const message of client.fetch(
                { since: imapSince },
                { envelope: true, internalDate: true, source: true }
            )) {
                const receivedDate = message.internalDate ? new Date(message.internalDate) : null;
                if (!receivedDate || receivedDate < cutoff || !WBR22_SUBJECT_REGEX.test(message.envelope?.subject || "") || !message.source) {
                    continue;
                }

                const report = parseWbr22Email(await simpleParser(message.source), message.source);
                if (APPROVED_WBR22_REPORT_REQUEST_NUMBERS.has(report.reportRequestNumber)) {
                    reports.push(report);
                }
            }
        } finally {
            lock.release();
        }

        await client.logout();
        return reports;
    } catch (error) {
        try { await client.logout(); } catch (_) { /* connection cleanup only */ }
        throw error;
    }
}

module.exports = {
    retrieveWbr22Emails,
    parseWbr22Email,
    WBR22_SUBJECT_REGEX,
    APPROVED_WBR22_REPORT_REQUEST_NUMBERS,
};
