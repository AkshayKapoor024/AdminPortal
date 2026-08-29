/**
 * CAMS CSV parsing helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * A CAMS report is a CSV file, but it is not a "normal" CSV: its fields are
 * wrapped in single quotes instead of double quotes, it sometimes has no
 * header row at all, and it doesn't escape apostrophes that appear inside
 * a field. This file contains every small helper needed to turn that
 * unusual file format into a clean array of plain JavaScript objects
 * (one object per transaction row), plus a couple of small validation
 * helpers used before parsing begins.
 *
 * These helpers are used by `services/csvService.js`, which is the file
 * responsible for deciding *which* reports get parsed and for shaping the
 * final result that is handed to the database layer.
 */

const fs = require("fs");
const { Transform } = require("stream");
const { parse } = require("csv-parse");
const CustomError = require("./customError");
const { CAMS_TRANSACTION_FIELDS } = require("./camsPersistence");

// ---------------------------------------------------------------------
// CAMS CSV configuration
// ---------------------------------------------------------------------

/*
 * CAMS exports its CSV fields using single quotes:
 *
 * 'AMC_CODE','FOLIO_NO','PRODCODE','SCHEME',...
 *
 * Therefore the CSV parser must explicitly use "'" as its quote
 * character instead of the default double quote.
 */
const CAMS_CSV_QUOTE = "'";

/** The full, ordered list of CAMS column names, used as a fallback header. */
const CAMS_CSV_HEADERS = Object.keys(CAMS_TRANSACTION_FIELDS);

// ---------------------------------------------------------------------
// Report-level validation
// ---------------------------------------------------------------------

/**
 * Check whether a report was successfully extracted and contains
 * a usable CSV path.
 *
 * Reports that failed during download/extraction should not be passed
 * to the CSV parser.
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
 * Validate that a CSV path points to an actual file.
 *
 * @param {string} csvPath
 * @returns {Promise<void>}
 */
async function validateCsvFile(csvPath) {
    if (!csvPath) {
        throw new CustomError(
            400,
            "CSV file path is required"
        );
    }

    const normalizedPath = String(csvPath).trim();

    try {
        const stats = await fs.promises.stat(
            normalizedPath
        );

        if (!stats.isFile()) {
            throw new CustomError(
                422,
                "CAMS CSV path does not point to a file"
            );
        }

        if (stats.size === 0) {
            throw new CustomError(
                422,
                "CAMS CSV file is empty"
            );
        }
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }

        if (error.code === "ENOENT") {
            throw new CustomError(
                404,
                "CAMS CSV file was not found"
            );
        }

        throw new CustomError(
            500,
            `Failed to access CAMS CSV file: ${error.message}`
        );
    }
}

// ---------------------------------------------------------------------
// Value/record normalization
// ---------------------------------------------------------------------

/**
 * Normalize CAMS CSV column names.
 *
 * csv-parse handles the surrounding single quotes through the
 * `quote` option. This function additionally removes accidental
 * whitespace around column names.
 *
 * The actual CAMS column names are otherwise preserved exactly.
 *
 * @param {string} column
 * @returns {string}
 */
function normalizeColumnName(column) {
    if (typeof column !== "string") {
        return column;
    }

    return column.trim();
}

/**
 * Normalize a parsed CSV value.
 *
 * CAMS may contain padded whitespace in fields. We remove surrounding
 * whitespace but intentionally keep the value as a string.
 *
 * This is important because values such as:
 *
 * - FOLIO numbers
 * - PAN
 * - account numbers
 * - transaction numbers
 * - reference numbers
 *
 * may contain leading zeroes and must not be converted to numbers.
 *
 * Empty values are represented as null.
 *
 * @param {string} value
 * @returns {string|null}
 */
function normalizeCsvValue(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();

    if (!normalized) {
        return null;
    }

    return normalized;
}

/**
 * Normalize one complete CAMS transaction record.
 *
 * @param {object} record
 * @returns {object}
 */
function normalizeCsvRecord(record) {
    const normalizedRecord = {};

    for (const [key, value] of Object.entries(record)) {
        normalizedRecord[normalizeColumnName(key)] =
            normalizeCsvValue(value);
    }

    return normalizedRecord;
}

// ---------------------------------------------------------------------
// Stream-level fix-ups
// ---------------------------------------------------------------------

/**
 * CAMS does not escape apostrophes inside an already quoted field. Convert
 * only those internal apostrophes to CSV's doubled-quote form before parsing.
 * Opening and closing field quotes (start/comma → quote; quote → comma/EOL)
 * remain unchanged.
 *
 * This runs as a Node.js Transform stream so that the fix-up happens while
 * the file is being read, without ever holding the whole CSV in memory.
 *
 * @returns {Transform}
 */
function createCamsQuoteNormalizer() {
    let previous = "";
    let pending = "";

    const normalize = (input, final = false) => {
        const limit = final ? input.length : Math.max(0, input.length - 1);
        let output = "";
        for (let index = 0; index < limit; index += 1) {
            const character = input[index];
            const next = input[index + 1] || "";
            const isInternalApostrophe = character === "'" && previous !== "" && previous !== "," && previous !== "\r" && previous !== "\n" && next !== "," && next !== "\r" && next !== "\n";
            output += isInternalApostrophe ? "''" : character;
            previous = character;
        }
        return { output, remainder: final ? "" : input.slice(limit) };
    };

    return new Transform({
        transform(chunk, _encoding, callback) {
            const result = normalize(pending + chunk.toString("utf8"));
            pending = result.remainder;
            callback(null, result.output);
        },
        flush(callback) {
            const result = normalize(pending, true);
            callback(null, result.output);
        },
    });
}

/**
 * CAMS occasionally supplies a data-only CSV with no header row. Inspect only
 * the beginning of the file and fall back to the known 80-column CAMS schema.
 *
 * @param {string} csvPath
 * @returns {Promise<boolean>} true if the file appears to start with a header row
 */
async function hasCamsHeaderRow(csvPath) {
    const handle = await fs.promises.open(csvPath, "r");
    try {
        const buffer = Buffer.alloc(16 * 1024);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        const firstLine = buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/, 1)[0];
        return /(?:^|,)\s*'?AMC_CODE'?\s*,/i.test(firstLine) && /'?FOLIO_NO'?/i.test(firstLine);
    } finally {
        await handle.close();
    }
}

// ---------------------------------------------------------------------
// File-level CSV parsing
// ---------------------------------------------------------------------

/**
 * Parse a single CAMS CSV file into an array of transaction objects.
 *
 * The first CSV row is treated as the header row (unless the file has no
 * header row at all, see `hasCamsHeaderRow`) and every subsequent row
 * becomes one JavaScript object.
 *
 * CAMS uses single quotes around fields, therefore `quote: "'"` is
 * explicitly configured.
 *
 * Example:
 *
 * 'FOLIO_NO','AMOUNT','TRXNTYPE'
 * '12345','5000','SIP'
 *
 * becomes:
 *
 * [
 *     {
 *         FOLIO_NO: "12345",
 *         AMOUNT: "5000",
 *         TRXNTYPE: "SIP"
 *     }
 * ]
 *
 * @param {string} csvPath
 * @returns {Promise<Array<object>>}
 */
async function parseCsvFile(csvPath) {
    await validateCsvFile(csvPath);
    const hasHeaderRow = await hasCamsHeaderRow(csvPath);

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

            reject(
                new CustomError(
                    422,
                    `Failed to parse CAMS CSV file: ${error.message}`
                )
            );
        };

        try {
            /*
             * `columns` can be a function. This lets us normalize the
             * header names while still allowing csv-parse to correctly
             * construct objects.
             */
            const parser = parse({
                columns: hasHeaderRow ? (headers) => {
                    if (!headers || headers.length === 0) {
                        throw new Error(
                            "CAMS CSV does not contain a header row"
                        );
                    }

                    return headers.map(
                        normalizeColumnName
                    );
                } : CAMS_CSV_HEADERS,

                /*
                 * CAMS encloses fields using single quotes rather than
                 * the normal CSV double quotes.
                 */
                quote: CAMS_CSV_QUOTE,
                escape: CAMS_CSV_QUOTE,

                /*
                 * Ignore completely empty lines.
                 */
                skip_empty_lines: true,

                /*
                 * Remove surrounding whitespace from unquoted fields.
                 */
                trim: true,

                /*
                 * Handle UTF-8 BOM if present.
                 */
                bom: true,

                /*
                 * Do not silently accept rows having a different number
                 * of columns from the header.
                 *
                 * This protects transaction integrity.
                 */
                relax_column_count: false,

                /*
                 * Keep all fields as strings.
                 *
                 * Financial and identifier type conversion should happen
                 * later according to the Prisma/database schema.
                 */
                cast: false,

                /*
                 * Prevent unexpectedly huge individual CSV records from
                 * consuming excessive memory.
                 */
                max_record_size: 10 * 1024 * 1024,
            });

            parser.on(
                "data",
                (record) => {
                    records.push(
                        normalizeCsvRecord(record)
                    );
                }
            );

            parser.on(
                "error",
                (error) => {
                    fail(error);
                }
            );

            parser.on(
                "end",
                () => {
                    if (parserFinished) {
                        return;
                    }

                    parserFinished = true;

                    /*
                     * A valid CSV containing only headers technically
                     * parses successfully. We return an empty array rather
                     * than treating it as a malformed CSV.
                     *
                     * The DB layer can decide whether an empty report
                     * should be considered a valid zero-transaction report.
                     */
                    resolve(records);
                }
            );

            fileStream = fs.createReadStream(
                csvPath,
                {
                    encoding: "utf8",
                }
            );

            fileStream.on(
                "error",
                (error) => {
                    fail(
                        new CustomError(
                            500,
                            `Failed to read CAMS CSV file: ${error.message}`
                        )
                    );
                }
            );

            /*
             * Pipe the file stream into csv-parse so that the entire CSV
             * does not need to be loaded into memory as raw text.
             */
            fileStream
                .pipe(createCamsQuoteNormalizer())
                .pipe(parser);
        } catch (error) {
            fail(error);
        }
    });
}

module.exports = {
    isProcessableReport,
    validateCsvFile,
    normalizeColumnName,
    normalizeCsvValue,
    normalizeCsvRecord,
    createCamsQuoteNormalizer,
    hasCamsHeaderRow,
    parseCsvFile,
};
