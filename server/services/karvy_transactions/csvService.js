/**
 * Karvy transactions CSV parsing service.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * Mirrors `cams_transactions/csvService.js` exactly in structure. By
 * the time a report reaches this file, its ZIP has already been
 * downloaded and extracted (that's the shared, provider-agnostic
 * `cams_wbr22_automation/reportService.js`'s job). This file reads each
 * extracted CSV and turns it into an array of transaction objects the
 * database service can store. A report that failed earlier (bad
 * download, bad password) is passed straight through with its failure
 * preserved, instead of being sent to the CSV parser.
 *
 * All of the low-level CSV parsing/normalization logic lives in
 * `utils/karvy_transactions/karvyCsvParsingUtils.js`. This file only
 * contains the two exported "main" functions: `processKarvyCsvReport`
 * (handle one report) and `processKarvyCsvReports` (handle a batch).
 */

const CustomError = require("../../utils/customError");
const {
    isProcessableReport,
    parseCsvFile,
} = require("../../utils/karvy_transactions/karvyCsvParsingUtils");

// ---------------------------------------------------------------------
// Single report processing
// ---------------------------------------------------------------------

/**
 * Parse one report's CSV and attach the resulting transaction records
 * to the report information.
 *
 * @param {object} report
 * @returns {Promise<object>}
 */
async function processKarvyCsvReport(report) {
    if (!report) {
        throw new CustomError(400, "Karvy report data is required");
    }

    // Reports that failed before CSV processing are not parsed. Their
    // identity and original error are preserved so the DB layer can
    // persist the report status.
    if (!isProcessableReport(report)) {
        return {
            identifiers: { ...(report.identifiers || {}) },
            paths: { ...(report.paths || {}) },
            status: report.status || "FAILED",
            error:
                report.error ||
                "Karvy report cannot be processed because CSV extraction was not successful",
            records: [],
        };
    }

    try {
        const records = await parseCsvFile(report.paths.csvPath);

        return {
            identifiers: { ...(report.identifiers || {}) },
            paths: { ...(report.paths || {}) },
            status: "PARSED",
            error: null,
            // One object = one Karvy transaction.
            records,
        };
    } catch (error) {
        const errorMessage =
            error instanceof CustomError ? error.message : `Failed to process Karvy CSV: ${error.message}`;

        return {
            identifiers: { ...(report.identifiers || {}) },
            paths: { ...(report.paths || {}) },
            status: "FAILED",
            error: errorMessage,
            // Never return partially parsed transaction data after a
            // parser failure — this prevents the DB layer from
            // accidentally storing incomplete data.
            records: [],
        };
    }
}

// ---------------------------------------------------------------------
// Multiple report processing
// ---------------------------------------------------------------------

/**
 * Parse CSV files for multiple Karvy reports. Each input report
 * produces exactly one output object, and one failed report never
 * prevents the others from being parsed.
 *
 * @param {Array<object>} reports
 * @returns {Promise<Array<object>>}
 */
async function processKarvyCsvReports(reports) {
    if (!Array.isArray(reports)) {
        throw new CustomError(400, "Karvy reports must be provided as an array");
    }

    const results = [];

    for (const report of reports) {
        try {
            results.push(await processKarvyCsvReport(report));
        } catch (error) {
            const errorMessage =
                error instanceof CustomError
                    ? error.message
                    : `Failed to process Karvy CSV report: ${error.message}`;

            // Preserve the report even if an unexpected error occurs —
            // the DB layer still needs the report identifiers even when
            // transaction parsing fails.
            results.push({
                identifiers: { ...(report?.identifiers || {}) },
                paths: { ...(report?.paths || {}) },
                status: "FAILED",
                error: errorMessage,
                records: [],
            });
        }
    }

    return results;
}

module.exports = { processKarvyCsvReport, processKarvyCsvReports };
