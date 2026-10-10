/**
 * Company AUM ingestion orchestrator.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * This is the "conductor" for the company side of the AUM feature.
 * It's called both from the manual import API route and the daily
 * automated cron pipeline, and for one batch of files it:
 *
 *   1. works out which quarter the files belong to, from the ISO date
 *      string the caller sent
 *   2. fetches BSE's master scheme list ONCE for the whole batch
 *   3. for each file: parses it, matches every fund name to its
 *      category AND its AMC via the master list, and applies each
 *      fund's contribution to `CompanyAum` using the shared
 *      day-vs-quarter update strategy in
 *      `utils/cams_wbr22/companyAumUpsertUtils.js` (see that file for
 *      the exact three-case rules — same-day figures add together,
 *      a new day overwrites, a new quarter starts a fresh row).
 *
 * Every file is processed independently and defensively: one bad file
 * (corrupt CSV, all-unmatched funds, a duplicate re-upload) never stops
 * the rest of the batch, and the full per-file outcome is returned so
 * the caller can see exactly what happened.
 */

const crypto = require("crypto");

const { prisma } = require("../../init/prisma");
const { getFinancialYearAndQuarterForDate, findOrCreateAumPeriod } = require("../../utils/industry_aum/aumPeriodUtils");
const { fetchMasterSchemeListFromDb } = require("../../utils/cams_wbr22/masterSchemeListUtils");
const { buildSchemeMatchIndex, matchSchemeName, normalizeSchemeName } = require("../../utils/cams_wbr22/schemeNameMatchingUtils");
const { parseWbr22File } = require("../../utils/cams_wbr22/wbr22ParsingUtils");
const { createCategoryResolver } = require("../../utils/industry_aum/aumCategoryResolver");
const { upsertDailyCompanyAum } = require("../../utils/cams_wbr22/companyAumUpsertUtils");
const CustomError = require("../../utils/customError");

/** SHA-256 hash, used for file-level dedup. */
function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Process a single uploaded WBR22 file against an already-resolved
 * AumPeriod and an already-built scheme match index.
 *
 * @param {object} period the AumPeriod this file's data belongs to
 * @param {{originalname: string, buffer: Buffer}} file
 * @param {object} matchIndex from `buildSchemeMatchIndex`
 * @returns {Promise<object>} a summary of what happened with this file
 */
async function processWbr22File(period, file, matchIndex) {
    const quarterLabel = `FY ${period.financialYear} Q${period.quarter}`;
    const fileHash = sha256(file.buffer);

    console.log(`[CompanyAUM] ${quarterLabel}: processing "${file.originalname}"...`);

    // Step 1: duplicate-file protection. If the exact same bytes were
    // already successfully imported for this quarter, skip it entirely
    // rather than double-adding its figures.
    const existingImport = await prisma.companyAumFileImport.findUnique({
        where: {
            periodId_fileHash: {
                periodId: period.id,
                fileHash,
            },
        },
    });

    if (existingImport && existingImport.status === "COMPLETED") {
        console.log(
            `[CompanyAUM] ${quarterLabel}: "${file.originalname}" is byte-identical to a file already ` +
            `imported for this quarter — skipping to avoid double-counting`
        );

        return {
            fileName: file.originalname,
            status: "SKIPPED_DUPLICATE",
            message: "This exact file has already been imported for this quarter.",
        };
    }

    const importRow =
        existingImport ||
        (await prisma.companyAumFileImport.create({
            data: {
                periodId: period.id,
                fileName: file.originalname,
                fileHash,
                status: "PENDING",
            },
        }));

    try {
        await prisma.companyAumFileImport.update({
            where: { id: importRow.id },
            data: { status: "PROCESSING", errorMessage: null },
        });

        // Step 2: parse the file into per-fund closing-asset totals.
        const schemeTotals = parseWbr22File(file.buffer);

        console.log(
            `[CompanyAUM] ${quarterLabel}: "${file.originalname}" contains ${schemeTotals.size} distinct scheme(s)`
        );

        // Step 3: match every fund to its category + AMC.
        const matchedFunds = []; // { schemeName, category, amcCode, closingAssets }
        const unmatchedSchemes = [];
        let totalClosingAssets = 0;

        for (const [schemeName, closingAssets] of schemeTotals) {
            totalClosingAssets += closingAssets;

            const match = matchSchemeName(schemeName, matchIndex);

            // If a category match exists, use it; otherwise fallback category to "Other"
            // For an unmatched scheme there is no canonical master-list name to
            // key on, so normalize the raw WBR22 text the same way matching
            // does (case/whitespace/punctuation). Using the raw text as-is
            // would let tiny formatting differences between days' files (a
            // trailing space, a capitalization change) silently create a
            // brand-new "Other" row instead of updating the same fund's row.
            const resolvedSchemeName = match.matched
                ? match.matchedName
                // Normalization can strip an all-noise-word name down to "" —
                // fall back to the raw trimmed text so two unrelated unmatched
                // funds never collide onto the same "Other" row.
                : (normalizeSchemeName(schemeName) || schemeName.trim());
            const resolvedCategory = (match.matched && match.category) ? match.category : "Other";
            const resolvedAmcCode = match.matched ? match.amcCode : null;

            if (!match.matched || !match.category) {
                unmatchedSchemes.push({
                    originalSchemeName: schemeName,
                    closingAssets,
                    bestGuessMatch: match.matchedName,
                    bestGuessScore: Number(match.score.toFixed(3)),
                    assignedCategory: "Other",
                });
            }

            matchedFunds.push({
                schemeName: resolvedSchemeName,
                category: resolvedCategory,
                amcCode: resolvedAmcCode,
                closingAssets,
            });
        }

        console.log(
            `[CompanyAUM] ${quarterLabel}: "${file.originalname}" mapped ${matchedFunds.length}/${schemeTotals.size} ` +
            `scheme(s) (${unmatchedSchemes.length} assigned fallback category "Other")`
        );

        // Step 4: apply each fund's contribution, atomically, using the
        // shared day-vs-quarter update strategy.
        const fundSummaries = await prisma.$transaction(async (tx) => {
            const { resolveOrCreateCategory } = await createCategoryResolver(tx);
            const summaries = [];

            for (const fund of matchedFunds) {
                // Company categories are flat — no parent, no
                // hierarchy, just the broad scheme-type name from the
                // master list (e.g. "EQUITY", "DEBT", "LIQUID", "Other").
                const category = await resolveOrCreateCategory({
                    name: fund.category,
                    level: 1,
                    isLeaf: true,
                    parentId: null,
                });

                const { row, caseApplied } = await upsertDailyCompanyAum(tx, {
                    periodId: period.id,
                    schemeName: fund.schemeName,
                    categoryId: category.id,
                    amcCode: fund.amcCode,
                    todaysDelta: fund.closingAssets,
                });

                summaries.push({
                    schemeName: fund.schemeName,
                    category: fund.category,
                    amcCode: fund.amcCode,
                    aum: row.aum.toNumber(),
                    aaum: row.aaum.toNumber(),
                    daysRecorded: row.daysRecorded,
                    caseApplied,
                });
            }

            return summaries;
        });

        const caseCounts = fundSummaries.reduce((counts, s) => {
            counts[s.caseApplied] = (counts[s.caseApplied] || 0) + 1;
            return counts;
        }, {});

        console.log(
            `[CompanyAUM] ${quarterLabel}: "${file.originalname}" applied ${fundSummaries.length} fund update(s) — ` +
            Object.entries(caseCounts).map(([k, v]) => `${k}=${v}`).join(", ")
        );

        // Step 5: mark this file done.
        await prisma.companyAumFileImport.update({
            where: { id: importRow.id },
            data: {
                status: "COMPLETED",
                matchedSchemeCount: matchedFunds.length,
                unmatchedSchemeCount: unmatchedSchemes.length,
                totalClosingAssets,
                completedAt: new Date(),
                errorMessage: null,
            },
        });

        if (unmatchedSchemes.length > 0) {
            console.log(
                `[CompanyAUM] ${quarterLabel}: "${file.originalname}" — ${unmatchedSchemes.length} scheme(s) ` +
                `without a direct BSE category match were persisted under category "Other".`
            );
        }

        return {
            fileName: file.originalname,
            status: "COMPLETED",
            matchedSchemeCount: matchedFunds.length,
            unmatchedSchemeCount: unmatchedSchemes.length,
            totalClosingAssets,
            fundsUpdated: fundSummaries,
            unmatchedSchemes,
        };
    } catch (error) {
        console.error(`[CompanyAUM] ${quarterLabel}: "${file.originalname}" FAILED — ${error.message}`);

        await prisma.companyAumFileImport
            .update({
                where: { id: importRow.id },
                data: { status: "FAILED", errorMessage: error.message },
            })
            .catch(() => {
                // Best-effort only — the failure is already returned below.
            });

        return {
            fileName: file.originalname,
            status: "FAILED",
            error: error.message,
        };
    }
}

/**
 * Import one batch of WBR22 files for a single reporting quarter.
 *
 * @param {object} options
 * @param {Array<{originalname: string, buffer: Buffer}>} options.files
 * @param {string} options.quarterDateIso an ISO date string identifying the quarter
 * @returns {Promise<object>} a summary of the whole batch
 */
async function prepareCompanyAumMatchIndex() {
    const masterSchemeList = await fetchMasterSchemeListFromDb();

    return {
        matchIndex: buildSchemeMatchIndex(masterSchemeList),
        schemeCount: masterSchemeList.length,
    };
}

async function ingestCompanyAumFiles({ files, quarterDateIso, matchIndex: suppliedMatchIndex = null }) {
    if (!Array.isArray(files) || files.length === 0) {
        throw new CustomError(400, "At least one WBR22 file is required");
    }

    if (!quarterDateIso) {
        throw new CustomError(400, "quarterDateIso is required to identify the reporting quarter");
    }

    const { financialYear, quarter } = getFinancialYearAndQuarterForDate(quarterDateIso);

    console.log(
        `\n[CompanyAUM] Starting import of ${files.length} file(s) for FY ${financialYear} Q${quarter}...`
    );

    // BSE authentication and master-list retrieval deliberately happen before
    // creating an AUM period or file-import row. If either external call
    // fails, this function exits without changing Company AUM data.
    const prepared = suppliedMatchIndex
        ? { matchIndex: suppliedMatchIndex, schemeCount: null }
        : await prepareCompanyAumMatchIndex();

    const period = await findOrCreateAumPeriod(prisma, financialYear, quarter);
    const matchIndex = prepared.matchIndex;

    const fileResults = [];

    for (const file of files) {
        const result = await processWbr22File(period, file, matchIndex);
        fileResults.push(result);
    }

    console.log(`[CompanyAUM] Batch complete for FY ${financialYear} Q${quarter}.\n`);

    return {
        financialYear,
        quarter,
        periodId: period.id,
        files: fileResults,
    };
}

module.exports = { ingestCompanyAumFiles, prepareCompanyAumMatchIndex };
