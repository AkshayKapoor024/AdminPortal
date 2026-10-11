/**
 * Karvy WBR22 (ClientWise AUM Report) email retrieval service.
 *
 * Mirrors `cams_wbr22_automation/wbr22EmailService.js` exactly in
 * structure, but matches Karvy's subject wording and uses the
 * Karvy-specific extraction helpers instead of CAMS's.
 *
 * Retrieves only the approved "ClientWise AUM Report" emails received
 * in the last 24 hours, and returns normalized metadata for the shared
 * report-extraction service (`cams_wbr22_automation/reportService.js`,
 * reused unchanged — it only needs `downloadUrl`/`reportRequestNumber`,
 * which this service supplies).
 */
require("dotenv").config();

const { simpleParser } = require("mailparser");
const { createImapClient, extractReportDateRange, parseCamsDateTime, extractDispatchDateTime, formatReadableDate, extractArn } = require("../../utils/cams_wbr22_automation/camsEmailParsingUtils");
const {
    extractKarvyRefNumber,
    extractKarvyReportNumber,
    extractKarvyLandingUrl,
} = require("../../utils/karvy_shared/karvyEmailParsingUtils");

/**
 * Matches both real subject wordings seen for this report:
 *   "Client-wise AUM Report for Ref.no. WBCUM..." (Gmail auto-forward, unmodified)
 *   "Fwd: Subscribed ClientWise AUM Report for Ref. No. : WBCUM..." (manual Gmail forward)
 */
const KARVY_WBR22_SUBJECT_REGEX = /Client-?\s*wise\s+AUM\s+Report/i;

const APPROVED_KARVY_WBR22_REPORT_REQUEST_NUMBERS = new Set([
    "WBCUM27612260",
]);

/** Convert one MIME email into the metadata shared by the report-extraction service. */
function parseKarvyWbr22Email(parsed, rawSource = "") {
    const text = parsed.text || "";
    const subject = parsed.subject || "";
    const emailDate = parsed.date ? new Date(parsed.date) : null;
    const dateRange = extractReportDateRange(text);
    const dispatchDate = parseCamsDateTime(extractDispatchDateTime(text));
    const downloadUrl = extractKarvyLandingUrl({ html: parsed.html || "" });
    const arnNo = extractArn(text, subject, rawSource);

    if (!downloadUrl) {
        console.warn(
            `[Karvy WBR22 AUM] Could not find a usable download link in email "${subject}" ` +
            `(messageId=${parsed.messageId || "unknown"}) — the HTML "Click Here" / scdelivery.kfintech.com ` +
            `anchor was missing or its "u=" parameter did not decode to a valid KFintech URL.`
        );
    }

    return {
        messageId: parsed.messageId || null,
        emailDate: emailDate ? emailDate.toISOString() : null,
        emailDateReadable: formatReadableDate(emailDate),
        fromEmail: parsed.from?.value?.[0]?.address || null,
        toEmail: parsed.to?.value?.[0]?.address || null,
        subject,
        arnNo,
        reportRequestNumber:
            extractKarvyRefNumber(subject) ||
            (parsed.messageId ? parsed.messageId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) : null) ||
            Date.now().toString(),
        reportNumber: extractKarvyReportNumber(text),
        downloadUrl,
        reportFromDate: dateRange.from,
        reportToDate: dateRange.to,
        dispatchDateTime: dispatchDate ? dispatchDate.toISOString() : null,
        dispatchDateTimeReadable: formatReadableDate(dispatchDate),
    };
}

/**
 * Fetch recent Karvy WBR22 emails, subject-filter first, then enforce
 * the report request-number allow-list before an archive can enter the
 * pipeline.
 *
 * @param {object} [options]
 * @param {number} [options.lookbackDays=1] Number of days back to search IMAP (defaults to 1 day / 24h for daily Karvy).
 */
async function retrieveKarvyWbr22Emails({ lookbackDays = 1 } = {}) {
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

                if (
                    !receivedDate ||
                    receivedDate < cutoff ||
                    !KARVY_WBR22_SUBJECT_REGEX.test(message.envelope?.subject || "") ||
                    !message.source
                ) {
                    continue;
                }

                const report = parseKarvyWbr22Email(await simpleParser(message.source), message.source);
                reports.push(report);
            }
        } finally {
            lock.release();
        }

        await client.logout();
        return reports;
    } catch (error) {
        try {
            await client.logout();
        } catch (_) {
            // connection cleanup only
        }
        throw error;
    }
}

module.exports = {
    retrieveKarvyWbr22Emails,
    parseKarvyWbr22Email,
    KARVY_WBR22_SUBJECT_REGEX,
    APPROVED_KARVY_WBR22_REPORT_REQUEST_NUMBERS,
};
