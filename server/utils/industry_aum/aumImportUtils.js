/**
 * AumImport helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * `AumImport` is the "did we already handle this file?" tracking table
 * — one row per (source, period) pair. This file has the small set of
 * helpers needed to find or create that tracking row, and to move it
 * through its lifecycle: PENDING → DOWNLOADING → PROCESSING →
 * COMPLETED/FAILED. The ingestion service treats an existing
 * `COMPLETED` row as the single source of truth for "skip this
 * quarter, it's already done" — it never re-checks `IndustryAum`
 * itself for that decision.
 */

/**
 * Find the AumImport row for a given (source, period), creating it with
 * status `PENDING` if this is the first time we've seen this pair.
 *
 * @param {object} prisma
 * @param {"AMFI"|"COMPANY"} source
 * @param {string} periodId
 * @returns {Promise<object>} the AumImport row
 */
async function findOrCreateAumImport(prisma, source, periodId) {
    const existing = await prisma.aumImport.findUnique({
        where: {
            source_periodId: {
                source,
                periodId,
            },
        },
    });

    if (existing) {
        return existing;
    }

    return prisma.aumImport.create({
        data: {
            source,
            periodId,
            status: "PENDING",
        },
    });
}

/**
 * Move an AumImport row to a new status, optionally updating its
 * file/error fields at the same time.
 *
 * @param {object} prisma
 * @param {string} importId
 * @param {"PENDING"|"DOWNLOADING"|"PROCESSING"|"COMPLETED"|"FAILED"} status
 * @param {object} [extra]
 * @param {string} [extra.fileUrl]
 * @param {string} [extra.fileName]
 * @param {string|null} [extra.errorMessage]
 * @returns {Promise<object>} the updated AumImport row
 */
async function updateAumImportStatus(prisma, importId, status, extra = {}) {
    const data = { status };

    if (extra.fileUrl !== undefined) {
        data.fileUrl = extra.fileUrl;
    }

    if (extra.fileName !== undefined) {
        data.fileName = extra.fileName;
    }

    if (extra.errorMessage !== undefined) {
        data.errorMessage = extra.errorMessage;
    }

    if (status === "DOWNLOADING") {
        data.startedAt = new Date();
        // A retried import is trying again, so clear out any previous
        // failure message until/unless it fails again.
        data.errorMessage = null;
    }

    if (status === "COMPLETED") {
        data.completedAt = new Date();
        data.errorMessage = null;
    }

    return prisma.aumImport.update({
        where: { id: importId },
        data,
    });
}

export{
    findOrCreateAumImport,
    updateAumImportStatus,
};
