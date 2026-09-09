/**
 * Daily WBR22 Company AUM scheduler.
 *
 * Scheduling and overlap protection live here; the service owns all pipeline
 * work. The 11:30 AM India-time schedule gives the CAMS emails time to arrive.
 */
const cron = require("node-cron");
const { runWbr22AumIngestion: runPipeline } = require("../services/cams_wbr22_automation/wbr22AumIngestionService");

let running = false;

async function runWbr22AumIngestion() {
    if (running) return { skipped: true, reason: "already-running" };

    running = true;
    try {
        return await runPipeline();
    } finally {
        running = false;
    }
}

cron.schedule("30 11 * * *", () => {
    runWbr22AumIngestion().catch(() => {});
}, { timezone: "Asia/Kolkata" });

module.exports = { runWbr22AumIngestion };
