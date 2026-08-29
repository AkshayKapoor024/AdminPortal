/**
 * Daily CAMS email → ZIP → CSV → PostgreSQL pipeline.
 *
 * This file only owns *scheduling* and *overlap protection*. The actual
 * pipeline logic lives in `services/camsIngestionService.js`.
 */
const cron = require("node-cron");
const { runCamsIngestion: runPipeline } = require("../services/camsIngestionService");

/** True while a pipeline run is in progress, to prevent overlapping runs. */
let running = false;

/**
 * Run the CAMS ingestion pipeline, unless a previous run is still in
 * progress (in which case this call is skipped rather than queued).
 *
 * @returns {Promise<object>} the pipeline result, or `{ skipped: true }`
 */
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

// Every day at 8:00 AM India time, run the CAMS pipeline. Any error is
// already logged inside the service itself, so it's intentionally
// swallowed here to avoid an unhandled rejection crashing the process.
cron.schedule("0 8 * * *", () => {
    runCamsIngestion().catch(() => {});
}, { timezone: "Asia/Kolkata" });

module.exports = { runCamsIngestion };
