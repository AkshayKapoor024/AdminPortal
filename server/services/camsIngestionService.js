/** Runs the CAMS email → ZIP → CSV → PostgreSQL pipeline for cron and manual use. */
const { retrieveCamsEmails } = require("./emailService");
const { processCamsReports } = require("./reportService");
const { processCamsCsvReports } = require("./csvService");
const { persistCamsReports } = require("./camsDatabaseService");
const { logCamsJob } = require("../utils/jobLogger");
const { buildIngestionSummary } = require("../utils/camsIngestionSummary");
require('dotenv').config()

async function runCamsIngestion() {
    const startedAt = Date.now();
    try {
        if (!process.env.CAMS_REPORT_PASSWORD) throw new Error("CAMS_REPORT_PASSWORD is not configured");
        const emails = await retrieveCamsEmails();
        const extracted = await processCamsReports(emails, process.env.CAMS_REPORT_PASSWORD);
        const parsed = await processCamsCsvReports(extracted);
        const reports = await persistCamsReports(parsed);
        const summary = buildIngestionSummary(reports);
        await logCamsJob("info", "CAMS ingestion completed", { elapsedMs: Date.now() - startedAt, received: emails.length, ...summary });
        return { reports, summary };
    } catch (error) {
        await logCamsJob("error", "CAMS ingestion failed", { elapsedMs: Date.now() - startedAt, error: error.message });
        throw error;
    }
}

module.exports = { runCamsIngestion };
