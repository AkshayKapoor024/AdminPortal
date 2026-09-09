/**
 * WBR22 file parsing helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * WBR22 is the raw per-client holdings export CAMS sends the company —
 * one row per client, per fund, per quarter. It has an unusual quirk:
 * every single field (header and data) ends with a stray apostrophe
 * character, e.g. `SCHEME_NAME'` and `Aditya Birla Sun Life ELSS Tax
 * Saver Fund...'`. That apostrophe is not CSV quoting — it's just a
 * literal trailing character CAMS appends to every field — so this file
 * strips it off everywhere before using the values.
 *
 * Per the actual business need, only two columns matter: `SCHEME_NAME`
 * and `CLOSING_ASSETS`. Since one fund can have many client rows, this
 * file's job is to collapse those many rows down into one total per
 * fund: `SUM(CLOSING_ASSETS)` for every row that shares the same
 * `SCHEME_NAME`.
 */

const { parse } = require("csv-parse/sync");
const CustomError = require("../customError");

/** Strip WBR22's stray trailing apostrophe from a single field, if present. */
function stripTrailingQuote(value) {
    const text = String(value ?? "");
    return text.endsWith("'") ? text.slice(0, -1) : text;
}

/**
 * Parse a WBR22 CSV buffer into a map of fund name -> total closing
 * assets, summed across every client-holding row for that fund.
 *
 * @param {Buffer} buffer the raw uploaded WBR22 file
 * @returns {Map<string, number>} scheme name -> total closing assets
 */
function parseWbr22File(buffer) {
    let records;

    try {
        // `columns: false` reads plain rows (arrays), which we need here
        // since the header text itself carries WBR22's stray trailing
        // apostrophe and can't be used as-is for `columns: true` keys.
        records = parse(buffer.toString("utf8"), {
            columns: false,
            skip_empty_lines: true,
            trim: false,
            relax_column_count: true,
        });
    } catch (error) {
        throw new CustomError(422, `Failed to parse WBR22 file: ${error.message}`);
    }

    if (records.length === 0) {
        throw new CustomError(422, "WBR22 file is empty");
    }

    const header = records[0].map((column) => stripTrailingQuote(column).trim().toUpperCase());

    const schemeNameIndex = header.indexOf("SCHEME_NAME");
    const closingAssetsIndex = header.indexOf("CLOSING_ASSETS");

    if (schemeNameIndex === -1 || closingAssetsIndex === -1) {
        throw new CustomError(
            422,
            "WBR22 file is missing the required SCHEME_NAME/CLOSING_ASSETS columns"
        );
    }

    const schemeTotals = new Map();

    for (let rowIndex = 1; rowIndex < records.length; rowIndex++) {
        const row = records[rowIndex];

        if (!row || row.length <= Math.max(schemeNameIndex, closingAssetsIndex)) {
            continue;
        }

        const schemeName = stripTrailingQuote(row[schemeNameIndex]).trim();

        if (!schemeName) {
            continue;
        }

        const closingAssetsRaw = stripTrailingQuote(row[closingAssetsIndex]).trim();
        const closingAssets = Number(closingAssetsRaw);

        if (!Number.isFinite(closingAssets)) {
            // A malformed numeric value in one client's row shouldn't
            // abort the whole file — skip just this row.
            continue;
        }

        schemeTotals.set(schemeName, (schemeTotals.get(schemeName) || 0) + closingAssets);
    }

    return schemeTotals;
}

module.exports = { parseWbr22File, stripTrailingQuote };
