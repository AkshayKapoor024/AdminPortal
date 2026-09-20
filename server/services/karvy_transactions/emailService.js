/**
 * Karvy Transaction Feeds Report email retrieval service.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * Mirrors `cams_transactions/emailService.js` exactly in structure —
 * connect to Gmail, look at the last 24 hours, keep only the approved
 * report emails, normalize each into a report object. Only the subject
 * pattern, ref-number extraction, and approved-number allow-list differ
 * (Karvy's, not CAMS's).
 *
 * STATUS: validated end to end. The download URL is now extracted from
 * the email's HTML "Click Here" link (see
 * `utils/karvy_shared/karvyEmailParsingUtils.js` for why this matters —
 * the plain-text copy of this same link is broken for this report
 * type). Manually following a URL produced this way was confirmed to
 * download a real, working ZIP.
 */
require("dotenv").config();

const { simpleParser } = require("mailparser");
const {
    createImapClient,
    extractReportDateRange,
    parseCamsDateTime,
    extractDispatchDateTime,
    formatReadableDate,
} = require("../../utils/cams_wbr22_automation/camsEmailParsingUtils");
const {
    extractKarvyRefNumber,
    extractKarvyReportNumber,
    extractKarvyLandingUrl,
} = require("../../utils/karvy_shared/karvyEmailParsingUtils");

/** Matches "Subscribed Transaction Feeds Report for Ref. No. : ..." — deliberately requires "Feeds" so the shorter, unrelated "Transaction Report" subject is not matched. */
const KARVY_TRANSACTIONS_SUBJECT_REGEX = /Transaction\s+Feeds\s+Report/i;

const APPROVED_KARVY_TRANSACTION_REPORT_REQUEST_NUMBERS = new Set([
    "WBTRN20122305",
    "WBTRN26897094",
    "WBTRN20343586",
    "WBTRN29617236",
]);

/** Convert one MIME email into a normalized report object. */
function parseKarvyTransactionEmail(parsed) {
    const text = parsed.text || "";
    const subject = parsed.subject || "";
    const emailDate = parsed.date ? new Date(parsed.date) : null;
    const dateRange = extractReportDateRange(text);
    const dispatchDate = parseCamsDateTime(extractDispatchDateTime(text));
    const downloadUrl = extractKarvyLandingUrl({ html: parsed.html || "" });

    if (!downloadUrl) {
        console.warn(
            `[Karvy Transactions] Could not find a usable download link in email "${subject}" ` +
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
        reportRequestNumber: extractKarvyRefNumber(subject),
        reportNumber: extractKarvyReportNumber(text),
        downloadUrl,
        reportFromDate: dateRange.from,
        reportToDate: dateRange.to,
        dispatchDateTime: dispatchDate ? dispatchDate.toISOString() : null,
        dispatchDateTimeReadable: formatReadableDate(dispatchDate),
    };
}

/**
 * Fetch recent Karvy Transaction Feeds Report emails, subject-filtered
 * then allow-list-filtered, exactly like the CAMS transactions service.
 */
async function retrieveKarvyTransactionEmails() {
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
                    !KARVY_TRANSACTIONS_SUBJECT_REGEX.test(message.envelope?.subject || "") ||
                    !message.source
                ) {
                    continue;
                }

                const report = parseKarvyTransactionEmail(await simpleParser(message.source));

                if (APPROVED_KARVY_TRANSACTION_REPORT_REQUEST_NUMBERS.has(report.reportRequestNumber)) {
                    reports.push(report);
                }
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
    retrieveKarvyTransactionEmails,
    parseKarvyTransactionEmail,
    KARVY_TRANSACTIONS_SUBJECT_REGEX,
    APPROVED_KARVY_TRANSACTION_REPORT_REQUEST_NUMBERS,
};
