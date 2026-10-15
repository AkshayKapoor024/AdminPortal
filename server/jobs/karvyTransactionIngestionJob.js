/**
 * Daily Karvy Transaction Feeds Report email → ZIP → CSV → PostgreSQL pipeline.
 *
 * This file only owns *scheduling* and *overlap protection*. The actual
 * pipeline logic lives in `services/karvy_transactions/karvyIngestionService.js`.
 */
import cron from "node-cron";
import { runKarvyTransactionIngestion as runPipeline } from '../services/karvy_transactions/karvyIngestionService.js';

/** True while a pipeline run is in progress, to prevent overlapping runs. */
let running = false;

/**
 * Run the Karvy transactions ingestion pipeline, unless a previous run
 * is still in progress (in which case this call is skipped rather than
 * queued).
 *
 * @returns {Promise<object>} the pipeline result, or `{ skipped: true }`
 */
async function runKarvyTransactionIngestion() {
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

// Every day at 8:30 AM India time, run the Karvy transactions pipeline
// — 30 minutes after the CAMS transactions job (8:00 AM), so the two
// never contend for the same mailbox lock. Any error is already logged
// inside the service itself, so it's intentionally swallowed here to
// avoid an unhandled rejection crashing the process.
cron.schedule("30 8 * * *", () => {
    runKarvyTransactionIngestion().catch(() => {});
}, { timezone: "Asia/Kolkata" });

export {runKarvyTransactionIngestion}