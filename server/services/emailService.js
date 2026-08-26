/**
 * CAMS email retrieval service.
 *
 * Requirements: authenticate to Gmail IMAP, select recent CAMS transaction
 * emails, preserve report identifiers, and safely extract a trusted ZIP URL.
 * Downloading, CSV parsing, persistence, scheduling, and logging stay outside
 * this service so each pipeline stage has one responsibility.
 */
require("dotenv").config();

const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const fs = require("fs/promises");

// -----------------------------------------------------------------------------
// Gmail IMAP client
// -----------------------------------------------------------------------------

function createImapClient() {
    return new ImapFlow({
        host: process.env.GMAIL_IMAP_HOST,
        port: Number(process.env.GMAIL_IMAP_PORT),
        secure: true,

        // ImapFlow uses a verbose pino logger by default. The service itself
        // controls application-level diagnostics, so disable library logs.
        logger: false,

        auth: {
            user: process.env.GMAIL_IMAP_USER,
            pass: process.env.GMAIL_IMAP_PASSWORD,
        },
    });
}

// -----------------------------------------------------------------------------
// CAMS subject matcher
// -----------------------------------------------------------------------------

const CAMS_SUBJECT_REGEX = /Investor\s+Transactions\s+for\s+a\s+Period/i;

// Only these approved CAMS report requests may enter the ingestion pipeline.
const APPROVED_REPORT_REQUEST_NUMBERS = new Set([
    "221744453R2",
    "221743797R2",
    "221744323R2",
    "221744277R2",
]);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function extractValue(text, regex) {
    if (!text || !regex) {
        return null;
    }

    const match = text.match(regex);

    if (!match) {
        return null;
    }

    return match[1]?.trim() || null;
}

/**
 * Decode the most common HTML entities.
 */
function decodeHtmlEntities(value) {
    if (!value) {
        return value;
    }

    return value
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#x2f;/gi, "/")
        .replace(/&#47;/gi, "/")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

/**
 * Decode quoted-printable soft line breaks and common encoded characters.
 *
 * CAMS raw MIME commonly contains:
 *
 *     href=3D'https://mailback7.camsonline.com/...'
 *
 * and URLs may be split as:
 *
 *     https://mailback7.camsonline.com/mailback_re=
 *     sult/....
 */
function decodeQuotedPrintable(value) {
    if (!value) {
        return value;
    }

    return value
        // Remove quoted-printable soft line breaks.
        .replace(/=\r?\n/g, "")
        // Decode hexadecimal quoted-printable bytes.
        .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        );
}

/**
 * Normalize arbitrary email content before URL extraction.
 */
function normalizeEmailSource(value) {
    if (!value) {
        return "";
    }

    let result = String(value);

    // Decode quoted-printable first.
    result = decodeQuotedPrintable(result);

    // Decode HTML entities.
    result = decodeHtmlEntities(result);

    // Remove excessive whitespace only where useful.
    result = result.replace(/\r\n/g, "\n");

    return result;
}

/**
 * Validate that a candidate is actually a CAMS ZIP URL.
 *
 * We deliberately restrict this to CAMS mailback hosts so that
 * unrelated ZIP links from the CAMS footer cannot accidentally
 * become the report URL.
 */
function isCamsDownloadUrl(value) {
    if (!value) {
        return false;
    }

    let url = value.trim();

    // Remove surrounding quotes/brackets.
    url = url.replace(/^["'<(]+|[>"')\s]+$/g, "");

    try {
        const parsed = new URL(url);

        if (!/^https?:$/i.test(parsed.protocol)) {
            return false;
        }

        if (!/\.camsonline\.com$/i.test(parsed.hostname)) {
            return false;
        }

        if (!/^mailback\d+$/i.test(parsed.hostname.split(".")[0])) {
            return false;
        }

        return /\.zip(?:$|[?#])/i.test(parsed.pathname + parsed.search);
    } catch {
        return false;
    }
}

/**
 * Clean a URL candidate.
 */
function cleanUrl(value) {
    if (!value) {
        return null;
    }

    let url = value.trim();

    url = decodeQuotedPrintable(url);
    url = decodeHtmlEntities(url);

    // Remove whitespace introduced by MIME line wrapping.
    url = url.replace(/[\r\n\t]/g, "");

    // Remove surrounding HTML/quote characters.
    url = url.replace(/^["'<(]+|[>"')]+$/g, "");

    return url.trim();
}

/**
 * Extract all CAMS ZIP URLs from a source.
 *
 * This is intentionally broader than the old regex.
 */
function extractAllCamsZipUrls(source) {
    if (!source) {
        return [];
    }

    const normalized = normalizeEmailSource(source);

    const urls = [];

    const urlRegex =
        /https?:\/\/mailback\d+\.camsonline\.com\/[^\s"'<>]+?\.zip(?:[?#][^\s"'<>]*)?/gi;

    let match;

    while ((match = urlRegex.exec(normalized)) !== null) {
        const url = cleanUrl(match[0]);

        if (
            url &&
            isCamsDownloadUrl(url) &&
            !urls.includes(url)
        ) {
            urls.push(url);
        }
    }

    return urls;
}

/**
 * Extract URL specifically from:
 *
 * DownloadURL
 * <a href='https://mailbackX.camsonline.com/...zip'>
 *
 * This is the most reliable CAMS-specific extraction path.
 */
function extractDownloadUrlFromDownloadField(source) {
    if (!source) {
        return null;
    }

    const normalized = normalizeEmailSource(source);

    /**
     * Locate the DownloadURL field and inspect a bounded section after it.
     *
     * The CAMS table structure is:
     *
     * <td> DownloadURL </td>
     * <td><a href='URL'>URL</a></td>
     *
     * We don't assume exact whitespace or quote style.
     */
    const downloadFieldRegex =
        /DownloadURL[\s\S]{0,5000}/i;

    const fieldMatch =
        normalized.match(downloadFieldRegex);

    if (!fieldMatch) {
        return null;
    }

    const field = fieldMatch[0];

    // First preference: href.
    const hrefRegex =
        /href\s*=\s*["']([^"']+)["']/i;

    const hrefMatch = field.match(hrefRegex);

    if (hrefMatch) {
        const href = cleanUrl(hrefMatch[1]);

        if (isCamsDownloadUrl(href)) {
            return href;
        }
    }

    // Second preference: visible URL text.
    const urls = extractAllCamsZipUrls(field);

    return urls.length > 0
        ? urls[0]
        : null;
}

/**
 * Extract CAMS download URL from all available representations.
 *
 * Priority:
 *
 * 1. DownloadURL field in raw MIME.
 * 2. DownloadURL field in parsed HTML.
 * 3. DownloadURL field in parsed text.
 * 4. CAMS ZIP URL anywhere in raw MIME.
 * 5. CAMS ZIP URL anywhere in parsed HTML.
 * 6. CAMS ZIP URL anywhere in parsed text.
 */
function extractDownloadUrl({
    rawSource,
    html,
    text,
}) {
    // -------------------------------------------------------------------------
    // 1. Raw MIME DownloadURL field.
    // -------------------------------------------------------------------------

    let url =
        extractDownloadUrlFromDownloadField(rawSource);

    if (url) {
        return url;
    }

    // -------------------------------------------------------------------------
    // 2. Parsed HTML DownloadURL field.
    // -------------------------------------------------------------------------

    url =
        extractDownloadUrlFromDownloadField(html);

    if (url) {
        return url;
    }

    // -------------------------------------------------------------------------
    // 3. Parsed text DownloadURL field.
    // -------------------------------------------------------------------------

    url =
        extractDownloadUrlFromDownloadField(text);

    if (url) {
        return url;
    }

    // -------------------------------------------------------------------------
    // 4. Any CAMS ZIP URL in raw MIME.
    // -------------------------------------------------------------------------

    let urls =
        extractAllCamsZipUrls(rawSource);

    if (urls.length > 0) {
        return urls[0];
    }

    // -------------------------------------------------------------------------
    // 5. Any CAMS ZIP URL in parsed HTML.
    // -------------------------------------------------------------------------

    urls =
        extractAllCamsZipUrls(html);

    if (urls.length > 0) {
        return urls[0];
    }

    // -------------------------------------------------------------------------
    // 6. Any CAMS ZIP URL in parsed text.
    // -------------------------------------------------------------------------

    urls =
        extractAllCamsZipUrls(text);

    if (urls.length > 0) {
        return urls[0];
    }

    return null;
}

// -----------------------------------------------------------------------------
// CAMS field extraction
// -----------------------------------------------------------------------------

function extractRequestNumber(text, subject) {
    const combinedText =
        `${subject || ""}\n${text || ""}`;

    return extractValue(
        combinedText,
        /Request\s+Id\s*:\s*([A-Za-z0-9_-]+)/i
    );
}

function extractReportRequestNumber(text) {
    return extractValue(
        text,
        /Report\s+Request\s+No\s*[:\-]?\s*([A-Za-z0-9_-]+)/i
    );
}

function extractReportNumber(text) {
    return extractValue(
        text,
        /Report\s+No\s*[:\-]?\s*([A-Za-z0-9_-]+)/i
    );
}

function extractReportDateRange(text) {
    const from = extractValue(
        text,
        /From\s+Date\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i
    );

    const to = extractValue(
        text,
        /To\s+Date\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i
    );

    return {
        from,
        to,
    };
}

function parseCamsDateTime(value) {
    if (!value) {
        return null;
    }

    const match = value.match(
        /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
    );

    if (!match) {
        return null;
    }

    const [
        ,
        day,
        month,
        year,
        hours,
        minutes,
        seconds,
    ] = match;

    const isoString =
        `${year}-${month}-${day}T` +
        `${hours}:${minutes}:${seconds}+05:30`;

    const date = new Date(isoString);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

function extractDispatchDateTime(text) {
    return extractValue(
        text,
        /Dispatch\s+Date\/Time\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i
    );
}

function formatReadableDate(date) {
    if (!date || Number.isNaN(date.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    }).format(date);
}

// -----------------------------------------------------------------------------
// Normalize one parsed CAMS email
// -----------------------------------------------------------------------------

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
            // Exact 48-hour cutoff.
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
                // Exact 48-hour filtering.
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
