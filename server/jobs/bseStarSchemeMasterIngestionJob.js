/**
 * Daily BSE Star Scheme Master Ingestion Job.
 *
 * Runs daily at 01:00 AM IST to crawl and update the BSE Star Scheme Master list in DB.
 */

import cron from "node-cron";
import { syncBseSchemeMasterData } from "../services/bse_star_master/bseStarSchemeMasterIngestionService.js";

let running = false;

async function runBseStarSchemeMasterIngestion() {
    if (running) {
        console.log("[BseSchemeMasterJob] Ingestion job is already running — skipping duplicate trigger");
        return { skipped: true, reason: "already-running" };
    }

    running = true;
    try {
        return await syncBseSchemeMasterData();
    } catch (error) {
        console.error(`[BseSchemeMasterJob] Scheduled ingestion failed: ${error.message}`);
        throw error;
    } finally {
        running = false;
    }
}

// Schedule daily at 01:00 AM IST
cron.schedule(
    "0 1 * * *",
    () => {
        runBseStarSchemeMasterIngestion().catch(() => {});
    },
    { timezone: "Asia/Kolkata" }
);

export { runBseStarSchemeMasterIngestion };
