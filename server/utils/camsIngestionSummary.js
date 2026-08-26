/**
 * Build the stable, compact result summary returned by CAMS ingestion.
 * This is intentionally pure so cron and manual runners report identically.
 */
function buildIngestionSummary(reports) {
    return reports.reduce((result, report) => {
        result[report.outcome] = (result[report.outcome] || 0) + 1;
        result.transactions += report.outcome === "STORED" ? report.transactionCount : 0;
        return result;
    }, { transactions: 0 });
}

module.exports = { buildIngestionSummary };
