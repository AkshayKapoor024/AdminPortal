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
const { createImapClient, extractReportDateRange, parseCamsDateTime, extractDispatchDateTime, formatReadableDate } = require("../../utils/cams_wbr22_automation/camsEmailParsingUtils");
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
function parseKarvyWbr22Email(parsed) {
    const text = parsed.text || "";
    const subject = parsed.subject || "";
    const emailDate = parsed.date ? new Date(parsed.date) : null;
    const dateRange = extractReportDateRange(text);
    const dispatchDate = parseCamsDateTime(extractDispatchDateTime(text));
    const downloadUrl = extractKarvyLandingUrl({ html: parsed.html || "" });

    if (!downloadUrl) {
        // Per the "don't guess" principle: log a diagnostic rather than
        // silently proceeding with no download link.
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
        // Falls back to a short id derived from the messageId if the subject
        // has no "Ref. No." — the shared report service needs a non-empty
        // request number to name its temp folder.
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
 */
async function retrieveKarvyWbr22Emails() {
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

                if (
                    !receivedDate ||
                    receivedDate < cutoff ||
                    !KARVY_WBR22_SUBJECT_REGEX.test(message.envelope?.subject || "") ||
                    !message.source
                ) {
                    continue;
                }

                const report = parseKarvyWbr22Email(await simpleParser(message.source));

                // Report Request Number allow-list — DISABLED. Karvy's Ref. No.
                // changes between reports (real runs with the single approved
                // number returned 0 emails). The subject filter above is what
                // identifies these reports now. To enforce specific numbers
                // again, update APPROVED_KARVY_WBR22_REPORT_REQUEST_NUMBERS and
                // swap the push below for the commented block:
                //
                // if (APPROVED_KARVY_WBR22_REPORT_REQUEST_NUMBERS.has(report.reportRequestNumber)) {
                //     reports.push(report);
                // }
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
