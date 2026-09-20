/**
 * Karvy Company AUM persistence.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * This is structurally a near-duplicate of
 * `cams_wbr22/companyAumIngestionService.js`'s per-file processing —
 * intentionally, rather than modifying that existing file, since it's
 * shared with the already-working CAMS pipeline and the "don't touch
 * existing code" rule applies. The ONLY thing that differs from the
 * CAMS version is which parser reads the raw file
 * (`parseKarvyWbr22File` instead of `parseWbr22File`), because Karvy's
 * CSV has different column names entirely (see
 * `utils/karvy_wbr22_automation/karvyWbr22ParsingUtils.js`).
 *
 * Everything else — BSE authentication, the master scheme list, the
 * fuzzy scheme-name matcher, the `AumCategory` resolver, and the shared
 * day-vs-quarter update logic in
 * `utils/cams_wbr22/companyAumUpsertUtils.js` — is imported and reused
 * completely unchanged from the existing CAMS-side files. This is
 * deliberate: Karvy-sourced and CAMS-sourced company AUM data both need
 * to land in the SAME per-fund rows, since the point of this whole
 * feature is one combined, accurate picture of the company's total AUM
 * regardless of which RTA services which fund.
 */

const crypto = require("crypto");

const { prisma } = require("../../init/prisma");
const { findOrCreateAumPeriod, getFinancialYearAndQuarterForDate } = require("../../utils/industry_aum/aumPeriodUtils");
const { createCategoryResolver } = require("../../utils/industry_aum/aumCategoryResolver");
const { matchSchemeName } = require("../../utils/cams_wbr22/schemeNameMatchingUtils");
const { parseKarvyWbr22File } = require("../../utils/karvy_wbr22_automation/karvyWbr22ParsingUtils");
const { prepareCompanyAumMatchIndex } = require("../cams_wbr22/companyAumIngestionService");
const { upsertDailyCompanyAum } = require("../../utils/cams_wbr22/companyAumUpsertUtils");
const CustomError = require("../../utils/customError");

/** SHA-256 hash, used for file-level dedup. */
function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Process a single Karvy WBR22 file against an already-resolved
 * AumPeriod and an already-built scheme match index.
 *
 * @param {object} period the AumPeriod this file's data belongs to
 * @param {{originalname: string, buffer: Buffer}} file
 * @param {object} matchIndex from `buildSchemeMatchIndex`
 * @returns {Promise<object>} a summary of what happened with this file
 */
async function processKarvyWbr22File(period, file, matchIndex) {
    const quarterLabel = `FY ${period.financialYear} Q${period.quarter}`;
    const fileHash = sha256(file.buffer);

    console.log(`[KarvyCompanyAUM] ${quarterLabel}: processing "${file.originalname}"...`);

    const existingImport = await prisma.companyAumFileImport.findUnique({
        where: { periodId_fileHash: { periodId: period.id, fileHash } },
    });

    if (existingImport && existingImport.status === "COMPLETED") {
        console.log(
            `[KarvyCompanyAUM] ${quarterLabel}: "${file.originalname}" is byte-identical to a file already ` +
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
            data: { periodId: period.id, fileName: file.originalname, fileHash, status: "PENDING" },
        }));

    try {
        await prisma.companyAumFileImport.update({
            where: { id: importRow.id },
            data: { status: "PROCESSING", errorMessage: null },
        });

        const schemeTotals = parseKarvyWbr22File(file.buffer);

        console.log(
            `[KarvyCompanyAUM] ${quarterLabel}: "${file.originalname}" contains ${schemeTotals.size} distinct scheme(s)`
        );

        const matchedFunds = []; // { schemeName, category, amcCode, closingAssets }
        const unmatchedSchemes = [];
        let totalClosingAssets = 0;

        for (const [schemeName, closingAssets] of schemeTotals) {
            totalClosingAssets += closingAssets;

            const match = matchSchemeName(schemeName, matchIndex);

            if (!match.matched) {
                unmatchedSchemes.push({
                    closingAssets,
                    bestGuessMatch: match.matchedName,
                    bestGuessScore: Number(match.score.toFixed(3)),
                });
                continue;
            }

            matchedFunds.push({
                schemeName: match.matchedName,
                category: match.category,
                amcCode: match.amcCode,
                closingAssets,
            });
        }

        console.log(
            `[KarvyCompanyAUM] ${quarterLabel}: "${file.originalname}" matched ${matchedFunds.length}/${schemeTotals.size} ` +
            `scheme(s) (${unmatchedSchemes.length} unmatched)`
        );

        const fundSummaries = await prisma.$transaction(async (tx) => {
            const { resolveOrCreateCategory } = await createCategoryResolver(tx);
            const summaries = [];

            for (const fund of matchedFunds) {
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
            `[KarvyCompanyAUM] ${quarterLabel}: "${file.originalname}" applied ${fundSummaries.length} fund update(s) — ` +
            Object.entries(caseCounts).map(([k, v]) => `${k}=${v}`).join(", ")
        );

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
            console.warn(
                `[KarvyCompanyAUM] ${quarterLabel}: "${file.originalname}" — ${unmatchedSchemes.length} scheme(s) ` +
                `could not be confidently matched to a category and were excluded from the totals`
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
        console.error(`[KarvyCompanyAUM] ${quarterLabel}: "${file.originalname}" FAILED — ${error.message}`);

        await prisma.companyAumFileImport
            .update({ where: { id: importRow.id }, data: { status: "FAILED", errorMessage: error.message } })
            .catch(() => {});

        return { fileName: file.originalname, status: "FAILED", error: error.message };
    }
}

/**
 * Import one batch of Karvy WBR22 files for a single reporting quarter.
 *
 * @param {object} options
 * @param {Array<{originalname: string, buffer: Buffer}>} options.files
 * @param {string} options.quarterDateIso an ISO date string identifying the quarter
 * @param {object} [options.matchIndex] a pre-built match index; fetched fresh if omitted
 * @returns {Promise<object>} a summary of the whole batch
 */
async function ingestKarvyCompanyAumFiles({ files, quarterDateIso, matchIndex: suppliedMatchIndex = null }) {
    if (!Array.isArray(files) || files.length === 0) {
        throw new CustomError(400, "At least one Karvy WBR22 file is required");
    }

    if (!quarterDateIso) {
        throw new CustomError(400, "quarterDateIso is required to identify the reporting quarter");
    }

    const { financialYear, quarter } = getFinancialYearAndQuarterForDate(quarterDateIso);

    console.log(`\n[KarvyCompanyAUM] Starting import of ${files.length} file(s) for FY ${financialYear} Q${quarter}...`);

    // Same all-or-nothing preflight discipline as the CAMS path: BSE
    // auth/master-list retrieval happens before any period/import row
    // exists, so a failed external call never leaves partial writes.
    const prepared = suppliedMatchIndex
        ? { matchIndex: suppliedMatchIndex }
        : await prepareCompanyAumMatchIndex();

    const period = await findOrCreateAumPeriod(prisma, financialYear, quarter);

    const fileResults = [];

    for (const file of files) {
        fileResults.push(await processKarvyWbr22File(period, file, prepared.matchIndex));
    }

    console.log(`[KarvyCompanyAUM] Batch complete for FY ${financialYear} Q${quarter}.\n`);

    return { financialYear, quarter, periodId: period.id, files: fileResults };
}

module.exports = { ingestKarvyCompanyAumFiles };
