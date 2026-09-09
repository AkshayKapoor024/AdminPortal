/**
 * AMFI quarterly XLSX download + row classification helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Every AMFI quarterly Excel file has the same shape, but its exact cell
 * text (sheet name, title row, column headers) changes slightly every
 * quarter — for example the title row always embeds that quarter's own
 * end-date. So instead of reading cells by column name, this file reads
 * every row *positionally* (1st cell, 2nd cell, 3rd cell, 4th cell) and
 * decides what kind of row it is purely from what's actually in those
 * cells:
 *
 *   - a row with a name but no numbers is a "header" row — a category
 *     grouping like "Open Ended Schemes" or "Liquid/ Cash Oriented
 *     Schemes" that doesn't carry AUM/AAUM figures itself
 *   - a row with a name AND two numbers is a "leaf" row — an actual
 *     fund category with real AUM/AAUM figures, like "Overnight Fund"
 *   - everything else (title rows, column-label rows, the final "Total"
 *     row, blank rows) is discarded
 *
 * This file does not touch the database — it only turns a downloaded
 * XLSX buffer into a clean, ordered list of classified rows. Turning
 * that list into actual `AumCategory`/`IndustryAum` records happens in
 * `services/industryAumService.js`, using `utils/aumCategoryResolver.js`.
 */

const XLSX = require("xlsx");

// -----------------------------------------------------------------------------
// Row marker patterns
// -----------------------------------------------------------------------------

/**
 * Level-1 markers: the exact, fixed set of top-level scheme types AMFI
 * has ever used ("A" = Open Ended, "B" = Close Ended, "C" = Interval).
 *
 * IMPORTANT: this must be an explicit set, not a generic "single
 * uppercase letter" pattern — level-2 roman numerals "I" and "V" are
 * also single uppercase letters, so a generic regex would wrongly claim
 * them as level-1 markers before the roman-numeral check ever runs.
 */
const LEVEL_1_MARKERS = new Set(["A", "B", "C"]);

/** Level-2 markers: an uppercase roman numeral, e.g. "I", "II", "III", "IV", "V". */
const LEVEL_2_MARKER = /^[IVXLCDM]+$/;

/** Level-3 markers: a lowercase letter followed by a closing paren, e.g. "a)", "b)". */
const LEVEL_3_MARKER = /^[a-z]\)$/;

// -----------------------------------------------------------------------------
// Download
// -----------------------------------------------------------------------------

/**
 * Download an AMFI quarterly XLSX file.
 *
 * @param {string} excelUrl
 * @returns {Promise<Buffer>}
 */
async function downloadAmfiExcel(excelUrl) {
    const response = await fetch(excelUrl);

    if (!response.ok) {
        throw new Error(
            `Failed to download AMFI XLSX (HTTP ${response.status}): ${excelUrl}`
        );
    }

    const arrayBuffer = await response.arrayBuffer();

    return Buffer.from(arrayBuffer);
}

// -----------------------------------------------------------------------------
// Row classification
// -----------------------------------------------------------------------------

/**
 * Classify a single raw spreadsheet row into a header row, a leaf
 * (observation) row, or `null` for anything that should be discarded
 * (title rows, column-label rows, the grand "Total" row, blank rows).
 *
 * @param {Array} row  a row as `[marker, name, aum, aaum, ...]`
 * @returns {{type: "header", name: string, level: number}
 *          | {type: "leaf", name: string, aum: number, aaum: number}
 *          | {type: "unrecognized", marker: any, name: string}
 *          | null}
 */
function classifyAmfiRow(row) {
    const marker = row[0];
    const name = row[1];
    const aum = row[2];
    const aaum = row[3];

    // No name at all: blank spacer row, discard.
    if (name === null || name === undefined || String(name).trim() === "") {
        return null;
    }

    // The final grand-total row.
    if (String(name).trim().toLowerCase() === "total") {
        return null;
    }

    // Title / unit-label / column-header rows carry text (not numbers) in
    // the AUM/AAUM positions, e.g. "AUM as on ...", "Rs. in Crore".
    if (typeof aum === "string" || typeof aaum === "string") {
        return null;
    }

    // A real observation: both AUM and AAUM are numbers.
    if (typeof aum === "number" && typeof aaum === "number") {
        return {
            type: "leaf",
            name: String(name),
            aum,
            aaum,
        };
    }

    // A grouping/header row: has a name, has a marker, but no figures yet.
    const markerText = marker === null || marker === undefined ? "" : String(marker).trim();

    if (LEVEL_1_MARKERS.has(markerText)) {
        return { type: "header", name: String(name), level: 1 };
    }

    if (LEVEL_2_MARKER.test(markerText)) {
        return { type: "header", name: String(name), level: 2 };
    }

    if (LEVEL_3_MARKER.test(markerText)) {
        return { type: "header", name: String(name), level: 3 };
    }

    // Something we don't recognise (e.g. a stray title/note row that has a
    // name but no numbers and no known marker). The caller decides how to
    // handle/log this; we never guess a level for it.
    return { type: "unrecognized", marker: markerText, name: String(name) };
}

// -----------------------------------------------------------------------------
// Workbook parsing
// -----------------------------------------------------------------------------

/**
 * Parse an AMFI quarterly XLSX buffer into an ordered list of classified
 * rows (see `classifyAmfiRow`).
 *
 * Only the first sheet is read — every AMFI quarterly file we've seen
 * contains exactly one data sheet, whatever its name happens to be that
 * quarter.
 *
 * @param {Buffer} buffer
 * @returns {Array<object>} classified rows, in their original file order,
 *          with discarded rows already filtered out
 */
function parseAmfiWorkbookRows(buffer) {
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
        throw new Error("AMFI XLSX file does not contain any sheets");
    }

    const worksheet = workbook.Sheets[sheetName];

    // `header: 1` reads rows as plain arrays (positional), instead of
    // building objects keyed by whatever the header row happens to say
    // this quarter — which is exactly what we need, since AMFI's header
    // text changes every quarter but the column positions never do.
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
    });

    const classifiedRows = [];

    for (const row of rawRows) {
        const classified = classifyAmfiRow(row);

        if (classified) {
            classifiedRows.push(classified);
        }
    }

    return classifiedRows;
}

module.exports = {
    downloadAmfiExcel,
    parseAmfiWorkbookRows,
    classifyAmfiRow,
};
