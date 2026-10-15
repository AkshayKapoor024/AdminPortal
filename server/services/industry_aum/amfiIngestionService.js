/**
 * AMFI industry AUM ingestion orchestrator.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * This is the "conductor" for the industry-AUM side of the AUM feature.
 * It walks every financial year AMFI has ever published this report for
 * (starting 2011-12) up through the current one, and for every quarter
 * AMFI has published so far, makes sure that quarter's data is safely
 * stored in `IndustryAum`. It never re-downloads or re-parses a quarter
 * that's already marked `COMPLETED` in `AumImport` — that status is the
 * single source of truth for "is this quarter done".
 *
 * This can be called both by the monthly cron
 * (`jobs/amfiIngestionJob.js`) and directly for a one-off manual test
 * run (`temp/runAmfiIngestionTest.js`), with identical behaviour and
 * logging either way.
 */

import { prisma } from "../../init/prisma.js";
import {
    buildFinancialYearRange,
    fetchAvailableQuarters,
    getQuarterFromPeriod,
} from "../../utils/industry_aum/amfiApiUtils.js";
import { findOrCreateAumPeriod } from "../../utils/industry_aum/aumPeriodUtils.js";
import {
    findOrCreateAumImport,
    updateAumImportStatus,
} from "../../utils/industry_aum/aumImportUtils.js";
import {
    downloadAmfiExcel,
    parseAmfiWorkbookRows,
} from "../../utils/industry_aum/amfiXlsxParsingUtils.js";
import { persistIndustryAumForQuarter } from "./industryAumService.js";
import { logAmfiJob } from "../../utils/industry_aum/amfiJobLogger.js";

/**
 * Process a single (financial year, quarter) entry returned by the AMFI
 * API: resolve/create its AumPeriod + AumImport rows, skip it if it's
 * already COMPLETED, otherwise download + parse + persist it.
 *
 * Every expected failure (network error, corrupt file, unmapped row) is
 * caught here so that one bad quarter never stops the rest of the run.
 *
 * @param {string} fyId
 * @param {object} quarterInfo `{ Period, pdfURL, excelURL }` from the AMFI API
 * @returns {Promise<"COMPLETED"|"SKIPPED"|"FAILED">}
 */
async function processAmfiQuarter(fyId, quarterInfo) {
    const quarterNumber = getQuarterFromPeriod(quarterInfo.Period);

    if (!quarterNumber) {
        console.warn(
            `[AMFI] FY ${fyId}: could not determine quarter number from period "${quarterInfo.Period}" — skipping`
        );
        return "FAILED";
    }

    const quarterLabel = `FY ${fyId} Q${quarterNumber}`;

    let period = null;
    let importRow = null;

    try {
        // Step 1: make sure the AumPeriod row exists (correct calendar
        // dates computed once, here).
        period = await findOrCreateAumPeriod(prisma, fyId, quarterNumber);

        // Step 2: find or create the AumImport tracking row. Its status
        // is the ONLY thing we check to decide whether to skip.
        importRow = await findOrCreateAumImport(prisma, "AMFI", period.id);

        if (importRow.status === "COMPLETED") {
            console.log(`[AMFI] ${quarterLabel}: already imported (COMPLETED) — skipping`);
            return "SKIPPED";
        }

        // Step 3: download the XLSX.
        console.log(`[AMFI] ${quarterLabel}: downloading XLSX...`);

        await updateAumImportStatus(prisma, importRow.id, "DOWNLOADING", {
            fileUrl: quarterInfo.excelURL || null,
            fileName: quarterInfo.excelURL
                ? quarterInfo.excelURL.split("/").pop()
                : null,
        });

        const buffer = await downloadAmfiExcel(quarterInfo.excelURL);

        console.log(
            `[AMFI] ${quarterLabel}: downloaded ${(buffer.length / 1024).toFixed(1)} KB`
        );

        // Step 4: parse the workbook into classified rows.
        await updateAumImportStatus(prisma, importRow.id, "PROCESSING");

        const classifiedRows = parseAmfiWorkbookRows(buffer);

        console.log(`[AMFI] ${quarterLabel}: ${classifiedRows.length} rows classified from XLSX`);

        // Step 5: resolve categories + persist IndustryAum, atomically.
        const result = await persistIndustryAumForQuarter(
            prisma,
            period.id,
            classifiedRows
        );

        if (result.unrecognizedRows.length > 0) {
            console.warn(
                `[AMFI] ${quarterLabel}: ${result.unrecognizedRows.length} row(s) had a name but no ` +
                `recognisable marker/values and were skipped: ` +
                result.unrecognizedRows.map((row) => `"${row.name}"`).join(", ")
            );
        }

        console.log(
            `[AMFI] ${quarterLabel}: stored ${result.leafCount} category observations` +
            (result.categoriesCreated > 0
                ? ` (${result.categoriesCreated} new categor${result.categoriesCreated === 1 ? "y" : "ies"} created)`
                : "")
        );

        // Step 6: mark this quarter done.
        await updateAumImportStatus(prisma, importRow.id, "COMPLETED");

        console.log(`[AMFI] ${quarterLabel}: marked COMPLETED`);

        return "COMPLETED";
    } catch (error) {
        console.error(`[AMFI] ${quarterLabel}: FAILED — ${error.message}`);

        // Best-effort: record the failure on the AumImport row so the
        // next run retries this exact quarter instead of silently
        // skipping it forever.
        try {
            const failedImportRow =
                importRow || (period && (await findOrCreateAumImport(prisma, "AMFI", period.id)));

            if (failedImportRow) {
                await updateAumImportStatus(prisma, failedImportRow.id, "FAILED", {
                    errorMessage: error.message,
                });
            }
        } catch (_) {
            // If we can't even record the failure, there's nothing more we
            // can safely do here — the outer error is already logged below.
        }

        await logAmfiJob("error", `AMFI quarter ingestion failed: ${quarterLabel}`, {
            fyId,
            quarter: quarterNumber,
            error: error.message,
        });

        return "FAILED";
    }
}

/**
 * Run the full AMFI industry AUM ingestion pipeline once, across every
 * financial year from 2011-12 up to the current one.
 *
 * @returns {Promise<object>} a summary of what happened this run
 */
async function runAmfiIngestion() {
    const startedAt = Date.now();

    const summary = {
        financialYearsChecked: 0,
        quartersCompleted: 0,
        quartersSkipped: 0,
        quartersFailed: 0,
    };

    console.log("\n========================================");
    console.log("[AMFI] Industry AUM ingestion started");
    console.log("========================================");

    const financialYears = buildFinancialYearRange();

    console.log(
        `[AMFI] Checking ${financialYears.length} financial year(s): ${financialYears[0]} through ${financialYears[financialYears.length - 1]}`
    );

    for (const fyId of financialYears) {
        console.log(`\n[AMFI] FY ${fyId}: fetching available quarters from AMFI...`);

        let quarters;

        try {
            quarters = await fetchAvailableQuarters(fyId);
        } catch (error) {
            // A whole financial year failing to fetch (e.g. AMFI API
            // hiccup, or a future FY that doesn't exist yet) must not
            // stop the years before/after it.
            console.error(`[AMFI] FY ${fyId}: failed to fetch quarter list — ${error.message}`);

            await logAmfiJob("error", `Failed to fetch AMFI quarter list for FY ${fyId}`, {
                fyId,
                error: error.message,
            });

            continue;
        }

        console.log(`[AMFI] FY ${fyId}: ${quarters.length} quarter(s) published so far`);

        summary.financialYearsChecked++;

        for (const quarterInfo of quarters) {
            const outcome = await processAmfiQuarter(fyId, quarterInfo);

            if (outcome === "COMPLETED") {
                summary.quartersCompleted++;
            } else if (outcome === "SKIPPED") {
                summary.quartersSkipped++;
            } else {
                summary.quartersFailed++;
            }
        }
    }

    const elapsedMs = Date.now() - startedAt;

    console.log("\n========================================");
    console.log("[AMFI] Industry AUM ingestion completed");
    console.log("========================================");
    console.log(`Financial years checked : ${summary.financialYearsChecked}`);
    console.log(`Quarters completed      : ${summary.quartersCompleted}`);
    console.log(`Quarters skipped        : ${summary.quartersSkipped}`);
    console.log(`Quarters failed         : ${summary.quartersFailed}`);
    console.log(`Elapsed                 : ${(elapsedMs / 1000).toFixed(1)}s`);
    console.log("========================================\n");

    await logAmfiJob("info", "AMFI ingestion run completed", { elapsedMs, ...summary });

    return summary;
}

export { runAmfiIngestion };
