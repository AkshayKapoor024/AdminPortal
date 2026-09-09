/**
 * Structured AMFI ingestion logging.
 *
 * Same idea as `utils/jobLogger.js` (used by the CAMS pipeline), kept as
 * a separate file/log so the two pipelines never share state and the
 * existing CAMS logger is left completely untouched.
 */
const fs = require("fs/promises");
const path = require("path");

/** All AMFI ingestion log entries are appended to this single log file. */
const LOG_DIRECTORY = path.join(__dirname, "..", "logs");

/**
 * Append one structured log line (as JSON) to `logs/amfi-ingestion.log`.
 *
 * @param {"info"|"error"} level
 * @param {string} message a short human-readable summary
 * @param {object} [details] extra fields (counts, timing, etc.)
 */
async function logAmfiJob(level, message, details = {}) {
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details });
    await fs.mkdir(LOG_DIRECTORY, { recursive: true });
    await fs.appendFile(path.join(LOG_DIRECTORY, "amfi-ingestion.log"), `${entry}\n`, "utf8");
}

module.exports = { logAmfiJob };
