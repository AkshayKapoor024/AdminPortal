/** Daily CAMS email → ZIP → CSV → PostgreSQL pipeline. */
const cron = require("node-cron");
const { retrieveCamsEmails } = require("../services/emailService");
const { processCamsReports } = require("../services/reportService");
const { processCamsCsvReports } = require("../services/csvService");
const { persistCamsReports } = require("../services/camsDatabaseService");
const { logCamsJob } = require("../utils/jobLogger");

let running = false;

async function runCamsIngestion() {
    if (running) {
        await logCamsJob("warn", "CAMS ingestion skipped because a previous run is still active");
        return { skipped: true, reason: "already-running" };
    }

    running = true;
    const startedAt = Date.now();
    try {
        if (!process.env.CAMS_REPORT_PASSWORD) {
            throw new Error("CAMS_REPORT_PASSWORD is not configured");
        }
        const emails = await retrieveCamsEmails();
        const extracted = await processCamsReports(emails, process.env.CAMS_REPORT_PASSWORD);
        const parsed = await processCamsCsvReports(extracted);
        const reports = await persistCamsReports(parsed);
        const summary = reports.reduce((acc, report) => {
            acc[report.outcome] = (acc[report.outcome] || 0) + 1;
            acc.transactions += report.outcome === "STORED" ? report.transactionCount : 0;
            return acc;
        }, { transactions: 0 });
        await logCamsJob("info", "CAMS ingestion completed", {
            elapsedMs: Date.now() - startedAt,
            received: emails.length,
            ...summary,
        });
        return { reports, summary };
    } catch (error) {
        await logCamsJob("error", "CAMS ingestion failed", {
            elapsedMs: Date.now() - startedAt,
            error: error.message,
        });
        throw error;
    } finally {
        running = false;
    }
}

cron.schedule("0 8 * * *", () => {
    runCamsIngestion().catch(() => {});
}, { timezone: "Asia/Kolkata" });

module.exports = { runCamsIngestion };
