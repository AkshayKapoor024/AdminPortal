/**
 * Daily WBR22 Company AUM scheduler.
 *
 * Scheduling and overlap protection live here; the service owns all pipeline
 * work. The 11:30 AM India-time schedule gives the CAMS emails time to arrive.
 */
import cron from "node-cron";
import { runWbr22AumIngestion as runPipeline } from "../services/cams_wbr22_automation/wbr22AumIngestionService.js";

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

export { runWbr22AumIngestion };
