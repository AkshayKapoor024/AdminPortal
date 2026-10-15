/** Append safe, structured status entries for the WBR22 Company AUM job. */
import fs from "fs/promises";
import path from "path";

async function logWbr22AumJob(level, message, details = {}) {
    const directory = path.join(import.meta.dirname, "..", "logs");
    await fs.mkdir(directory, { recursive: true });
    await fs.appendFile(
        path.join(directory, "wbr22-aum-ingestion.log"),
        `${JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details })}\n`,
        "utf8"
    );
}

export { logWbr22AumJob };
