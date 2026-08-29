/**
 * CAMS email retrieval service.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * Every day, CAMS (the mutual-fund registrar) emails our company's Gmail
 * inbox with a link to a password-protected ZIP file containing a
 * transactions report. This service logs into that Gmail inbox, looks at
 * everything received in the last 24 hours, keeps only the CAMS report
 * emails we care about, and turns each one into a clean, structured
 * JavaScript object (report identifiers + a download link).
 *
 * Requirements: authenticate to Gmail IMAP, select recent CAMS transaction
 * emails, preserve report identifiers, and safely extract a trusted ZIP URL.
 * Downloading, CSV parsing, persistence, scheduling, and logging stay outside
 * this service so each pipeline stage has one responsibility.
 *
 * All of the low-level text/regex parsing work lives in
 * `utils/camsEmailParsingUtils.js`. This file only contains the two "main"
 * functions that use those helpers: `parseCamsEmail` (turn one raw email
 * into a clean report object) and `retrieveCamsEmails` (the exported
 * function that runs the whole retrieval step end-to-end).
 */
require("dotenv").config();

const { simpleParser } = require("mailparser");
const fs = require("fs/promises");

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
    extractAllCamsZipUrls,
} = require("../utils/camsEmailParsingUtils");

// -----------------------------------------------------------------------------
// CAMS subject matcher
// -----------------------------------------------------------------------------

/** Only emails whose subject matches this pattern are treated as CAMS reports. */
const CAMS_SUBJECT_REGEX = /Investor\s+Transactions\s+for\s+a\s+Period/i;

/**
 * Only these approved CAMS report requests may enter the ingestion
 * pipeline. This acts as a business-level allow-list so that any
 * unexpected/unrecognised report request cannot silently start being
 * downloaded and stored.
 */
const APPROVED_REPORT_REQUEST_NUMBERS = new Set([
    "221744453R2",
    "221743797R2",
    "221744323R2",
    "221744277R2",
]);

// -----------------------------------------------------------------------------
// Normalize one parsed CAMS email
// -----------------------------------------------------------------------------

/**
 * Turn one parsed CAMS email into a clean, structured report object.
 *
 * This is the "main" per-email transformation step: it calls out to the
 * small extraction helpers in `camsEmailParsingUtils.js` for each
 * individual field, then assembles the final object that the rest of the
 * pipeline (report download → CSV parsing → database) works with.
 *
 * @param {object} parsed     the email as parsed by `mailparser`
 * @param {Buffer} rawSource  the original, unparsed MIME source of the email
 * @returns {object} a normalized CAMS report descriptor
 */
function parseCamsEmail(parsed, rawSource) {
    const text = parsed.text || "";
    const html = parsed.html || "";
    const subject = parsed.subject || "";

    const emailDate = parsed.date
        ? new Date(parsed.date)
        : null;

    const fromEmail =
        parsed.from?.value?.[0]?.address || null;

    const toEmail =
        parsed.to?.value?.[0]?.address || null;

    const requestNumber =
        extractRequestNumber(
            text,
            subject
        );

    const reportRequestNumber =
        extractReportRequestNumber(text);

    const reportNumber =
        extractReportNumber(text);

    const downloadUrl =
        extractDownloadUrl({
            rawSource,
            html,
            text,
        });

    const reportDateRange =
        extractReportDateRange(text);

    const dispatchRaw =
        extractDispatchDateTime(text);

    const dispatchDate =
        parseCamsDateTime(dispatchRaw);

    return {
        messageId:
            parsed.messageId || null,

        emailDate:
            emailDate
                ? emailDate.toISOString()
                : null,

        emailDateReadable:
            formatReadableDate(emailDate),

        fromEmail,

        toEmail,

        subject,

        requestNumber,

        reportRequestNumber,

        reportNumber,

        downloadUrl,

        reportFromDate:
            reportDateRange.from,

        reportToDate:
            reportDateRange.to,

        dispatchDateTime:
            dispatchDate
                ? dispatchDate.toISOString()
                : null,

        dispatchDateTimeReadable:
            formatReadableDate(dispatchDate),
    };
}

// -----------------------------------------------------------------------------
// Retrieve CAMS emails
// -----------------------------------------------------------------------------

/**
 * Connect to the company Gmail inbox, find CAMS report emails received in
 * the last 24 hours, and return them as an array of normalized report
 * objects (see `parseCamsEmail`).
 *
 * Step by step, this function:
 *   1. Opens a fresh IMAP connection and locks the INBOX folder.
 *   2. Scans messages received within the last 24 hours.
 *   3. Keeps only messages whose subject looks like a CAMS report email.
 *   4. Parses the full MIME source of each matching message.
 *   5. Normalizes each email into a report object via `parseCamsEmail`.
 *   6. Filters the result down to only the pre-approved report requests.
 *   7. Writes the approved list to `cams-reports.json` for auditing/debugging.
 *   8. Returns the approved list so the next pipeline stage (ZIP download)
 *      can use it directly.
 *
 * @returns {Promise<Array<object>>} approved, normalized CAMS report emails
 */
async function retrieveCamsEmails() {
    const emails = [];
    // ImapFlow instances cannot be reused after logout; cron/manual retries
    // must receive a fresh connection.
    const client = createImapClient();

    let matchedCount = 0;
    let urlCount = 0;
    let noUrlCount = 0;

    try {
        await client.connect();

        const lock =
            await client.getMailboxLock("INBOX");

        try {
            // -----------------------------------------------------------------
            // Exact 24-hour cutoff.
            // -----------------------------------------------------------------

            const now = new Date();

            const cutoff =
                new Date(
                    now.getTime() -
                    24 * 60 * 60 * 1000
                );

            // -----------------------------------------------------------------
            // IMAP SINCE is date-based, therefore use midnight of the
            // cutoff date as a broad boundary.
            // -----------------------------------------------------------------

            const imapSince =
                new Date(cutoff);

            imapSince.setHours(
                0,
                0,
                0,
                0
            );

            for await (
                const message of client.fetch(
                    {
                        since: imapSince,
                    },
                    {
                        uid: true,
                        envelope: true,
                        internalDate: true,
                        source: true,
                    }
                )
            ) {
                // -------------------------------------------------------------
                // Exact 24-hour filtering.
                // -------------------------------------------------------------

                const receivedDate =
                    message.internalDate
                        ? new Date(message.internalDate)
                        : null;

                if (
                    !receivedDate ||
                    receivedDate < cutoff
                ) {
                    continue;
                }

                // -------------------------------------------------------------
                // Subject filtering.
                // -------------------------------------------------------------

                const subject =
                    message.envelope?.subject || "";

                if (
                    !CAMS_SUBJECT_REGEX.test(subject)
                ) {
                    continue;
                }

                matchedCount++;

                // -------------------------------------------------------------
                // Complete MIME source is required.
                // -------------------------------------------------------------

                if (!message.source) {
                    noUrlCount++;

                    continue;
                }

                // -------------------------------------------------------------
                // Parse MIME email.
                // -------------------------------------------------------------

                const parsed =
                    await simpleParser(
                        message.source
                    );

                // -------------------------------------------------------------
                // Normalize.
                // -------------------------------------------------------------

                const normalizedEmail =
                    parseCamsEmail(
                        parsed,
                        message.source
                    );

                // -------------------------------------------------------------
                // URL diagnostics.
                //
                // Only print when something is actually suspicious.
                // -------------------------------------------------------------

                if (normalizedEmail.downloadUrl) {
                    urlCount++;
                } else {
                    noUrlCount++;

                    const raw =
                        message.source.toString("utf8");

                    const hasDownloadField =
                        /DownloadURL/i.test(
                            raw
                        );

                    const hasZipUrl =
                        extractAllCamsZipUrls(
                            raw
                        ).length > 0;

                    // Only log if the raw email appears to contain a
                    // DownloadURL field or ZIP URL but our extraction
                    // still failed.
                    if (
                        hasDownloadField ||
                        hasZipUrl
                    ) {
                    }
                }

                emails.push(
                    normalizedEmail
                );
            }
        } finally {
            lock.release();
        }

        await client.logout();

        // Apply the business allow-list after retrieval, before any report is
        // written or returned to the extraction/CSV/database pipeline.
        const approvedEmails = emails.filter((email) =>
            APPROVED_REPORT_REQUEST_NUMBERS.has(email.reportRequestNumber)
        );

        // ---------------------------------------------------------------------
        // Print unique CAMS report request numbers.
        // ---------------------------------------------------------------------
        const uniqueReportRequestNumbers = [
            ...new Set(
                approvedEmails
                    .map((email) => email.reportRequestNumber)
                    .filter(Boolean)
            ),
        ];


        // ---------------------------------------------------------------------
        // Save result.
        // ---------------------------------------------------------------------

        const outputPath =
            "./cams-reports.json";

        await fs.writeFile(
            outputPath,
            JSON.stringify(
                approvedEmails,
                null,
                4
            ),
            "utf8"
        );

        // ---------------------------------------------------------------------
        // Minimal parsing summary.
        // ---------------------------------------------------------------------


        // ---------------------------------------------------------------------
        // Return same array.
        // ---------------------------------------------------------------------

        return approvedEmails;

    } catch (error) {
        try {
            await client.logout();
        } catch (_) {
            // Ignore logout failure.
        }

        throw error;
    }
}

/** Email retrieval service; orchestration is performed by camsIngestionJob. */
module.exports = { retrieveCamsEmails };
