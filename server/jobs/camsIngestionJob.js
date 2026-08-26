/** Daily CAMS email → ZIP → CSV → PostgreSQL pipeline. */
const cron = require("node-cron");
const { runCamsIngestion: runPipeline } = require("../services/camsIngestionService");

let running = false;

async function runCamsIngestion() {
    if (running) {
        return { skipped: true, reason: "already-running" };
    }

    running = true;
    try {
        return await runPipeline();
    } finally {
        running = false;
    }
}

cron.schedule("0 8 * * *", () => {
    runCamsIngestion().catch(() => {});
}, { timezone: "Asia/Kolkata" });

module.exports = { runCamsIngestion };
