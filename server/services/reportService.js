/**
 * CAMS ZIP report processing service.
 *
 * Requirements: validate report identity/URL, download and password-extract an
 * isolated ZIP workspace, locate its CSV, and return structured success or
 * failure results without parsing rows or writing to PostgreSQL.
 */

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const CustomError = require("../utils/customError");

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------

const TEMP_ROOT = path.join(
    os.tmpdir(),
    "cams-reports"
);

const SEVEN_ZIP_PATH = process.env.CAMS_7ZIP_PATH || null;

/**
 * Resolve a non-interactive archive extractor. CAMS_REPORT_PASSWORD remains
 * the only password source; this only chooses the installed executable.
 */
async function resolveArchiveExtractor() {
    const candidates = [
        SEVEN_ZIP_PATH && { executable: SEVEN_ZIP_PATH, type: "7zip" },
        { executable: "C:\\Program Files\\7-Zip\\7z.exe", type: "7zip" },
        { executable: "C:\\Program Files (x86)\\7-Zip\\7z.exe", type: "7zip" },
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            await fs.access(candidate.executable);
            return candidate;
        } catch (_) {
            // Try the next standard installation path.
        }
    }

    throw new CustomError(
        500,
        "No supported archive extractor was found. Install 7-Zip or set CAMS_7ZIP_PATH."
    );
}

// ---------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------

/**
 * Create a unique directory for a single CAMS report.
 *
 * @param {string} reportRequestNumber
 * @returns {Promise<string>}
 */
async function createReportTempDirectory(
    reportRequestNumber
) {
    const safeRequestNumber =
        String(reportRequestNumber || "unknown")
            .replace(/[^a-zA-Z0-9_-]/g, "_");

    const randomId =
        crypto.randomBytes(6).toString("hex");

    const directoryName =
        `${safeRequestNumber}-${randomId}`;

    const directoryPath =
        path.join(
            TEMP_ROOT,
            directoryName
        );

    try {
        await fs.mkdir(
            directoryPath,
            {
                recursive: true,
            }
        );

        return directoryPath;
    } catch (error) {
        throw new CustomError(
            500,
            `Failed to create temporary directory for CAMS report: ${error.message}`
        );
    }
}

/**
 * Check whether a CAMS report contains a usable download URL.
 *
 * @param {object} report
 * @returns {boolean}
 */
function hasValidDownloadUrl(report) {
    if (!report?.downloadUrl) {
        return false;
    }

    const value =
        String(report.downloadUrl).trim();

    if (!value) {
        return false;
    }

    // Ignore common placeholder values.
    if (
        /^(?:na|n\/a|null|undefined|none)$/i.test(value)
    ) {
        return false;
    }

    // Ensure the value is a valid HTTP/HTTPS URL.
    try {
        const url = new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );
    } catch (_) {
        return false;
    }
}

/**
 * Build the identifying information for a report.
 *
 * Keeping these fields together makes the result self-contained and
 * allows downstream services to identify a report even when processing
 * fails before a ZIP/CSV path is created.
 *
 * @param {object} report
 * @returns {object}
 */
function buildReportIdentifiers(report) {
    return {
        messageId: report?.messageId || null,
        reportRequestNumber:
            report?.reportRequestNumber || null,
        reportNumber:
            report?.reportNumber || null,
        dispatchDateTime:
            report?.dispatchDateTime || null,
        toEmail:
            report?.toEmail || null,
    };
}

/**
 * Build the path information for a processed report.
 *
 * @param {object} paths
 * @returns {object}
 */
function buildReportPaths({
    tempDirectory = null,
    zipPath = null,
    csvPath = null,
} = {}) {
    return {
        tempDirectory,
        zipPath,
        csvPath,
    };
}

/**
 * Build a standardized report processing result.
 *
 * @param {object} options
 * @returns {object}
 */
function buildReportResult({
    report,
    status,
    error = null,
    paths = {},
}) {
    return {
        identifiers:
            buildReportIdentifiers(report),

        paths:
            buildReportPaths(paths),

        status,

        error:
            error || null,
    };
}

// ---------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------

/**
 * Download a CAMS ZIP file.
 *
 * @param {string} downloadUrl
 * @param {string} destinationPath
 * @returns {Promise<string>}
 */
async function downloadReport(
    downloadUrl,
    destinationPath
) {
    if (!downloadUrl) {
        throw new CustomError(
            400,
            "CAMS report download URL is missing"
        );
    }

    let response;

    try {
        response =
            await fetch(downloadUrl);
    } catch (error) {
        throw new CustomError(
            502,
            `Failed to connect to CAMS download URL: ${error.message}`
        );
    }

    if (!response.ok) {
        throw new CustomError(
            response.status >= 500
                ? 502
                : response.status,
            `CAMS report download failed with HTTP status ${response.status}`
        );
    }

    try {
        const buffer =
            Buffer.from(
                await response.arrayBuffer()
            );

        if (buffer.length === 0) {
            throw new CustomError(
                502,
                "CAMS returned an empty report file"
            );
        }

        await fs.writeFile(
            destinationPath,
            buffer
        );

        return destinationPath;
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }

        throw new CustomError(
            500,
            `Failed to save downloaded CAMS report: ${error.message}`
        );
    }
}

// ---------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------

/**
 * Extract a password-protected ZIP archive using 7-Zip.
 *
 * @param {string} zipPath
 * @param {string} outputDirectory
 * @param {string} password
 * @returns {Promise<void>}
 */
async function extractReport(
    zipPath,
    outputDirectory,
    password
) {
    if (!password) {
        throw new CustomError(
            400,
            "CAMS report extraction password is missing"
        );
    }

    try {
        const extractor = await resolveArchiveExtractor();
        const argumentsForExtractor = [
            "x",
            zipPath,
            `-o${outputDirectory}`,
            `-p${password}`,
            "-y",
        ];

        await execFileAsync(
            extractor.executable,
            argumentsForExtractor,
            {
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024,
            }
        );
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }

        if (error.code === "ENOENT") {
            throw new CustomError(
                500,
                "CAMS archive extractor could not be started. Set CAMS_7ZIP_PATH to a valid 7z.exe path."
            );
        }

        // Do not expose the password or raw 7-Zip output.
        throw new CustomError(
            422,
            "Failed to extract CAMS report. The ZIP may be corrupted or the password may be incorrect."
        );
    }
}

// ---------------------------------------------------------------------
// CSV discovery
// ---------------------------------------------------------------------

/**
 * Locate the CSV file produced after ZIP extraction.
 *
 * @param {string} directory
 * @returns {Promise<string>}
 */
async function findCsvFile(directory) {
    async function scan(currentDirectory) {
        let entries;

        try {
            entries =
                await fs.readdir(
                    currentDirectory,
                    {
                        withFileTypes: true,
                    }
                );
        } catch (error) {
            throw new CustomError(
                500,
                `Failed to inspect extracted CAMS report: ${error.message}`
            );
        }

        for (const entry of entries) {
            const fullPath =
                path.join(
                    currentDirectory,
                    entry.name
                );

            if (entry.isDirectory()) {
                const nestedResult =
                    await scan(fullPath);

                if (nestedResult) {
                    return nestedResult;
                }

                continue;
            }

            if (
                entry.isFile() &&
                path.extname(entry.name).toLowerCase() === ".csv"
            ) {
                return fullPath;
            }
        }

        return null;
    }

    const csvPath =
        await scan(directory);

    if (!csvPath) {
        throw new CustomError(
            422,
            "CAMS report was extracted successfully, but no CSV file was found"
        );
    }

    return csvPath;
}

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
