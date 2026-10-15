/**
 * CAMS ZIP report processing helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Once we know a CAMS report's download link (from `emailService.js`),
 * this file contains everything needed to turn that link into an
 * extracted CSV file on disk: creating a private temp folder for the
 * report, downloading the ZIP, unlocking it with 7-Zip using the shared
 * report password, and locating the CSV file inside it.
 *
 * These helpers are used by `services/reportService.js`, which is the
 * file responsible for deciding whether a report is even worth
 * downloading and for assembling the final success/failure result object
 * for each report.
 */

import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

import CustomError from "../customError.js";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------

/** Root folder (inside the OS temp directory) that holds all in-flight CAMS report workspaces. */
const TEMP_ROOT = path.join(
    os.tmpdir(),
    "cams-reports"
);

/** Optional override path to 7z.exe, read from the environment. */
const SEVEN_ZIP_PATH = process.env.CAMS_7ZIP_PATH || null;

/**
 * Resolve a non-interactive archive extractor. CAMS_REPORT_PASSWORD remains
 * the only password source; this only chooses the installed executable.
 *
 * @returns {Promise<{executable: string, type: string}>}
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
// Workspace / identity helpers
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
        reportFromDate:
            report?.reportFromDate || null,
        reportToDate:
            report?.reportToDate || null,
        toEmail:
            report?.toEmail || null,
        arnNo:
            report?.arnNo || null,
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

export {
    TEMP_ROOT,
    resolveArchiveExtractor,
    createReportTempDirectory,
    hasValidDownloadUrl,
    buildReportIdentifiers,
    buildReportPaths,
    buildReportResult,
    downloadReport,
    extractReport,
    findCsvFile,
};
