/** Append safe, structured status entries for the Karvy WBR22 Company AUM job. Mirrors wbr22AumJobLogger.js, separate log file. */
const fs = require("fs/promises");
const path = require("path");

async function logKarvyWbr22AumJob(level, message, details = {}) {
    const directory = path.join(__dirname, "..", "..", "logs");
    await fs.mkdir(directory, { recursive: true });
    await fs.appendFile(
        path.join(directory, "karvy-wbr22-aum-ingestion.log"),
        `${JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details })}\n`,
        "utf8"
    );
}

module.exports = { logKarvyWbr22AumJob };
