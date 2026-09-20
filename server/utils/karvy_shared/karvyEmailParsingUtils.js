/**
 * Karvy (KFintech) email parsing helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Karvy's mutual-fund RTA business is now branded "KFintech" — every
 * report email actually comes from kfintech.com, not from any
 * "karvy"-named domain. Its emails are structured differently from
 * CAMS's in three ways this file deals with:
 *
 *   1. The unique tracking number sits in the SUBJECT line as
 *      "Ref. No. : XXXXX" (or "Ref.no. XXXXX", or "Ref.No :XXXXX" —
 *      KFintech is inconsistent about the punctuation), not in the body
 *      as CAMS's "Report Request No".
 *
 *   2. The download link in the email body is a click-tracking redirect
 *      (`https://scdelivery.kfintech.com/c/?u=...&p=...&e=...`), not a
 *      direct file URL, and its real destination is obfuscated
 *      (percent-encoding plus a per-character +1 shift). See
 *      `extractKarvyLandingUrl` below for exactly how and where this is
 *      recovered — and note the specific correction described there.
 *
 *   3. Everything else — the report's from/to date range and its
 *      dispatch timestamp — happens to use the exact same wording and
 *      DD/MM/YYYY format CAMS uses, so those are NOT duplicated here;
 *      callers should keep using `extractReportDateRange`,
 *      `extractDispatchDateTime`, and `parseCamsDateTime` from
 *      `cams_wbr22_automation/camsEmailParsingUtils.js` directly.
 */

const { extractValue } = require("../cams_wbr22_automation/camsEmailParsingUtils");

/**
 * KFintech's report-resolution landing page. Following it downloads a
 * password-protected ZIP directly — confirmed for both report types.
 */
const KARVY_LANDING_PAGE_BASE = "https://mfs.kfintech.com/mfs/Distributor/Requests/Req_allrptslink.aspx";

// -----------------------------------------------------------------------------
// Subject-line reference number
// -----------------------------------------------------------------------------

/**
 * Extract the "Ref. No. : XXXXX" value from a KFintech subject line.
 *
 * Works regardless of whether the subject has a "Fwd: " prefix (a
 * manual Gmail forward adds one; Gmail's own automatic mail-forwarding
 * does not), since the "Ref. No. : ..." text survives either way.
 *
 * @param {string} subject
 * @returns {string|null}
 */
function extractKarvyRefNumber(subject) {
    return extractValue(subject, /Ref\.?\s*No\.?\s*:?\s*([A-Za-z0-9_-]+)/i);
}

/**
 * Extract the "Report No" template code (e.g. "MFSD307" for Transaction
 * Feeds, "MFSD310" for ClientWise AUM). This is a fixed code per report
 * *type*, not a unique identifier for one email — `extractKarvyRefNumber`
 * is what should be used for tracking/allow-listing individual reports.
 *
 * @param {string} text
 * @returns {string|null}
 */
function extractKarvyReportNumber(text) {
    return extractValue(text, /Report\s+No\s*[:\t]?\s*([A-Za-z0-9_-]+)/i);
}

// -----------------------------------------------------------------------------
// Download-link resolution
// -----------------------------------------------------------------------------

/**
 * CORRECTION (supersedes an earlier version of this function): the
 * download link must be read from the email's HTML part specifically —
 * `parsed.html`, never `parsed.text` or the raw MIME source.
 *
 * The reason: a KFintech email's plain-text part contains its own copy
 * of the tracking link, but for "Transaction Feeds Report" emails that
 * copy is always broken (`u=undefined` — confirmed across every real
 * sample seen, a template bug on KFintech's side unrelated to our
 * parsing). The HTML part's "Click Here" link, however, was confirmed
 * (by manually following it) to be a genuinely working download link
 * for both report types. Scanning the raw MIME source or the
 * plain-text part risks silently matching the broken copy instead of
 * the working one whenever both are present in the same message —
 * which is exactly what happened before this correction.
 */

/**
 * Find the specific `<a>` element in an HTML email body whose link goes
 * to KFintech's delivery-tracking domain and whose visible text is
 * "Click Here" — distinguishing it from the email's other links (a
 * plain `mfs.kfintech.com` reference, a "Product Codes" link, etc).
 *
 * @param {string} html
 * @returns {string|null} the anchor's href, or null if not found
 */
function findScdeliveryClickHereHref(html) {
    if (!html) {
        return null;
    }

    const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorRegex.exec(html))) {
        const attributes = match[1];
        const innerHtml = match[2];

        const hrefMatch =
            attributes.match(/href\s*=\s*"([^"]*)"/i) ||
            attributes.match(/href\s*=\s*'([^']*)'/i) ||
            attributes.match(/href\s*=\s*([^\s>]+)/i);

        if (!hrefMatch) {
            continue;
        }

        const href = hrefMatch[1];
        const innerText = innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        if (href.includes("scdelivery.kfintech.com") && /click\s*here/i.test(innerText)) {
            return href;
        }
    }

    return null;
}

/**
 * Reverse KFintech's obfuscation of its tracking link's `u=` parameter:
 * URL-decode it, then shift every character back by 1 (their encoder
 * shifts every character forward by 1 before URL-encoding).
 *
 * @param {string} value the raw `u=` parameter value (already percent-encoded)
 * @returns {string|null}
 */
function decodeKarvyObfuscatedUrl(value) {
    if (!value) {
        return null;
    }

    let percentDecoded;

    try {
        percentDecoded = decodeURIComponent(value);
    } catch (_) {
        return null;
    }

    return percentDecoded
        .split("")
        .map((character) => String.fromCharCode(character.charCodeAt(0) - 1))
        .join("");
}

/**
 * Extract KFintech's report landing-page URL from a parsed email.
 *
 * Validated against every real sample available (1 AUM + 4 transaction
 * emails): finds the "Click Here" / scdelivery.kfintech.com anchor in
 * the HTML body, decodes its `u=` parameter, and confirms the result
 * lands on the expected KFintech domain before returning it.
 *
 * Per the "don't guess" principle: if the HTML part is missing, or no
 * matching anchor is found, or its `u=` parameter doesn't decode to a
 * well-formed KFintech URL, this returns `null` rather than falling
 * back to any other heuristic — the caller is expected to log that as
 * a diagnostic rather than silently proceeding with a guessed URL.
 *
 * @param {{html: string}} sources
 * @returns {string|null}
 */
function extractKarvyLandingUrl({ html }) {
    const href = findScdeliveryClickHereHref(html);

    if (!href) {
        return null;
    }

    let url;

    try {
        url = new URL(href);
    } catch (_) {
        return null;
    }

    const decoded = decodeKarvyObfuscatedUrl(url.searchParams.get("u"));

    if (!decoded || !decoded.startsWith("https://mfs.kfintech.com")) {
        return null;
    }

    return decoded;
}

module.exports = {
    KARVY_LANDING_PAGE_BASE,
    extractKarvyRefNumber,
    extractKarvyReportNumber,
    findScdeliveryClickHereHref,
    decodeKarvyObfuscatedUrl,
    extractKarvyLandingUrl,
};
