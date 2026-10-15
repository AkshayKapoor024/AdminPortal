/**
 * WBR22 Company AUM CAMS ingestion orchestrator.
 *
 * Runs email retrieval → protected ZIP extraction → BSE login/master-list
 * preflight → existing Company AUM persistence. BSE preflight is completed
 * before the importer creates any period or import records, so an expired
 * credential or unavailable master list cannot leave partial AUM writes.
 */
import 'dotenv/config'

import { retrieveWbr22Emails } from "./wbr22EmailService.js";
import { processCamsReports } from "./reportService.js";
import { prepareCompanyAumMatchIndex, ingestCompanyAumFiles } from "../cams_wbr22/companyAumIngestionService.js";
import { buildWbr22CronFile } from "../../utils/cams_wbr22_automation/wbr22CronFileUtils.js";
import { logWbr22AumJob } from "../../utils/cams_wbr22_automation/wbr22AumJobLogger.js";

function summariseStatuses(items) {
    return items.reduce((summary, item) => {
        const status = item.status || "UNKNOWN";
        summary[status] = (summary[status] || 0) + 1;
        return summary;
    }, {});
}

/** Run the complete WBR22 CAMS-to-Company-AUM pipeline once. */
async function runWbr22AumIngestion(options = {}) {
    const startedAt = Date.now();
    const lookbackDays = options.lookbackDays || 14;

    try {
        const password = process.env.CAMS_WBR22_REPORT_PASSWORD;
        if (!password) throw new Error("CAMS_WBR22_REPORT_PASSWORD is not configured");

        const emails = await retrieveWbr22Emails({ lookbackDays });
        const extractedReports = await processCamsReports(emails, password);
        const extractionSummary = summariseStatuses(extractedReports);
        const readyFiles = [];
        const preparationFailures = [];

        for (const extractedReport of extractedReports) {
            if (extractedReport.status !== "EXTRACTED") continue;

            try {
                readyFiles.push({
                    ...(await buildWbr22CronFile(extractedReport)),
                    reportRequestNumber: extractedReport.identifiers.reportRequestNumber,
                });
            } catch (error) {
                preparationFailures.push({
                    reportRequestNumber: extractedReport?.identifiers?.reportRequestNumber || null,
                    status: "FAILED_PREPARATION",
                    error: error.message,
                });
            }
        }

        if (readyFiles.length === 0) {
            const summary = {
                received: emails.length,
                extraction: extractionSummary,
                preparationFailures: preparationFailures.length,
                persistedFiles: 0,
                periods: [],
            };
            await logWbr22AumJob("info", "WBR22 AUM ingestion finished with no persistable CSV files", { elapsedMs: Date.now() - startedAt, ...summary });
            return { emails, extractedReports, preparationFailures, summary };
        }

        // Strict all-or-nothing preflight for BSE dependencies. No Company
        // AUM persistence has happened above this point.
        const { matchIndex, schemeCount } = await prepareCompanyAumMatchIndex();
        const filesByQuarter = new Map();
        for (const readyFile of readyFiles) {
            const files = filesByQuarter.get(readyFile.quarterDateIso) || [];
            files.push(readyFile.file);
            filesByQuarter.set(readyFile.quarterDateIso, files);
        }

        const periods = [];
        for (const [quarterDateIso, files] of filesByQuarter) {
            periods.push(await ingestCompanyAumFiles({ files, quarterDateIso, matchIndex }));
        }

        const persistedFiles = periods.flatMap((period) => period.files);
        const summary = {
            received: emails.length,
            extraction: extractionSummary,
            preparationFailures: preparationFailures.length,
            bseMasterSchemeCount: schemeCount,
            persistedFiles: persistedFiles.length,
            persistence: summariseStatuses(persistedFiles),
            periods: periods.map(({ financialYear, quarter, periodId }) => ({ financialYear, quarter, periodId })),
        };

        await logWbr22AumJob("info", "WBR22 AUM ingestion completed", { elapsedMs: Date.now() - startedAt, ...summary });
        return { emails, extractedReports, preparationFailures, periods, summary };
    } catch (error) {
        await logWbr22AumJob("error", "WBR22 AUM ingestion failed", { elapsedMs: Date.now() - startedAt, error: error.message });
        throw error;
    }
}

export { runWbr22AumIngestion, summariseStatuses };
