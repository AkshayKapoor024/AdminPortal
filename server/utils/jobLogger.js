/**
 * Structured CAMS cron logging. Only sanitized outcomes, counts, durations,
 * and error messages are written—never passwords or email credentials.
 */
const fs = require("fs/promises");
const path = require("path");

/** All CAMS ingestion log entries are appended to this single log file. */
const LOG_DIRECTORY = path.join(__dirname, "..", "logs");

/**
 * Append one structured log line (as JSON) to `logs/cams-ingestion.log`.
 *
 * @param {"info"|"error"} level
 * @param {string} message  a short human-readable summary
 * @param {object} [details] extra sanitized fields (counts, timing, etc.)
 */
async function logCamsJob(level, message, details = {}) {
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details });
    await fs.mkdir(LOG_DIRECTORY, { recursive: true });
    await fs.appendFile(path.join(LOG_DIRECTORY, "cams-ingestion.log"), `${entry}\n`, "utf8");
}

module.exports = { logCamsJob };
