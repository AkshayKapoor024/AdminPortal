/**
 * Build the stable, compact result summary returned by CAMS ingestion.
 * This is intentionally pure so cron and manual runners report identically.
 */

/**
 * Reduce the final list of persisted reports into a small summary object,
 * e.g. `{ STORED: 3, SKIPPED: 1, transactions: 452 }`.
 *
 * @param {Array<object>} reports persistence results, each with an `outcome`
 * @returns {object} counts per outcome, plus a running transaction total
 */
function buildIngestionSummary(reports) {
    return reports.reduce((result, report) => {
        result[report.outcome] = (result[report.outcome] || 0) + 1;
        result.transactions += report.outcome === "STORED" ? report.transactionCount : 0;
        return result;
    }, { transactions: 0 });
}

export { buildIngestionSummary };
