/**
 * Karvy transactions ingestion orchestrator.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * Mirrors `cams_transactions/camsIngestionService.js` exactly — the
 * "conductor" of the whole Karvy transactions pipeline. It calls each
 * stage in order — read emails, download & extract ZIPs (the shared,
 * provider-agnostic `cams_wbr22_automation/reportService.js`, reused
 * unchanged), parse CSVs, save to the database — and logs one final
 * summary describing what happened. Called both by the daily cron job
 * (`jobs/karvyTransactionIngestionJob.js`) and manually
 * (`temp/runKarvyTransactionIngestionTest.js`) for identical behaviour.
 */
require("dotenv").config();
const { retrieveKarvyTransactionEmails } = require("./emailService");
const { processCamsReports } = require("../cams_wbr22_automation/reportService");
const { processKarvyCsvReports } = require("./csvService");
const { persistKarvyTransactionReports } = require("./karvyDatabaseService");
const { logKarvyTransactionsJob } = require("../../utils/karvy_transactions/karvyJobLogger");
const { buildIngestionSummary } = require("../../utils/karvy_transactions/karvyIngestionSummary");

/**
 * Run the full Karvy transactions ingestion pipeline once, end to end.
 *
 * @returns {Promise<{reports: Array<object>, summary: object}>}
 */
async function runKarvyTransactionIngestion() {
    const startedAt = Date.now();
    try {
        // The extraction password is shared across all Karvy transaction
        // reports and must be configured before anything is downloaded.
        if (!process.env.KARVY_REPORT_PASSWORD) throw new Error("KARVY_REPORT_PASSWORD is not configured");

        // Stage 1: fetch the last 24 hours of approved Karvy Transaction
        // Feeds Report emails.
        const emails = await retrieveKarvyTransactionEmails();

        // Stage 2: download + password-extract each report's ZIP file.
        const extracted = await processCamsReports(emails, process.env.KARVY_REPORT_PASSWORD);

        // Stage 3: parse each extracted CSV into transaction records.
        const parsed = await processKarvyCsvReports(extracted);

        // Stage 4: persist every report (and its transactions) to PostgreSQL.
        const reports = await persistKarvyTransactionReports(parsed);

        // Build and log a compact summary so the run can be audited from
        // the log file.
        const summary = buildIngestionSummary(reports);
        await logKarvyTransactionsJob("info", "Karvy transactions ingestion completed", { elapsedMs: Date.now() - startedAt, received: emails.length, ...summary });
        return { reports, summary };
    } catch (error) {
        // Any unexpected failure anywhere in the pipeline is logged with
        // its elapsed time before being re-thrown to the caller (the
        // cron job swallows it; a manual caller can choose to handle it).
        await logKarvyTransactionsJob("error", "Karvy transactions ingestion failed", { elapsedMs: Date.now() - startedAt, error: error.message });
        throw error;
    }
}

module.exports = { runKarvyTransactionIngestion };
