/**
 * AumCategory resolver.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * The AMFI file re-uses the exact same category name in more than one
 * place — for example "Other Schemes" appears once under Open Ended,
 * once under Close Ended, and once under Interval Schemes, and each one
 * is a genuinely different category. So a category can never be looked
 * up by its name alone; it must always be looked up by
 * "this name, under this specific parent".
 *
 * This file keeps an in-memory cache of the whole `AumCategory` table
 * (there are only around ~90 rows, so this is cheap) keyed by
 * `parentId + normalized name`, and offers one function —
 * `resolveOrCreateCategory` — that either returns the existing category
 * for a given (parent, name) pair, or creates a brand-new one on the
 * fly if AMFI introduces a category we've never seen before. A newly
 * created category always gets a correctly-set `parentId`, `level`, and
 * `isLeaf`, so the hierarchy stays fully intact even for categories that
 * were never in the original seed.
 *
 * A resolver is created fresh for each ingestion run via
 * `createCategoryResolver()` so cached state never leaks between runs
 * or tests.
 */

/**
 * Normalize a category name for comparison purposes only (never used as
 * the value actually stored in the database — the original AMFI wording,
 * including any of its own inconsistent spacing, is always preserved in
 * the `name` column).
 *
 * @param {string} name
 * @returns {string}
 */
function normalizeCategoryName(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

/** Build the cache key for a (parentId, name) pair. Top-level categories use "ROOT" as their parent key. */
function buildCacheKey(parentId, name) {
    return `${parentId || "ROOT"}::${normalizeCategoryName(name)}`;
}

/**
 * Turn a category name into a stable, unique, human-readable `code`.
 *
 * Example: "Large Cap Fund" -> "LARGE_CAP_FUND"
 *
 * If the generated code is already taken (e.g. two differently-parented
 * categories happen to slugify to the same code), a numeric suffix is
 * appended until it is unique.
 *
 * @param {string} name
 * @param {Set<string>} existingCodes codes already in use (mutated as codes are claimed)
 * @returns {string}
 */
function generateCategoryCode(name, existingCodes) {
    const base =
        String(name || "category")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 60) || "CATEGORY";

    let code = base;
    let suffix = 2;

    while (existingCodes.has(code)) {
        code = `${base}_${suffix}`;
        suffix += 1;
    }

    existingCodes.add(code);

    return code;
}

/**
 * Create a fresh category resolver for one ingestion run.
 *
 * @param {object} prisma a Prisma client (or an active transaction client)
 * @returns {Promise<{resolveOrCreateCategory: Function, stats: object}>}
 */
async function createCategoryResolver(prisma) {
    const existingCategories = await prisma.aumCategory.findMany();

    /** @type {Map<string, object>} cache key -> AumCategory row */
    const cacheByParentAndName = new Map();

    /** All codes currently in use, so newly generated codes never collide. */
    const existingCodes = new Set();

    for (const category of existingCategories) {
        cacheByParentAndName.set(
            buildCacheKey(category.parentId, category.name),
            category
        );
        existingCodes.add(category.code);
    }

    const stats = {
        created: 0,
        reused: 0,
    };

    /**
     * Resolve a category by (name, parentId), creating it if it has
     * never been seen before.
     *
     * @param {object} options
     * @param {string} options.name       the exact AMFI display text for this row
     * @param {number} options.level      hierarchy depth (1 = top-level, deeper = more nested)
     * @param {boolean} options.isLeaf    true if this row carries actual AUM/AAUM figures
     * @param {string|null} options.parentId the resolved parent category's id, or null for top-level
     * @returns {Promise<object>} the AumCategory row (existing or newly created)
     */
    async function resolveOrCreateCategory({ name, level, isLeaf, parentId }) {
        const cacheKey = buildCacheKey(parentId, name);
        const cached = cacheByParentAndName.get(cacheKey);

        if (cached) {
            stats.reused++;
            return cached;
        }

        // A category we've never seen before: create it now so future
        // quarters can find it immediately via the same cache.
        const code = generateCategoryCode(name, existingCodes);

        const created = await prisma.aumCategory.create({
            data: {
                code,
                name,
                level,
                isLeaf,
                parentId: parentId || null,
            },
        });

        cacheByParentAndName.set(cacheKey, created);
        stats.created++;

        console.log(
            `[AMFI] New AumCategory discovered and created: "${name.trim()}" ` +
            `(code=${code}, level=${level}, isLeaf=${isLeaf}, parentId=${parentId || "none"})`
        );

        return created;
    }

    return { resolveOrCreateCategory, stats };
}

module.exports = {
    normalizeCategoryName,
    generateCategoryCode,
    createCategoryResolver,
};
