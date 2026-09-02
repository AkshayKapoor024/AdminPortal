/**
 * Industry AUM persistence service.
 *
 * WHAT THIS FILE DOES (plain-language summary):
 * By the time this file is called, one quarter's AMFI XLSX has already
 * been downloaded and turned into a flat, ordered list of "header" and
 * "leaf" rows (see `utils/amfiXlsxParsingUtils.js`). This file walks
 * that list top-to-bottom rebuilding the tree structure (which header
 * is currently "above" which row), resolves every row to its
 * `AumCategory` record — creating a new one on the fly if AMFI has
 * introduced a category we've never seen before — and saves every leaf
 * row's AUM/AAUM figures into `IndustryAum`.
 *
 * Everything for one quarter happens inside a single Prisma transaction,
 * so a single quarter's category discovery + figures are always saved
 * together or not at all.
 */

const { createCategoryResolver } = require("../utils/aumCategoryResolver");

/**
 * Walk one quarter's classified rows, resolving/creating categories as
 * needed, and persist every leaf observation into `IndustryAum`.
 *
 * @param {object} prisma a Prisma client
 * @param {string} periodId the AumPeriod this data belongs to
 * @param {Array<object>} classifiedRows rows from `parseAmfiWorkbookRows`
 * @returns {Promise<{leafCount: number, categoriesCreated: number, unrecognizedRows: Array}>}
 */
async function persistIndustryAumForQuarter(prisma, periodId, classifiedRows) {
    return prisma.$transaction(async (tx) => {
        const { resolveOrCreateCategory, stats } = await createCategoryResolver(tx);

        // The hierarchy stack: stack[0] = the currently open level-1
        // category, stack[1] = the currently open level-2 category, etc.
        // A header row replaces everything from its own level downward;
        // a leaf row always attaches to whatever is currently the
        // deepest open category.
        const stack = [];

        const unrecognizedRows = [];
        let leafCount = 0;

        for (const row of classifiedRows) {
            if (row.type === "unrecognized") {
                // A row we couldn't classify as either a header or a leaf.
                // Don't guess — record it so the caller can surface a
                // warning, and move on without touching the stack.
                unrecognizedRows.push(row);
                continue;
            }

            if (row.type === "header") {
                const parentIndex = row.level - 2;
                const parent = parentIndex >= 0 ? stack[parentIndex] : null;

                const category = await resolveOrCreateCategory({
                    name: row.name,
                    level: row.level,
                    isLeaf: false,
                    parentId: parent ? parent.id : null,
                });

                // This header now becomes the deepest open category at its
                // level; anything deeper that was open before is discarded.
                stack.length = row.level - 1;
                stack.push(category);

                continue;
            }

            // row.type === "leaf"
            const parent = stack[stack.length - 1] || null;
            const level = stack.length + 1;

            const category = await resolveOrCreateCategory({
                name: row.name,
                level,
                isLeaf: true,
                parentId: parent ? parent.id : null,
            });

            await tx.industryAum.upsert({
                where: {
                    periodId_categoryId: {
                        periodId,
                        categoryId: category.id,
                    },
                },
                update: {
                    aum: row.aum,
                    aaum: row.aaum,
                },
                create: {
                    periodId,
                    categoryId: category.id,
                    aum: row.aum,
                    aaum: row.aaum,
                },
            });

            leafCount++;
        }

        return {
            leafCount,
            categoriesCreated: stats.created,
            unrecognizedRows,
        };
    });
}

module.exports = { persistIndustryAumForQuarter };
