/**
 * Monthly AMFI industry AUM ingestion cron job.
 *
 * This file only owns *scheduling* and *overlap protection*. The actual
 * pipeline logic lives in `services/amfiIngestionService.js`. It runs
 * monthly rather than exactly "every 4 months" because AMFI quarters
 * aren't published on a perfectly predictable date — a monthly check is
 * cheap (already-completed quarters are skipped almost instantly via
 * the AumImport status check) and self-healing if a quarter's data was
 * published later than expected.
 */
const cron = require("node-cron");
const { runAmfiIngestion: runPipeline } = require("../services/industry_aum/amfiIngestionService");

/** True while a run is in progress, to prevent overlapping runs. */
let running = false;

/**
 * Run the AMFI ingestion pipeline, unless a previous run is still in
 * progress (in which case this call is skipped rather than queued).
 *
 * @returns {Promise<object>} the pipeline summary, or `{ skipped: true }`
 */
async function runAmfiIngestion() {
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

// On the 1st of every month at 8:00 AM India time, check for and store
// any newly published AMFI quarterly data. Any error is already logged
// inside the service itself, so it's intentionally swallowed here to
// avoid an unhandled rejection crashing the process.
cron.schedule("0 8 1 * *", () => {
    runAmfiIngestion().catch(() => {});
}, { timezone: "Asia/Kolkata" });

module.exports = { runAmfiIngestion };
