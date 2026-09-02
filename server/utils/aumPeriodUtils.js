/**
 * AumPeriod helpers.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Turns a financial year + quarter number (e.g. "2025-26", Q4) into the
 * actual calendar date range it covers (1 Jan 2026 – 31 Mar 2026), and
 * finds-or-creates the matching `AumPeriod` database row. India's
 * financial year runs 1 April – 31 March, so Q4 of a financial year
 * actually falls in the *following* calendar year — this file is the
 * one place that date math is done, so nothing else in the codebase
 * needs to worry about it.
 */

/**
 * Compute the start/end dates for one quarter of a financial year.
 *
 * @param {string} fyId  e.g. "2025-26"
 * @param {number} quarter 1, 2, 3, or 4
 * @returns {{periodStart: Date, periodEnd: Date}}
 */
function resolveQuarterDates(fyId, quarter) {
    const [startYearText] = String(fyId).split("-");
    const startYear = parseInt(startYearText, 10);

    if (Number.isNaN(startYear)) {
        throw new Error(`Invalid financial year id: "${fyId}"`);
    }

    const endYear = startYear + 1;

    // [year, monthIndex (0-based), startDay, endDay] for each quarter.
    const QUARTER_RANGES = {
        1: { year: startYear, startMonth: 3, endMonth: 5 }, // Apr–Jun
        2: { year: startYear, startMonth: 6, endMonth: 8 }, // Jul–Sep
        3: { year: startYear, startMonth: 9, endMonth: 11 }, // Oct–Dec
        4: { year: endYear, startMonth: 0, endMonth: 2 }, // Jan–Mar
    };

    const range = QUARTER_RANGES[quarter];

    if (!range) {
        throw new Error(`Invalid quarter number: ${quarter} (expected 1-4)`);
    }

    const periodStart = new Date(Date.UTC(range.year, range.startMonth, 1));

    // Day 0 of the month *after* the end month gives the last day of the
    // end month, accounting for different month lengths automatically.
    const periodEnd = new Date(Date.UTC(range.year, range.endMonth + 1, 0));

    return { periodStart, periodEnd };
}

/**
 * Find the `AumPeriod` row for a given financial year + quarter,
 * creating it (with correctly computed dates) if it doesn't exist yet.
 *
 * @param {object} prisma a Prisma client (or active transaction client)
 * @param {string} fyId
 * @param {number} quarter
 * @returns {Promise<object>} the AumPeriod row
 */
async function findOrCreateAumPeriod(prisma, fyId, quarter) {
    const existing = await prisma.aumPeriod.findUnique({
        where: {
            financialYear_quarter: {
                financialYear: fyId,
                quarter,
            },
        },
    });

    if (existing) {
        return existing;
    }

    const { periodStart, periodEnd } = resolveQuarterDates(fyId, quarter);

    return prisma.aumPeriod.create({
        data: {
            financialYear: fyId,
            quarter,
            periodStart,
            periodEnd,
        },
    });
}

module.exports = {
    resolveQuarterDates,
    findOrCreateAumPeriod,
};
