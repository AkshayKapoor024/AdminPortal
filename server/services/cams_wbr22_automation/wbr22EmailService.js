/**
 * WBR22 CAMS email retrieval service.
 *
 * Retrieves WBR22 "AuM on a specific date" emails received in the last 24 hours.
 * Filters by:
 *   1. Subject matching WBR22 title: "WBR22. AuM on a specific date by Scheme by Investor, "
 *   2. Must contain a valid download URL (emails without downloadUrl are filtered out)
 *
 * Note: Recipient (toEmail) filtering is OFF by default (ENFORCE_TARGET_RECIPIENT).
 * WBR22 AUM emails are forwarded from multiple accounts (rajendrashirode@gmail.com,
 * kusumdwani@gmail.com, sanjayshirode93@gmail.com, etc.) to admin@dkwealth.co.in via
 * Gmail forwarding. The parsed To: header shows the *original* recipient, not the
 * forwarded-to address — so a strict toEmail check filters out valid emails.
 * The subject regex + downloadUrl check is sufficient to uniquely identify WBR22 AUM emails.
 *
 * Note: Report request number filtering logic is kept in comments for easy re-enabling
 * if specific report request numbers need to be enforced again in the future.
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
    extractArn,
} = require("../../utils/cams_wbr22_automation/camsEmailParsingUtils");

const WBR22_SUBJECT_REGEX = /WBR22\.\s*AuM\s+on\s+a\s+specific\s+date\s+by\s+Scheme\s+by\s+Investor/i;
const TARGET_RECIPIENT_EMAIL = "rajendrashirode@gmail.com";

// The parsed To: header carries the ORIGINAL recipient of each forwarded
// email, and real WBR22 reports arrive addressed to several different
// family accounts (rajendrashirode@, kusumdwani@, sanjayshirode93@ ...).
// Turning this on would silently drop every report not addressed to
// TARGET_RECIPIENT_EMAIL, so it stays off unless that is really intended.
const ENFORCE_TARGET_RECIPIENT = false;

// Kept for reference / future use if specific report request numbers are fixed
const APPROVED_WBR22_REPORT_REQUEST_NUMBERS = new Set([
    "223330489R22",
    "223330413R22",
    "223330478R22",
    "223330420R22",
]);

/** Convert one MIME email into the metadata shared by CAMS report services. */
function parseWbr22Email(parsed, rawSource = "") {
    const text = parsed.text || "";
    const subject = parsed.subject || "";
    const emailDate = parsed.date ? new Date(parsed.date) : null;
    const dateRange = extractReportDateRange(text);
    const dispatchDate = parseCamsDateTime(extractDispatchDateTime(text));
    const arnNo = extractArn(text, subject, rawSource);

    const reqNo = extractRequestNumber(text, subject);
    const reportReqNo = extractReportRequestNumber(text) || reqNo || (parsed.messageId ? parsed.messageId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) : null) || Date.now().toString();

    return {
        messageId: parsed.messageId || null,
        emailDate: emailDate ? emailDate.toISOString() : null,
        emailDateReadable: formatReadableDate(emailDate),
        fromEmail: parsed.from?.value?.[0]?.address || null,
        toEmail: parsed.to?.value?.[0]?.address || null,
        toEmailList: parsed.to?.value ? parsed.to.value.map(v => v.address?.toLowerCase()).filter(Boolean) : [],
        subject,
        arnNo,
        requestNumber: reqNo,
        reportRequestNumber: reportReqNo,
        reportNumber: extractReportNumber(text),
        downloadUrl: extractDownloadUrl({ rawSource, html: parsed.html || "", text }),
        reportFromDate: dateRange.from,
        reportToDate: dateRange.to,
        dispatchDateTime: dispatchDate ? dispatchDate.toISOString() : null,
        dispatchDateTimeReadable: formatReadableDate(dispatchDate),
    };
}

/**
 * Fetch recent WBR22 emails, subject-filter first, recipient-filter next,
 * and verify presence of download URL before returning.
 *
 * @param {object} [options]
 * @param {number} [options.lookbackDays=14] Number of days back to search IMAP.
 */
async function retrieveWbr22Emails({ lookbackDays = 14 } = {}) {
    const client = createImapClient();
    const reports = [];

    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");

        try {
            const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
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

                const parsedEmail = await simpleParser(message.source);
                const report = parseWbr22Email(parsedEmail, message.source);

                // 1. Download URL check: emails without a download URL are filtered out
                if (!report.downloadUrl) {
                    console.log(`[WBR22EmailService] Skipping email "${report.subject}" — missing download URL.`);
                    continue;
                }

                // 1b. Optional recipient check (OFF by default — see ENFORCE_TARGET_RECIPIENT).
                if (ENFORCE_TARGET_RECIPIENT && !report.toEmailList.includes(TARGET_RECIPIENT_EMAIL)) {
                    console.log(`[WBR22EmailService] Skipping email "${report.subject}" — not addressed to ${TARGET_RECIPIENT_EMAIL}.`);
                    continue;
                }

                reports.push(report);
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
    TARGET_RECIPIENT_EMAIL,
    APPROVED_WBR22_REPORT_REQUEST_NUMBERS,
};
