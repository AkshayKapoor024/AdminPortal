/**
 * Karvy "Transaction Feeds Report" CSV parsing helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Unlike CAMS's WBR2 format, a Karvy transactions CSV is a completely
 * standard, clean CSV — a normal header row, plain comma separation,
 * proper double-quoting only where actually needed, no unescaped
 * apostrophes. So this file is deliberately much simpler than
 * `cams_transactions/camsCsvParsingUtils.js`: no custom quote
 * character, no per-character quote-fixing transform stream, and no
 * "file might have no header row at all" fallback (every real Karvy
 * sample seen has had a proper header).
 *
 * These helpers are used by `services/karvy_transactions/csvService.js`,
 * which decides which reports get parsed and shapes the result for the
 * database layer.
 */

import fs from "fs";
import { parse } from "csv-parse";
import CustomError from "../customError.js";

// ---------------------------------------------------------------------
// Report-level validation
// ---------------------------------------------------------------------

/**
 * Check whether a report was successfully extracted and contains a
 * usable CSV path. Reports that failed during download/extraction
 * should not be passed to the CSV parser.
 *
 * @param {object} report
 * @returns {boolean}
 */
function isProcessableReport(report) {
    return (
        report?.status === "EXTRACTED" &&
        typeof report?.paths?.csvPath === "string" &&
        report.paths.csvPath.trim() !== ""
    );
}

/**
 * Validate that a CSV path points to an actual, non-empty file.
 *
 * @param {string} csvPath
 * @returns {Promise<void>}
 */
async function validateCsvFile(csvPath) {
    if (!csvPath) {
        throw new CustomError(400, "CSV file path is required");
    }

    const normalizedPath = String(csvPath).trim();

    try {
        const stats = await fs.promises.stat(normalizedPath);

        if (!stats.isFile()) {
            throw new CustomError(422, "Karvy CSV path does not point to a file");
        }

        if (stats.size === 0) {
            throw new CustomError(422, "Karvy CSV file is empty");
        }
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }

        if (error.code === "ENOENT") {
            throw new CustomError(404, "Karvy CSV file was not found");
        }

        throw new CustomError(500, `Failed to access Karvy CSV file: ${error.message}`);
    }
}

// ---------------------------------------------------------------------
// Value/record normalization
// ---------------------------------------------------------------------

/** Trim accidental whitespace around a column name; the actual Karvy header text is otherwise preserved exactly. */
function normalizeColumnName(column) {
    return typeof column === "string" ? column.trim() : column;
}

/**
 * Normalize a parsed CSV value: trim whitespace, keep it as a string
 * (never cast to a number), and represent empty values as null.
 *
 * Keeping every value as a string is deliberate: identifiers such as
 * folio numbers, PANs, and transaction numbers may contain leading
 * zeroes that a numeric conversion would silently destroy.
 *
 * @param {string} value
 * @returns {string|null}
 */
function normalizeCsvValue(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();

    return normalized === "" ? null : normalized;
}

/** Normalize one complete Karvy transaction record. */
function normalizeCsvRecord(record) {
    const normalizedRecord = {};

    for (const [key, value] of Object.entries(record)) {
        normalizedRecord[normalizeColumnName(key)] = normalizeCsvValue(value);
    }

    return normalizedRecord;
}

// ---------------------------------------------------------------------
// File-level CSV parsing
// ---------------------------------------------------------------------

/**
 * Parse a single Karvy transactions CSV file into an array of
 * transaction objects.
 *
 * The first row is always treated as the header row — every real Karvy
 * sample has one — and every subsequent row becomes one JavaScript
 * object, keyed by that header.
 *
 * @param {string} csvPath
 * @returns {Promise<Array<object>>}
 */
async function parseCsvFile(csvPath) {
    await validateCsvFile(csvPath);

    return new Promise((resolve, reject) => {
        const records = [];

        let parserFinished = false;
        let fileStream;

        const fail = (error) => {
            if (parserFinished) {
                return;
            }

            parserFinished = true;

            if (error instanceof CustomError) {
                reject(error);
                return;
            }

            reject(new CustomError(422, `Failed to parse Karvy CSV file: ${error.message}`));
        };

        try {
            const parser = parse({
                columns: (headers) => {
                    if (!headers || headers.length === 0) {
                        throw new Error("Karvy CSV does not contain a header row");
                    }

                    return headers.map(normalizeColumnName);
                },

                // Standard CSV quoting (double quotes) — no CAMS-style
                // single-quote fields, so the default is exactly right.
                skip_empty_lines: true,
                trim: true,
                bom: true,

                // Do not silently accept rows with a different column
                // count from the header — protects transaction integrity.
                relax_column_count: false,

                // Keep every field as a string; type conversion, if ever
                // needed, happens downstream according to the schema.
                cast: false,

                max_record_size: 10 * 1024 * 1024,
            });

            parser.on("data", (record) => {
                records.push(normalizeCsvRecord(record));
            });

            parser.on("error", (error) => {
                fail(error);
            });

            parser.on("end", () => {
                if (parserFinished) {
                    return;
                }

                parserFinished = true;
                resolve(records);
            });

            fileStream = fs.createReadStream(csvPath, { encoding: "utf8" });

            fileStream.on("error", (error) => {
                fail(new CustomError(500, `Failed to read Karvy CSV file: ${error.message}`));
            });

            fileStream.pipe(parser);
        } catch (error) {
            fail(error);
        }
    });
}

export{
    isProcessableReport,
    validateCsvFile,
    normalizeColumnName,
    normalizeCsvValue,
    normalizeCsvRecord,
    parseCsvFile,
};
