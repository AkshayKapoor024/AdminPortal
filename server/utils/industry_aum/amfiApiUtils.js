/**
 * AMFI AUM disclosure API + financial-year helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * AMFI exposes an (undocumented but public) endpoint that, given a
 * financial year like "2025-26", returns the list of quarters published
 * so far for that year, each with a download link for its Excel file.
 * This file wraps that one HTTP call, plus a couple of small date-math
 * helpers for turning a financial year string into a list of years to
 * loop over, and for figuring out which quarter (Q1–Q4) a given period
 * label like "(Jul - Sep 2025)" refers to.
 */

/** AMFI's disclosure-by-category endpoint. */
const AMFI_DISCLOSURE_API_URL =
    "https://www.amfiindia.com/api/get-disclosure-category";

/** The earliest financial year AMFI publishes this report for. */
const AMFI_FIRST_FINANCIAL_YEAR = "2017-18";

/** Maps a period's starting month name to its AMFI quarter number. */
const MONTH_TO_QUARTER = {
    apr: 1,
    jul: 2,
    oct: 3,
    jan: 4,
};

// -----------------------------------------------------------------------------
// Quarter identification
// -----------------------------------------------------------------------------

/**
 * Determine the quarter number (1–4) from an AMFI period label such as
 * "(Jul - Sep 2025)".
 *
 * @param {string} period
 * @returns {number|null} 1, 2, 3, 4, or null if the label wasn't recognised
 */
function getQuarterFromPeriod(period) {
    const match = String(period || "").match(
        /\((Jan|Apr|Jul|Oct)\s*-\s*(Mar|Jun|Sep|Dec)\s+\d{4}\)/i
    );

    if (!match) {
        return null;
    }

    return MONTH_TO_QUARTER[match[1].toLowerCase()] || null;
}

// -----------------------------------------------------------------------------
// Financial year helpers
// -----------------------------------------------------------------------------

/**
 * Compute the financial year (e.g. "2025-26") that a given date falls
 * into. India's financial year runs 1 April – 31 March, so January to
 * March belongs to the financial year that *started* the previous
 * calendar year.
 *
 * @param {Date} [date] defaults to now
 * @returns {string}
 */
function getFinancialYearForDate(date = new Date()) {
    const calendarYear = date.getFullYear();
    const month = date.getMonth() + 1; // 1–12

    const startYear = month >= 4 ? calendarYear : calendarYear - 1;
    const endYearSuffix = String((startYear + 1) % 100).padStart(2, "0");

    return `${startYear}-${endYearSuffix}`;
}

/**
 * Build the full, ordered list of financial year ids to process, from
 * AMFI's earliest published year up to (and including) the current one.
 *
 * @param {Date} [now] defaults to the current date
 * @returns {string[]} e.g. ["2011-12", "2012-13", ..., "2025-26"]
 */
function buildFinancialYearRange(now = new Date()) {
    const startYear = parseInt(AMFI_FIRST_FINANCIAL_YEAR.split("-")[0], 10);
    const currentFinancialYear = getFinancialYearForDate(now);
    const endYear = parseInt(currentFinancialYear.split("-")[0], 10);

    const years = [];

    for (let year = startYear; year <= endYear; year++) {
        const endSuffix = String((year + 1) % 100).padStart(2, "0");
        years.push(`${year}-${endSuffix}`);
    }

    return years;
}

// -----------------------------------------------------------------------------
// AMFI API call
// -----------------------------------------------------------------------------

/**
 * Fetch the list of quarters AMFI has published so far for a given
 * financial year.
 *
 * @param {string} fyId e.g. "2025-26"
 * @returns {Promise<Array<{Period: string, pdfURL: string, excelURL: string}>>}
 */
async function fetchAvailableQuarters(fyId) {
    const url = `${AMFI_DISCLOSURE_API_URL}?fyId=${encodeURIComponent(fyId)}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `AMFI disclosure API request failed (HTTP ${response.status}) for FY ${fyId}`
        );
    }

    const json = await response.json();

    const disclosure = json?.QuarterlyDisclosureAUMbyCategorywise;

    if (!Array.isArray(disclosure) || disclosure.length === 0) {
        throw new Error(
            `AMFI disclosure API returned no data for FY ${fyId}`
        );
    }

    const quarterlyData = disclosure[0]?.data;

    if (!Array.isArray(quarterlyData)) {
        throw new Error(
            `AMFI disclosure API response for FY ${fyId} did not contain a quarter list`
        );
    }

    return quarterlyData;
}

module.exports = {
    AMFI_FIRST_FINANCIAL_YEAR,
    getQuarterFromPeriod,
    getFinancialYearForDate,
    buildFinancialYearRange,
    fetchAvailableQuarters,
};
