/**
 * Daily Karvy WBR22 Company AUM scheduler.
 *
 * Scheduling and overlap protection live here; the service owns all
 * pipeline work. Runs at a different time from the CAMS WBR22 job
 * (11:30 AM) so the two never contend for the same mailbox lock.
 */
const cron = require("node-cron");
const { runKarvyWbr22AumIngestion: runPipeline } = require("../services/karvy_wbr22_automation/karvyWbr22AumIngestionService");

let running = false;

async function runKarvyWbr22AumIngestion() {
    if (running) return { skipped: true, reason: "already-running" };

    running = true;
    try {
        return await runPipeline();
    } finally {
        running = false;
    }
}

cron.schedule("0 12 * * *", () => {
    runKarvyWbr22AumIngestion().catch(() => {});
}, { timezone: "Asia/Kolkata" });

module.exports = { runKarvyWbr22AumIngestion };
