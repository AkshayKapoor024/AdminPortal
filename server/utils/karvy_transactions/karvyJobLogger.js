/**
 * Structured Karvy transactions ingestion logging. Mirrors
 * `cams_transactions/jobLogger.js` in shape (only sanitized outcomes,
 * counts, durations, and error messages — never passwords or email
 * credentials), written to its own log file.
 *
 * NOTE: `utils/cams_transactions/jobLogger.js` resolves its log
 * directory as `path.join(__dirname, "..", "logs")`, which — because
 * that file lives one folder deeper than the original flat layout it
 * was written for — actually points at `utils/logs/`, not the real
 * `server/logs/` folder. That's a pre-existing issue in that file,
 * left untouched here per instructions; this file uses the correct
 * two-levels-up path so Karvy's own log actually lands in `server/logs/`.
 */
import fs from "fs/promises";
import path from "path";

const LOG_DIRECTORY = path.join(import.meta.dirname, "..", "..", "logs");

/**
 * Append one structured log line (as JSON) to
 * `logs/karvy-transactions-ingestion.log`.
 *
 * @param {"info"|"error"} level
 * @param {string} message a short human-readable summary
 * @param {object} [details] extra sanitized fields (counts, timing, etc.)
 */
async function logKarvyTransactionsJob(level, message, details = {}) {
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details });
    await fs.mkdir(LOG_DIRECTORY, { recursive: true });
    await fs.appendFile(path.join(LOG_DIRECTORY, "karvy-transactions-ingestion.log"), `${entry}\n`, "utf8");
}

export { logKarvyTransactionsJob };
