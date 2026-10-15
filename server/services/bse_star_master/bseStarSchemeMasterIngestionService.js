/**
 * BSE Star Scheme Master Ingestion Service.
 *
 * Orchestrates downloading the latest daily BSE Star scheme master report,
 * parsing all scheme details, clearing the existing `bse_scheme_masters` table,
 * and bulk inserting the updated master scheme list into PostgreSQL.
 */

import { prisma } from "../../init/prisma.js";
import { fetchLatestBseSchemeMasterText } from "../../utils/bse_star_master/bseStarScraperUtils.js";
import { parseBseSchemeMasterText } from "../../utils/bse_star_master/bseStarParserUtils.js";
import CustomError from "../../utils/customError.js";

const BATCH_SIZE = 1000;

/**
 * Synchronize the BSE Star Scheme Master database table with the latest report.
 *
 * @param {object} [options]
 * @param {string} [options.textContent] optional raw text content if already downloaded
 * @returns {Promise<{totalParsed: number, totalInserted: number, durationMs: number}>}
 */
async function syncBseSchemeMasterData(options = {}) {
    const startedAt = Date.now();
    console.log("\n[BseSchemeMaster] Starting BSE Star Scheme Master synchronization...");

    let textContent = options.textContent;

    if (!textContent) {
        textContent = await fetchLatestBseSchemeMasterText();
    }

    const records = parseBseSchemeMasterText(textContent);

    if (!records || records.length === 0) {
        throw new CustomError(502, "BSE Star Scheme Master report contained no parseable scheme records");
    }

    console.log(`[BseSchemeMaster] Parsed ${records.length} scheme records. Updating database table...`);

    // Complete overwrite strategy: delete old rows and bulk insert new rows
    let insertedCount = 0;

    await prisma.$transaction(
        async (tx) => {
            await tx.bseSchemeMaster.deleteMany({});

            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const chunk = records.slice(i, i + BATCH_SIZE);
                const res = await tx.bseSchemeMaster.createMany({
                    data: chunk,
                });
                insertedCount += res.count;
            }
        },
        {
            timeout: 60000, // 60s timeout for bulk operation
        }
    );

    const durationMs = Date.now() - startedAt;
    console.log(
        `[BseSchemeMaster] Synchronization complete. ${insertedCount} scheme records stored in DB in ${(durationMs / 1000).toFixed(2)}s.\n`
    );

    return {
        totalParsed: records.length,
        totalInserted: insertedCount,
        durationMs,
    };
}

export { syncBseSchemeMasterData };
