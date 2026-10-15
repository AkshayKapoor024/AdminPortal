/**
 * CAMS email parsing helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * CAMS sends a report-ready email whose body is messy raw HTML/MIME text.
 * Everything in this file is a small, single-purpose "reader" function that
 * knows how to pull one specific piece of information out of that messy
 * text — for example "what is the download link", "what is the report
 * number", or "what date range does this report cover".
 *
 * None of these functions talk to Gmail, the database, or the filesystem.
 * They only transform text that is handed to them and return either a
 * value or `null` when nothing could be found. Keeping them pure like this
 * makes each one easy to test and easy to reason about on its own.
 *
 * These helpers are used by `services/emailService.js`, which is the file
 * responsible for actually connecting to Gmail and orchestrating the
 * end-to-end email retrieval step of the CAMS pipeline.
 */

import { ImapFlow } from "imapflow";

// -----------------------------------------------------------------------------
// Gmail IMAP client factory
// -----------------------------------------------------------------------------

/**
 * Build a fresh IMAP client configured for the company Gmail mailbox.
 *
 * A new client must be created for every run because an ImapFlow
 * connection cannot be reused once it has been logged out of (cron jobs
 * and manual retries always need a brand-new connection).
 *
 * @returns {ImapFlow} an unconnected IMAP client, ready for `.connect()`
 */
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
// Generic text-extraction helper
// -----------------------------------------------------------------------------

/**
 * Run a regex against a block of text and return its first capture group.
 *
 * This is the building block every "extractX" function below is written
 * on top of, so that the same "no match = null" behaviour is guaranteed
 * everywhere instead of being re-implemented in every helper.
 *
 * @param {string} text  the text to search inside
 * @param {RegExp} regex a regex that contains one capture group
 * @returns {string|null} the trimmed captured value, or null if not found
 */
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

// -----------------------------------------------------------------------------
// Download-URL discovery
// -----------------------------------------------------------------------------

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
 *
 * @param {{rawSource: string, html: string, text: string}} sources
 * @returns {string|null}
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

/** Extract the "Request Id" value from the subject line or body text. */
function extractRequestNumber(text, subject) {
    const combinedText =
        `${subject || ""}\n${text || ""}`;

    return extractValue(
        combinedText,
        /Request\s+Id\s*:\s*([A-Za-z0-9_-]+)/i
    );
}

/** Extract the "Report Request No" value, used as the report's unique identity. */
function extractReportRequestNumber(text) {
    return extractValue(
        text,
        /Report\s+Request\s+No\s*[:\-]?\s*([A-Za-z0-9_-]+)/i
    );
}

/** Extract the "Report No" value. */
function extractReportNumber(text) {
    return extractValue(
        text,
        /Report\s+No\s*[:\-]?\s*([A-Za-z0-9_-]+)/i
    );
}

/** Extract the "From Date" / "To Date" pair describing the report's coverage period. */
function extractReportDateRange(text) {
    if (!text) {
        return { from: null, to: null };
    }

    // Decode quoted-printable & strip HTML tags so table cells like
    // <td> From Date </td> <td> 26/09/2026 </td> collapse into clean readable text.
    const cleanText = normalizeEmailSource(text).replace(/<[^>]+>/g, " ");

    const from = extractValue(
        cleanText,
        /From\s+Date\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i
    );

    const to = extractValue(
        cleanText,
        /To\s+Date\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i
    );

    return {
        from,
        to,
    };
}

/**
 * Parse a CAMS "DD/MM/YYYY HH:mm:ss" timestamp string into a real Date.
 *
 * CAMS timestamps are always in Indian time, so the +05:30 offset is
 * applied explicitly rather than relying on the server's local timezone.
 *
 * @param {string} value
 * @returns {Date|null}
 */
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

/** Extract the raw "Dispatch Date/Time" string from the email body. */
function extractDispatchDateTime(text) {
    return extractValue(
        text,
        /Dispatch\s+Date\/Time\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i
    );
}

/** Format a Date as a human-friendly Indian-locale string, for logs/UI. */
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

/** Extract distributor ARN number (e.g. "ARN-11923") or registered distributor email from email text/subject/raw source. */
function extractArn(text, subject, rawSource = "") {
    const combinedText = normalizeEmailSource(`${subject || ""}\n${text || ""}\n${rawSource || ""}`).replace(/<[^>]+>/g, " ");

    const brokerCodeMatch = combinedText.match(/Broker\s+Code\s*[:\t\-]?\s*([A-Za-z0-9_-]+)/i);
    if (brokerCodeMatch && brokerCodeMatch[1]) {
        return brokerCodeMatch[1].trim();
    }

    const arnDirectMatch = combinedText.match(/(ARN-?\d+[A-Za-z0-9]*)/i);
    if (arnDirectMatch) {
        return arnDirectMatch[1].trim();
    }

    // For CAMS emails where explicit ARN-xxx is absent, extract the registered distributor email
    const emailMatch = combinedText.match(/Email\s*[:\-]?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);
    if (emailMatch && emailMatch[1]) {
        return emailMatch[1].trim().toLowerCase();
    }

    return null;
}

export {
    createImapClient,
    extractValue,
    decodeHtmlEntities,
    decodeQuotedPrintable,
    normalizeEmailSource,
    isCamsDownloadUrl,
    cleanUrl,
    extractAllCamsZipUrls,
    extractDownloadUrlFromDownloadField,
    extractDownloadUrl,
    extractRequestNumber,
    extractReportRequestNumber,
    extractReportNumber,
    extractReportDateRange,
    parseCamsDateTime,
    extractDispatchDateTime,
    formatReadableDate,
    extractArn,
};
