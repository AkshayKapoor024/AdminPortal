/**
 * CAMS ingestion orchestrator.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * This is the "conductor" of the whole CAMS pipeline. It calls each stage
 * in order — read emails, download & extract ZIPs, parse CSVs, save to the
 * database — and logs one final summary line describing what happened.
 * It is called both by the daily cron job (`jobs/camsIngestionJob.js`) and
 * can be called manually (e.g. from a test script) for the exact same
 * behaviour.
 *
 * Runs the CAMS email → ZIP → CSV → PostgreSQL pipeline for cron and manual use.
 */
import { retrieveCamsEmails } from "./emailService.js";
import { processCamsReports } from "../cams_wbr22_automation/reportService.js";
import { processCamsCsvReports } from "./csvService.js";
import { persistCamsReports } from "./camsDatabaseService.js";
import { logCamsJob } from "../../utils/cams_transactions/jobLogger.js";
import { buildIngestionSummary } from "../../utils/cams_transactions/camsIngestionSummary.js";

import 'dotenv/config'

/**
 * Run the full CAMS ingestion pipeline once, end to end.
 *
 * @returns {Promise<{reports: Array<object>, summary: object}>}
 */
async function runCamsIngestion() {
    const startedAt = Date.now();
    try {
        // The extraction password is shared across all CAMS reports and
        // must be configured before anything is downloaded.
        if (!process.env.CAMS_REPORT_PASSWORD) throw new Error("CAMS_REPORT_PASSWORD is not configured");

        // Stage 1: fetch the last 24 hours of approved CAMS report emails.
        const emails = await retrieveCamsEmails();

        // Stage 2: download + password-extract each report's ZIP file.
        const extracted = await processCamsReports(emails, process.env.CAMS_REPORT_PASSWORD);

        // Stage 3: parse each extracted CSV into transaction records.
        const parsed = await processCamsCsvReports(extracted);

        // Stage 4: persist every report (and its transactions) to PostgreSQL.
        const reports = await persistCamsReports(parsed);

        // Build and log a compact summary (counts per outcome, total
        // transactions stored) so the run can be audited from the log file.
        const summary = buildIngestionSummary(reports);
        await logCamsJob("info", "CAMS ingestion completed", { elapsedMs: Date.now() - startedAt, received: emails.length, ...summary });
        return { reports, summary };
    } catch (error) {
        // Any unexpected failure anywhere in the pipeline is logged with
        // its elapsed time before being re-thrown to the caller (the cron
        // job swallows it; a manual caller can choose to handle it).
        await logCamsJob("error", "CAMS ingestion failed", { elapsedMs: Date.now() - startedAt, error: error.message });
        throw error;
    }
}

export { runCamsIngestion };
