/**
 * Daily Karvy WBR22 Company AUM scheduler.
 *
 * Scheduling and overlap protection live here; the service owns all
 * pipeline work. Runs at a different time from the CAMS WBR22 job
 * (11:30 AM) so the two never contend for the same mailbox lock.
 */
import cron from "node-cron";
import { runKarvyWbr22AumIngestion as runPipeline } from "../services/karvy_wbr22_automation/karvyWbr22AumIngestionService.js";

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

export { runKarvyWbr22AumIngestion };
