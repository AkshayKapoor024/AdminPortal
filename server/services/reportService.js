/**
 * CAMS ZIP report processing service.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * This is the middle step of the pipeline: it takes each report object
 * produced by `emailService.js` (which has a download link but no file
 * yet), downloads its password-protected ZIP into its own private temp
 * folder, unlocks it, and finds the CSV file inside. It never reads or
 * parses the CSV's contents and never touches the database — it only
 * deals with files.
 *
 * Requirements: validate report identity/URL, download and password-extract an
 * isolated ZIP workspace, locate its CSV, and return structured success or
 * failure results without parsing rows or writing to PostgreSQL.
 *
 * All of the low-level download/extraction/filesystem logic lives in
 * `utils/camsReportProcessingUtils.js`. This file only contains the two
 * exported "main" functions: `processSingleReport` (handle one report)
 * and `processCamsReports` (handle a batch of reports).
 */

const CustomError = require("../utils/customError");
const {
    createReportTempDirectory,
    hasValidDownloadUrl,
    buildReportResult,
    downloadReport,
    extractReport,
    findCsvFile,
} = require("../utils/camsReportProcessingUtils");
const path = require("path");

// ---------------------------------------------------------------------
// Single report processing
// ---------------------------------------------------------------------

/**
 * Process one CAMS report.
 *
 * The function always returns a structured processing result for
 * expected report-level failures. This allows the caller to retain
 * the report identity even when downloading, extraction, or CSV
 * discovery fails.
 *
 * @param {object} report
 * @param {string} password
 * @returns {Promise<object>}
 */
async function processSingleReport(
    report,
    password
) {
    // ---------------------------------------------------------------
    // Basic report validation
    // ---------------------------------------------------------------

    if (!report) {
        throw new CustomError(
            400,
            "CAMS report data is required"
        );
    }

    // ---------------------------------------------------------------
    // Download URL validation
    // ---------------------------------------------------------------

    if (!hasValidDownloadUrl(report)) {
        return buildReportResult({
            report,
            status: "SKIPPED",
            error:
                "CAMS report does not contain a valid download URL",
        });
    }

    // ---------------------------------------------------------------
    // Report request number validation
    // ---------------------------------------------------------------

    if (!report.reportRequestNumber) {
        return buildReportResult({
            report,
            status: "FAILED",
            error:
                "CAMS report request number is missing",
        });
    }

    // ---------------------------------------------------------------
    // Password validation
    // ---------------------------------------------------------------

    if (!password) {
        return buildReportResult({
            report,
            status: "FAILED",
            error:
                "CAMS report extraction password is missing",
        });
    }

    // ---------------------------------------------------------------
    // Create isolated temporary directory
    // ---------------------------------------------------------------

    let tempDirectory = null;
    let zipPath = null;
    let csvPath = null;

    try {
        tempDirectory =
            await createReportTempDirectory(
                report.reportRequestNumber
            );

        zipPath =
            path.join(
                tempDirectory,
                `${report.reportRequestNumber}.zip`
            );

        // -----------------------------------------------------------
        // Download ZIP
        // -----------------------------------------------------------

        await downloadReport(
            report.downloadUrl,
            zipPath
        );

        // -----------------------------------------------------------
        // Extract ZIP
        // -----------------------------------------------------------

        await extractReport(
            zipPath,
            tempDirectory,
            password
        );

        // -----------------------------------------------------------
        // Find CSV
        // -----------------------------------------------------------

        csvPath =
            await findCsvFile(
                tempDirectory
            );

        // -----------------------------------------------------------
        // Successful result
        // -----------------------------------------------------------

        return buildReportResult({
            report,
            status: "EXTRACTED",
            error: null,
            paths: {
                tempDirectory,
                zipPath,
                csvPath,
            },
        });
    } catch (error) {
        // -----------------------------------------------------------
        // Expected CAMS/report processing failure
        // -----------------------------------------------------------

        const errorMessage =
            error instanceof CustomError
                ? error.message
                : `Failed to process CAMS report ${report.reportRequestNumber}: ${error.message}`;

        return buildReportResult({
            report,
            status: "FAILED",
            error: errorMessage,
            paths: {
                tempDirectory,
                zipPath,
                csvPath,
            },
        });
    }
}

// ---------------------------------------------------------------------
// Multiple report processing
// ---------------------------------------------------------------------

/**
 * Process multiple CAMS reports.
 *
 * Every input report produces exactly one result object.
 *
 * This means the returned array maintains a direct relationship with
 * the reports that were supplied to this function.
 *
 * @param {Array<object>} reports
 * @param {string} password
 * @returns {Promise<Array<object>>}
 */
async function processCamsReports(
    reports,
    password
) {
    if (!Array.isArray(reports)) {
        throw new CustomError(
            400,
            "CAMS reports must be provided as an array"
        );
    }

    if (!password) {
        throw new CustomError(
            400,
            "CAMS report password is required"
        );
    }

    const results = [];

    for (const report of reports) {
        // -----------------------------------------------------------
        // Process one report.
        //
        // processSingleReport() returns a structured result even when
        // the report cannot be processed.
        // -----------------------------------------------------------

        const result =
            await processSingleReport(
                report,
                password
            );

        results.push(result);
    }

    return results;
}

// ---------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------

module.exports = {
    processCamsReports,
    processSingleReport,
};
