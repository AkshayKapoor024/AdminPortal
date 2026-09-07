/**
 * Company AUM ingestion orchestrator.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * This is the "conductor" for the company side of the AUM feature. It's
 * called directly from the import API route (not a cron job — this
 * feature is triggered by an admin uploading files), and for one
 * request it:
 *
 *   1. works out which quarter the uploaded files belong to, from the
 *      ISO date string the caller sent
 *   2. fetches BSE's master scheme list ONCE for the whole batch
 *   3. for each uploaded WBR22 file: parses it, matches every fund name
 *      to a category via the master list, and ADDS its numbers into
 *      `CompanyAum` for that (period, category) — on top of whatever
 *      was already there from earlier files for the same quarter
 *
 * Every file is processed independently and defensively: one bad file
 * (corrupt CSV, all-unmatched funds, a duplicate re-upload) never stops
 * the rest of the batch, and the full per-file outcome is returned so
 * the caller can see exactly what happened.
 */

const crypto = require("crypto");

const { prisma } = require("../init/prisma");
const { getFinancialYearAndQuarterForDate, findOrCreateAumPeriod } = require("../utils/aumPeriodUtils");
const { fetchMasterSchemeList } = require("../utils/masterSchemeListUtils");
const { buildSchemeMatchIndex, matchSchemeName } = require("../utils/schemeNameMatchingUtils");
const { parseWbr22File } = require("../utils/wbr22ParsingUtils");
const { createCategoryResolver } = require("../utils/aumCategoryResolver");
const CustomError = require("../utils/customError");

/** SHA-256 hash, used both for file-level dedup and scheme-level fingerprints. Never used to hash anything we'd need to read back. */
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

        // Step 3: match every fund to a category, grouping the deltas.
        const categoryDeltas = new Map(); // categoryName -> { aumDelta, fingerprints: Set }
        const unmatchedSchemes = [];
        let matchedCount = 0;
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

            matchedCount++;

            // Fingerprint is derived from the MATCHED master scheme
            // name (never the raw WBR22 name), so two differently
            // spelled WBR22 rows that both matched the same underlying
            // fund correctly dedupe to one scheme.
            const fingerprint = sha256(match.matchedName);

            if (!categoryDeltas.has(match.category)) {
                categoryDeltas.set(match.category, { aumDelta: 0, fingerprints: new Set() });
            }

            const entry = categoryDeltas.get(match.category);

            entry.aumDelta += closingAssets;
            entry.fingerprints.add(fingerprint);
        }

        console.log(
            `[CompanyAUM] ${quarterLabel}: "${file.originalname}" matched ${matchedCount}/${schemeTotals.size} ` +
            `scheme(s) across ${categoryDeltas.size} categor${categoryDeltas.size === 1 ? "y" : "ies"} ` +
            `(${unmatchedSchemes.length} unmatched)`
        );

        // Step 4: persist, atomically, adding on top of whatever this
        // (period, category) already had from earlier files.
        const categorySummaries = await prisma.$transaction(async (tx) => {
            const { resolveOrCreateCategory } = await createCategoryResolver(tx);
            const summaries = [];

            for (const [categoryName, delta] of categoryDeltas) {
                // Company categories are flat — no parent, no hierarchy,
                // just the broad scheme-type name from the master list
                // (e.g. "EQUITY", "DEBT", "LIQUID").
                const category = await resolveOrCreateCategory({
                    name: categoryName,
                    level: 1,
                    isLeaf: true,
                    parentId: null,
                });

                const existing = await tx.companyAum.findUnique({
                    where: {
                        periodId_categoryId: {
                            periodId: period.id,
                            categoryId: category.id,
                        },
                    },
                });

                const existingFingerprints = existing ? existing.schemeFingerprints : [];
                const existingFingerprintSet = new Set(existingFingerprints);

                // Only genuinely new schemes (never seen for this
                // period+category before, across any file) grow the
                // scheme count — but the AUM delta always gets added,
                // since a repeat scheme in a new file represents a
                // different, non-overlapping set of clients.
                const newFingerprints = [...delta.fingerprints].filter(
                    (fp) => !existingFingerprintSet.has(fp)
                );

                const updatedFingerprints = [...existingFingerprints, ...newFingerprints];
                const previousAum = existing ? existing.aum.toNumber() : 0;
                const updatedAum = previousAum + delta.aumDelta;
                const updatedSchemeCount = updatedFingerprints.length;
                const updatedAaum = updatedSchemeCount > 0 ? updatedAum / updatedSchemeCount : 0;

                await tx.companyAum.upsert({
                    where: {
                        periodId_categoryId: {
                            periodId: period.id,
                            categoryId: category.id,
                        },
                    },
                    update: {
                        aum: updatedAum,
                        aaum: updatedAaum,
                        schemeCount: updatedSchemeCount,
                        schemeFingerprints: updatedFingerprints,
                    },
                    create: {
                        periodId: period.id,
                        categoryId: category.id,
                        aum: updatedAum,
                        aaum: updatedAaum,
                        schemeCount: updatedSchemeCount,
                        schemeFingerprints: updatedFingerprints,
                    },
                });

                summaries.push({
                    category: categoryName,
                    aum: updatedAum,
                    aaum: updatedAaum,
                    schemeCount: updatedSchemeCount,
                    newSchemesFromThisFile: newFingerprints.length,
                });
            }

            return summaries;
        });

        for (const summary of categorySummaries) {
            console.log(
                `[CompanyAUM] ${quarterLabel}: category "${summary.category}" -> ` +
                `aum=${summary.aum.toFixed(2)} aaum=${summary.aaum.toFixed(2)} ` +
                `schemeCount=${summary.schemeCount} (+${summary.newSchemesFromThisFile} new from this file)`
            );
        }

        // Step 5: mark this file done.
        await prisma.companyAumFileImport.update({
            where: { id: importRow.id },
            data: {
                status: "COMPLETED",
                matchedSchemeCount: matchedCount,
                unmatchedSchemeCount: unmatchedSchemes.length,
                totalClosingAssets,
                completedAt: new Date(),
                errorMessage: null,
            },
        });

        if (unmatchedSchemes.length > 0) {
            console.warn(
                `[CompanyAUM] ${quarterLabel}: "${file.originalname}" — ${unmatchedSchemes.length} scheme(s) ` +
                `could not be confidently matched to a category and were excluded from the totals`
            );
        }

        return {
            fileName: file.originalname,
            status: "COMPLETED",
            matchedSchemeCount: matchedCount,
            unmatchedSchemeCount: unmatchedSchemes.length,
            totalClosingAssets,
            categoriesUpdated: categorySummaries,
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
async function ingestCompanyAumFiles({ files, quarterDateIso }) {
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

    const period = await findOrCreateAumPeriod(prisma, financialYear, quarter);

    console.log(`[CompanyAUM] Fetching master scheme list from BSE (once for this batch)...`);

    const masterSchemeList = await fetchMasterSchemeList();

    console.log(`[CompanyAUM] Master scheme list loaded: ${masterSchemeList.length} scheme(s)`);

    const matchIndex = buildSchemeMatchIndex(masterSchemeList);

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

module.exports = { ingestCompanyAumFiles };
