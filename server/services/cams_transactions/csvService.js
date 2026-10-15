/**
 * CAMS CSV parsing service.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * By the time a report reaches this file, its ZIP has already been
 * downloaded and extracted somewhere on disk (that's `reportService.js`'s
 * job). This file takes each extracted report, reads its CSV file, and
 * turns it into an array of transaction objects that the database service
 * can store. A report that failed earlier (bad download, bad password,
 * etc.) is passed straight through with its failure preserved, instead of
 * being sent to the CSV parser.
 *
 * Requirements: accept CAMS single-quoted CSVs (including unescaped internal
 * apostrophes), preserve all values as strings, reject malformed row shapes,
 * and return records with their report identifiers for database persistence.
 *
 * All of the low-level CSV parsing/normalization logic lives in
 * `utils/camsCsvParsingUtils.js`. This file only contains the two exported
 * "main" functions: `processCsvReport` (handle one report) and
 * `processCamsCsvReports` (handle a batch of reports).
 */

import CustomError from "../../utils/customError.js";
import {
    isProcessableReport,
    parseCsvFile,
} from "../../utils/cams_transactions/camsCsvParsingUtils.js";

// ---------------------------------------------------------------------
// Single report processing
// ---------------------------------------------------------------------

/**
 * Parse one report's CSV and attach the resulting transaction records
 * to the report information.
 *
 * Reports that failed during download/extraction are preserved with
 * their identifiers, paths, status and error. They receive an empty
 * records array.
 *
 * @param {object} report
 * @returns {Promise<object>}
 */
async function processCsvReport(report) {
    if (!report) {
        throw new CustomError(
            400,
            "CAMS report data is required"
        );
    }

    /*
     * Reports that failed before CSV processing are not parsed.
     * Their identity and original error are preserved so the DB layer
     * can persist the report status.
     */
    if (!isProcessableReport(report)) {
        return {
            identifiers: {
                ...(report.identifiers || {}),
            },

            paths: {
                ...(report.paths || {}),
            },

            status:
                report.status || "FAILED",

            error:
                report.error ||
                "CAMS report cannot be processed because CSV extraction was not successful",

            records: [],
        };
    }

    try {
        const reportRequestNumber =
            report.identifiers?.reportRequestNumber ||
            "unknown";

        const records =
            await parseCsvFile(
                report.paths.csvPath
            );

        return {
            identifiers: {
                ...(report.identifiers || {}),
            },

            paths: {
                ...(report.paths || {}),
            },

            status: "PARSED",

            /*
             * No parsing error occurred.
             */
            error: null,

            /*
             * One object = one CAMS transaction.
             */
            records,
        };
    } catch (error) {
        const errorMessage =
            error instanceof CustomError
                ? error.message
                : `Failed to process CAMS CSV: ${error.message}`;

        return {
            identifiers: {
                ...(report.identifiers || {}),
            },

            paths: {
                ...(report.paths || {}),
            },

            status: "FAILED",

            error: errorMessage,

            /*
             * Never return partially parsed transaction data after a
             * parser failure. This prevents the DB layer from accidentally
             * storing incomplete data.
             */
            records: [],
        };
    }
}

// ---------------------------------------------------------------------
// Multiple report processing
// ---------------------------------------------------------------------

/**
 * Parse CSV files for multiple CAMS reports.
 *
 * Each input report produces exactly one output object.
 *
 * This guarantees that report metadata and its transaction records
 * always remain associated with each other.
 *
 * One failed report does not prevent other reports from being parsed.
 *
 * @param {Array<object>} reports
 * @returns {Promise<Array<object>>}
 */
async function processCamsCsvReports(reports) {
    if (!Array.isArray(reports)) {
        throw new CustomError(
            400,
            "CAMS reports must be provided as an array"
        );
    }

    const results = [];

    for (const report of reports) {
        try {
            const result =
                await processCsvReport(report);

            results.push(result);
        } catch (error) {
            const errorMessage =
                error instanceof CustomError
                    ? error.message
                    : `Failed to process CAMS CSV report: ${error.message}`;

            /*
             * Preserve the report even if an unexpected error occurs.
             * This is important because the DB layer needs the report
             * identifiers even when transaction parsing fails.
             */
            results.push({
                identifiers: {
                    ...(report?.identifiers || {}),
                },

                paths: {
                    ...(report?.paths || {}),
                },

                status: "FAILED",

                error: errorMessage,

                records: [],
            });
        }
    }

    return results;
}

// ---------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------

export {
    processCsvReport,
    processCamsCsvReports,
};
