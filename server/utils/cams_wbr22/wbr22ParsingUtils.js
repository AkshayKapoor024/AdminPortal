/**
 * WBR22 file parsing helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * WBR22 is the raw per-client holdings export CAMS sends the company —
 * one row per client, per fund. CAMS wraps text fields in single quotes
 * (e.g. 'SCHEME_NAME','Aditya Birla ...'), and numeric fields are left
 * bare. The same file can reach us in two shapes:
 *
 *   1. RAW (what the automated email pipeline downloads): every text
 *      field is fully wrapped -> 'SCHEME_NAME','CLOSING_ASSETS'
 *   2. EXCEL-RESAVED (what a manually opened-and-saved copy looks like):
 *      Excel treats a leading apostrophe as a hidden "text" marker and
 *      drops it, leaving only the trailing one -> SCHEME_NAME',CLOSING_ASSETS'
 *
 * This file used to understand only shape 2, so real downloaded files
 * (shape 1) failed with "missing the required SCHEME_NAME/CLOSING_ASSETS
 * columns" — the header was read as 'SCHEME_NAME (leading apostrophe
 * still attached). The tokenizer below reads BOTH shapes identically.
 *
 * Only two columns matter: `SCHEME_NAME` and `CLOSING_ASSETS`. One fund
 * has many client rows, so the result is one total per fund:
 * SUM(CLOSING_ASSETS) for every row sharing the same SCHEME_NAME.
 */

import CustomError from "../customError.js";

/** Strip a single stray trailing apostrophe from a field, if present. */
function stripTrailingQuote(value) {
    const text = String(value ?? "");
    return text.endsWith("'") ? text.slice(0, -1) : text;
}

/**
 * Split one CSV line into fields, understanding CAMS's apostrophe style.
 *
 * A field that STARTS with an apostrophe is a quoted field: it runs
 * until an apostrophe that is immediately followed by a comma or the
 * end of the line, so commas (and stray apostrophes) inside the quoted
 * text are kept as part of the value. Any other field is read up to the
 * next comma, with a single trailing apostrophe stripped (the
 * Excel-resaved shape).
 *
 * @param {string} line
 * @returns {string[]}
 */
function splitCamsLine(line) {
    const fields = [];
    let index = 0;

    while (index <= line.length) {
        if (line[index] === "'") {
            let end = index + 1;

            while (end < line.length) {
                if (line[end] === "'" && (end + 1 === line.length || line[end + 1] === ",")) {
                    break;
                }
                end += 1;
            }

            fields.push(line.slice(index + 1, end));
            index = end + 2; // skip the closing apostrophe and the comma
        } else {
            let end = line.indexOf(",", index);

            if (end === -1) {
                end = line.length;
            }

            fields.push(stripTrailingQuote(line.slice(index, end)));
            index = end + 1;
        }
    }

    return fields;
}

/**
 * Parse a WBR22 CSV buffer into a map of fund name -> total closing
 * assets, summed across every client-holding row for that fund.
 *
 * @param {Buffer} buffer the raw uploaded/downloaded WBR22 file
 * @returns {Map<string, number>} scheme name -> total closing assets
 */
function parseWbr22File(buffer) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

    if (lines.length === 0) {
        throw new CustomError(422, "WBR22 file is empty");
    }

    const header = splitCamsLine(lines[0]).map((column) => column.trim().toUpperCase());

    const schemeNameIndex = header.indexOf("SCHEME_NAME");
    const closingAssetsIndex = header.indexOf("CLOSING_ASSETS");

    if (schemeNameIndex === -1 || closingAssetsIndex === -1) {
        throw new CustomError(
            422,
            "WBR22 file is missing the required SCHEME_NAME/CLOSING_ASSETS columns " +
            `(first columns found: ${header.slice(0, 8).join(" | ")})`
        );
    }

    const schemeTotals = new Map();

    for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
        const row = splitCamsLine(lines[rowIndex]);

        if (row.length <= Math.max(schemeNameIndex, closingAssetsIndex)) {
            continue;
        }

        const schemeName = row[schemeNameIndex].trim();

        if (!schemeName) {
            continue;
        }

        const closingAssets = Number(row[closingAssetsIndex].trim());

        if (!Number.isFinite(closingAssets)) {
            // A malformed numeric value in one client's row shouldn't
            // abort the whole file — skip just this row.
            continue;
        }

        schemeTotals.set(schemeName, (schemeTotals.get(schemeName) || 0) + closingAssets);
    }

    return schemeTotals;
}

export { parseWbr22File, stripTrailingQuote, splitCamsLine };
