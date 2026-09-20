/**
 * Karvy (KFintech) WBR22 / "ClientWise AUM Report" CSV parsing.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Confirmed against a real downloaded-and-decrypted Karvy AUM report:
 * this CSV is structurally NOT the same as CAMS's WBR22 file. It is a
 * clean, standard, comma-separated CSV (no header/data trailing
 * apostrophes, no single-quote field wrapping — CAMS's WBR22 quirks
 * that `utils/cams_wbr22/wbr22ParsingUtils.js` exists to handle), with
 * entirely different column names: the fund's name is under
 * `Fund Description` and its value is under `AUM` (CAMS's equivalent
 * columns are `SCHEME_NAME` and `CLOSING_ASSETS`).
 *
 * Like CAMS's WBR22, this file has one row per client holding, so one
 * fund can appear on many rows — this file's job is to collapse those
 * into one total per fund: `SUM(AUM)` for every row sharing the same
 * `Fund Description`, exactly mirroring what `parseWbr22File` does for
 * the CAMS format, just reading different column names and without any
 * apostrophe-stripping.
 */

const { parse } = require("csv-parse/sync");
const CustomError = require("../customError");

/**
 * Parse a Karvy ClientWise AUM Report CSV buffer into a map of fund
 * name -> total AUM, summed across every client-holding row for that
 * fund.
 *
 * @param {Buffer} buffer the raw downloaded/decrypted Karvy AUM CSV
 * @returns {Map<string, number>} fund description -> total AUM
 */
function parseKarvyWbr22File(buffer) {
    let records;

    try {
        // This file has a normal header row and standard comma
        // separation, so `columns: true` (build one object per row,
        // keyed by the header) is sufficient — no positional/quirky
        // handling needed the way CAMS's WBR22 format requires.
        records = parse(buffer.toString("utf8"), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
        });
    } catch (error) {
        throw new CustomError(422, `Failed to parse Karvy WBR22 file: ${error.message}`);
    }

    if (records.length === 0) {
        throw new CustomError(422, "Karvy WBR22 file is empty");
    }

    if (!("Fund Description" in records[0]) || !("AUM" in records[0])) {
        throw new CustomError(
            422,
            'Karvy WBR22 file is missing the required "Fund Description"/"AUM" columns'
        );
    }

    const schemeTotals = new Map();

    for (const record of records) {
        const fundName = String(record["Fund Description"] || "").trim();

        if (!fundName) {
            continue;
        }

        const aum = Number(String(record["AUM"] || "").trim());

        if (!Number.isFinite(aum)) {
            // A malformed numeric value on one client's row shouldn't
            // abort the whole file — skip just this row.
            continue;
        }

        schemeTotals.set(fundName, (schemeTotals.get(fundName) || 0) + aum);
    }

    return schemeTotals;
}

module.exports = { parseKarvyWbr22File };
