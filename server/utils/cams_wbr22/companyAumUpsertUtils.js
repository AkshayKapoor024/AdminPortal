/**
 * Daily CompanyAum upsert logic.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Both the CAMS and Karvy company-AUM pipelines call this same function
 * for every fund they see in a file, so the tricky "how do today's
 * numbers combine with what's already stored" logic exists in exactly
 * one place rather than two independently-maintained copies.
 *
 * `CompanyAum` now holds one row per (fund, quarter), continuously kept
 * current as daily files arrive. Three cases, decided by comparing
 * "today" against the row's `lastUpdatedDate`:
 *
 *   1. SAME_DAY_ADD — another file today for a fund already updated
 *      today: add this file's contribution to today's running total.
 *      CAMS sends up to 4 files a day and Karvy sends its own on top,
 *      each covering different, non-overlapping clients, so same-day
 *      figures are additive.
 *   2. NEW_DAY_OVERWRITE — a file for a fund last updated on an
 *      earlier day, still the same quarter: today's total fully
 *      replaces whatever was recorded before (no accumulation across
 *      days — each day's stored value is that day's own total).
 *   3. NEW_ROW — no existing row for this (period, fund) at all: the
 *      first entry for this fund this quarter (this also naturally
 *      covers a new quarter starting, since AumPeriod resolution gives
 *      a different periodId and the unique key is (periodId, schemeName)
 *      — the previous quarter's row is simply never touched again).
 *
 * `aaum` is maintained as a running average of each day's total,
 * updated once per calendar day (case 2 only) — never re-averaged on a
 * same-day top-up (case 1 only revises the current day's own value).
 */

/** Truncate a Date to midnight UTC, matching the `@db.Date` column's precision. */
function toDateOnly(date) {
    const truncated = new Date(date);
    truncated.setUTCHours(0, 0, 0, 0);
    return truncated;
}

/**
 * Apply one fund's contribution from today's file to `CompanyAum`,
 * using the three-case strategy described above.
 *
 * @param {object} tx an active Prisma transaction client
 * @param {object} params
 * @param {string} params.periodId
 * @param {string} params.schemeName the matched, canonical fund name — this row's identity
 * @param {string} params.categoryId
 * @param {string|null} params.amcCode
 * @param {number} params.todaysDelta this file's contribution to the fund's total today
 * @param {Date} [params.today] defaults to now; pass explicitly only for testing
 * @returns {Promise<{row: object, caseApplied: "SAME_DAY_ADD"|"NEW_DAY_OVERWRITE"|"NEW_ROW"}>}
 */
async function upsertDailyCompanyAum(tx, { periodId, schemeName, categoryId, amcCode, todaysDelta, today = new Date() }) {
    const todayDateOnly = toDateOnly(today);

    const existing = await tx.companyAum.findUnique({
        where: { periodId_schemeName: { periodId, schemeName } },
    });

    // Case 3: no row yet for this fund this quarter.
    if (!existing) {
        const row = await tx.companyAum.create({
            data: {
                periodId,
                schemeName,
                categoryId,
                amcCode,
                aum: todaysDelta,
                aaum: todaysDelta,
                daysRecorded: 1,
                lastUpdatedDate: todayDateOnly,
            },
        });

        return { row, caseApplied: "NEW_ROW" };
    }

    const previousAum = existing.aum.toNumber();
    const previousAaum = existing.aaum.toNumber();
    const isSameDay = toDateOnly(existing.lastUpdatedDate).getTime() === todayDateOnly.getTime();

    let updatedAum;
    let updatedAaum;
    let updatedDaysRecorded;

    if (isSameDay) {
        // Case 1: revise today's own slot upward — daysRecorded doesn't
        // advance, we're still "on" the same day.
        updatedAum = previousAum + todaysDelta;

        const sumExcludingToday = previousAaum * existing.daysRecorded - previousAum;
        updatedAaum = (sumExcludingToday + updatedAum) / existing.daysRecorded;
        updatedDaysRecorded = existing.daysRecorded;
    } else {
        // Case 2: a new calendar day within the same quarter — full
        // overwrite of the current value, and one new day added to
        // the running average.
        updatedAum = todaysDelta;
        updatedDaysRecorded = existing.daysRecorded + 1;
        updatedAaum = (previousAaum * existing.daysRecorded + updatedAum) / updatedDaysRecorded;
    }

    const row = await tx.companyAum.update({
        where: { id: existing.id },
        data: {
            aum: updatedAum,
            aaum: updatedAaum,
            daysRecorded: updatedDaysRecorded,
            lastUpdatedDate: todayDateOnly,
            // Keep these fresh in case the master scheme list's
            // classification for this fund changes between runs.
            categoryId,
            amcCode,
        },
    });

    return { row, caseApplied: isSameDay ? "SAME_DAY_ADD" : "NEW_DAY_OVERWRITE" };
}

module.exports = { upsertDailyCompanyAum, toDateOnly };
