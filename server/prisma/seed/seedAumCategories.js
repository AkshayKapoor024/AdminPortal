/**
 * AumCategory seed script.
 *
 * WHAT THIS SCRIPT DOES (plain-language summary):
 * Populates the `AumCategory` table once with the full AMFI category
 * hierarchy defined in `aumCategoryData.js`. This must be run before the
 * AMFI ingestion pipeline is used for the first time, so that every
 * quarterly file has a stable set of categories to attach its numbers to.
 *
 * Safe to re-run: every category is "upserted" by its unique `code`, so
 * running this script again (e.g. after adding a brand-new category to
 * `aumCategoryData.js` by hand) will not create duplicates or disturb
 * categories that were already seeded — or ones that the ingestion
 * pipeline itself later auto-created for a category AMFI introduces in
 * the future (see `utils/aumCategoryResolver.js`).
 *
 * Run with:
 *   node prisma/seed/seedAumCategories.js
 */
require("dotenv").config();

const { prisma } = require("../../init/prisma");
const { AMFI_AUM_CATEGORY_HIERARCHY } = require("./aumCategoryData");

/**
 * Seed every category in `AMFI_AUM_CATEGORY_HIERARCHY`, parent before
 * child (the data file is already ordered that way).
 */
async function seedAumCategories() {
    // Maps a category's `code` to its freshly-created/updated database id,
    // so that a child entry can look up its parent's real id even though
    // the data file only stores the parent's `code`.
    const codeToId = new Map();

    let created = 0;
    let updated = 0;

    for (const entry of AMFI_AUM_CATEGORY_HIERARCHY) {
        const parentId = entry.parentCode
            ? codeToId.get(entry.parentCode)
            : null;

        if (entry.parentCode && !parentId) {
            // This would only happen if aumCategoryData.js listed a child
            // before its parent — a data-entry mistake, not a runtime one.
            throw new Error(
                `Category "${entry.code}" references parent "${entry.parentCode}", ` +
                `but that parent has not been seeded yet. Check the order of entries in aumCategoryData.js.`
            );
        }

        const existing = await prisma.aumCategory.findUnique({
            where: { code: entry.code },
        });

        const saved = await prisma.aumCategory.upsert({
            where: { code: entry.code },
            update: {
                name: entry.name,
                level: entry.level,
                isLeaf: entry.isLeaf,
                parentId,
            },
            create: {
                code: entry.code,
                name: entry.name,
                level: entry.level,
                isLeaf: entry.isLeaf,
                parentId,
            },
        });

        codeToId.set(entry.code, saved.id);

        if (existing) {
            updated++;
        } else {
            created++;
            console.log(`  + created ${entry.code} (${entry.name.trim()})`);
        }
    }

    console.log(
        `\nAumCategory seed complete: ${created} created, ${updated} already present/updated, ${AMFI_AUM_CATEGORY_HIERARCHY.length} total.`
    );
}

// Allow this file to be run directly (`node prisma/seed/seedAumCategories.js`)
// as well as imported/reused elsewhere without side effects.
if (require.main === module) {
    seedAumCategories()
        .catch((error) => {
            console.error("AumCategory seed failed:", error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}

module.exports = { seedAumCategories };
