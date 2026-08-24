/**
 * Structured CAMS cron logging. Only sanitized outcomes, counts, durations,
 * and error messages are written—never passwords or email credentials.
 */
const fs = require("fs/promises");
const path = require("path");

const LOG_DIRECTORY = path.join(__dirname, "..", "logs");

async function logCamsJob(level, message, details = {}) {
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details });
    await fs.mkdir(LOG_DIRECTORY, { recursive: true });
    await fs.appendFile(path.join(LOG_DIRECTORY, "cams-ingestion.log"), `${entry}\n`, "utf8");
    console[level === "error" ? "error" : "log"](entry);
}

module.exports = { logCamsJob };
