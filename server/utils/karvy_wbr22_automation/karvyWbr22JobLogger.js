/** Append safe, structured status entries for the Karvy WBR22 Company AUM job. Mirrors wbr22AumJobLogger.js, separate log file. */
import fs from "fs/promises";
import path from "path";

async function logKarvyWbr22AumJob(level, message, details = {}) {
    const directory = path.join(import.meta.dirname, "..", "..", "logs");
    await fs.mkdir(directory, { recursive: true });
    await fs.appendFile(
        path.join(directory, "karvy-wbr22-aum-ingestion.log"),
        `${JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details })}\n`,
        "utf8"
    );
}

export { logKarvyWbr22AumJob };
