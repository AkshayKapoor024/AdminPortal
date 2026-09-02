/**
 * Canonical AMFI "AUM/AAUM Disclosure by Category" hierarchy.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Every quarter, AMFI publishes an Excel file that breaks down the whole
 * Indian mutual fund industry into the same fixed tree of categories
 * (Open Ended Schemes → Income/Debt Oriented Schemes → Liquid/Cash
 * Oriented Schemes → Overnight Fund, etc). This file is a one-time,
 * hand-verified transcription of that entire tree, written as plain
 * data instead of code so it can be seeded into the `AumCategory` table
 * once and then reused by every future quarter's import.
 *
 * This was transcribed directly from a real AMFI quarterly file
 * (QDACVolQ4-2025-2026.xlsx, "AUM/AAUM Report for the Quarter Ended
 * 31-Mar-2026") row by row, so the `name` values below match AMFI's
 * exact wording — including its own inconsistent trailing spaces
 * (e.g. "Other Schemes " vs "Other Schemes") and repeated names that
 * appear under different parents (e.g. "Other Schemes" appears three
 * separate times, under three different parents — Open Ended, Close
 * Ended, and Interval — and each is a *different* category).
 *
 * HOW TO READ EACH ENTRY:
 *   code       a short, stable, application-facing identifier (never
 *              shown to AMFI, never changes even if AMFI edits wording)
 *   name       the exact display text as it appears in the AMFI file
 *   level      1 = top-level scheme type, 2 = scheme orientation,
 *              3 = a further subsection (only exists under Open Ended
 *              → Income/Debt Oriented Schemes), 4 = a leaf fund category
 *              that actually receives AUM/AAUM numbers
 *   isLeaf     true only for rows that carry real AUM/AAUM figures
 *   parentCode the `code` of this entry's parent, or null for the three
 *              top-level entries (Open Ended / Close Ended / Interval)
 *
 * IMPORTANT: this list is ordered parent-before-child on purpose. The
 * seed script (`seedAumCategories.js`) relies on that order to look up
 * each entry's parent database row by the time it needs it.
 */

const AMFI_AUM_CATEGORY_HIERARCHY = [
    // -------------------------------------------------------------------
    // Level 1 — top-level scheme types
    // -------------------------------------------------------------------
    { code: "OPEN_ENDED", name: "Open Ended Schemes", level: 1, isLeaf: false, parentCode: null },
    { code: "CLOSE_ENDED", name: "Close Ended Schemes", level: 1, isLeaf: false, parentCode: null },
    { code: "INTERVAL", name: "Interval Schemes", level: 1, isLeaf: false, parentCode: null },

    // -------------------------------------------------------------------
    // Level 2 — under Open Ended Schemes
    // -------------------------------------------------------------------
    { code: "OE_INCOME_DEBT", name: "Income/Debt Oriented Schemes", level: 2, isLeaf: false, parentCode: "OPEN_ENDED" },
    { code: "OE_EQUITY", name: "Growth/Equity Oriented Schemes", level: 2, isLeaf: false, parentCode: "OPEN_ENDED" },
    { code: "OE_HYBRID", name: "Hybrid Schemes", level: 2, isLeaf: false, parentCode: "OPEN_ENDED" },
    { code: "OE_SOLUTION", name: "Solution Oriented Schemes", level: 2, isLeaf: false, parentCode: "OPEN_ENDED" },
    { code: "OE_OTHER", name: "Other Schemes ", level: 2, isLeaf: false, parentCode: "OPEN_ENDED" },

    // -------------------------------------------------------------------
    // Level 3 — under Open Ended > Income/Debt Oriented Schemes
    // -------------------------------------------------------------------
    { code: "OE_LIQUID_CASH", name: "Liquid/ Cash Oriented Schemes", level: 3, isLeaf: false, parentCode: "OE_INCOME_DEBT" },
    { code: "OE_OTHER_INCOME_DEBT", name: "Other Income/Debt Oriented Schemes", level: 3, isLeaf: false, parentCode: "OE_INCOME_DEBT" },

    // -------------------------------------------------------------------
    // Leaves — under Open Ended > Income/Debt > Liquid/Cash Oriented
    // -------------------------------------------------------------------
    { code: "OVERNIGHT_FUND", name: "Overnight Fund", level: 4, isLeaf: true, parentCode: "OE_LIQUID_CASH" },
    { code: "LIQUID_FUND", name: "Liquid Fund", level: 4, isLeaf: true, parentCode: "OE_LIQUID_CASH" },

    // -------------------------------------------------------------------
    // Leaves — under Open Ended > Income/Debt > Other Income/Debt Oriented
    // -------------------------------------------------------------------
    { code: "ULTRA_SHORT_DURATION_FUND", name: "Ultra Short Duration Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "LOW_DURATION_FUND", name: "Low Duration Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "MONEY_MARKET_FUND", name: "Money Market Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "SHORT_DURATION_FUND", name: "Short Duration Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "MEDIUM_DURATION_FUND", name: "Medium Duration Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "MEDIUM_TO_LONG_DURATION_FUND", name: "Medium to Long Duration Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "LONG_DURATION_FUND", name: "Long Duration Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "DYNAMIC_BOND_FUND", name: "Dynamic Bond Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "CORPORATE_BOND_FUND", name: "Corporate Bond Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "CREDIT_RISK_FUND", name: "Credit Risk Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "BANKING_AND_PSU_FUND", name: "Banking and PSU Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "GILT_FUND", name: "Gilt Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "GILT_FUND_10Y_CONSTANT_DURATION", name: "Gilt Fund with 10 year constant duration", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },
    { code: "FLOATER_FUND", name: "Floater Fund", level: 4, isLeaf: true, parentCode: "OE_OTHER_INCOME_DEBT" },

    // -------------------------------------------------------------------
    // Leaves — under Open Ended > Growth/Equity Oriented Schemes
    // -------------------------------------------------------------------
    { code: "MULTI_CAP_FUND", name: "Multi Cap Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "LARGE_CAP_FUND", name: "Large Cap Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "LARGE_MID_CAP_FUND", name: "Large & Mid Cap Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "MID_CAP_FUND", name: "Mid Cap Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "SMALL_CAP_FUND", name: "Small Cap Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "DIVIDEND_YIELD_FUND", name: "Dividend Yield Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "VALUE_CONTRA_FUND", name: "Value Fund/Contra Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "FOCUSED_FUND", name: "Focused Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "SECTORAL_THEMATIC_FUND", name: "Sectoral/Thematic Funds", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "OE_ELSS", name: "ELSS", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },
    { code: "FLEXI_CAP_FUND", name: "Flexi Cap Fund", level: 3, isLeaf: true, parentCode: "OE_EQUITY" },

    // -------------------------------------------------------------------
    // Leaves — under Open Ended > Hybrid Schemes
    // -------------------------------------------------------------------
    { code: "CONSERVATIVE_HYBRID_FUND", name: "Conservative Hybrid Fund", level: 3, isLeaf: true, parentCode: "OE_HYBRID" },
    { code: "BALANCED_AGGRESSIVE_HYBRID_FUND", name: "Balanced Hybrid Fund/Aggressive Hybrid Fund", level: 3, isLeaf: true, parentCode: "OE_HYBRID" },
    { code: "DYNAMIC_ASSET_ALLOCATION_FUND", name: "Dynamic Asset Allocation/Balanced Advantage Fund", level: 3, isLeaf: true, parentCode: "OE_HYBRID" },
    { code: "MULTI_ASSET_ALLOCATION_FUND", name: "Multi Asset Allocation Fund", level: 3, isLeaf: true, parentCode: "OE_HYBRID" },
    { code: "ARBITRAGE_FUND", name: "Arbitrage Fund", level: 3, isLeaf: true, parentCode: "OE_HYBRID" },
    { code: "EQUITY_SAVINGS_FUND", name: "Equity Savings Fund", level: 3, isLeaf: true, parentCode: "OE_HYBRID" },

    // -------------------------------------------------------------------
    // Leaves — under Open Ended > Solution Oriented Schemes
    // -------------------------------------------------------------------
    { code: "RETIREMENT_FUND", name: "Retirement Fund", level: 3, isLeaf: true, parentCode: "OE_SOLUTION" },
    { code: "CHILDRENS_FUND", name: "Childrens Fund", level: 3, isLeaf: true, parentCode: "OE_SOLUTION" },

    // -------------------------------------------------------------------
    // Leaves — under Open Ended > Other Schemes
    // -------------------------------------------------------------------
    { code: "EQUITY_INDEX_FUND_DOMESTIC", name: "Equity oriented Index Funds (Domestic Index Funds)", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "EQUITY_INDEX_FUND_INTERNATIONAL", name: "Equity oriented Index Funds (International Index Funds)", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "DEBT_INDEX_FUND_TARGET_MATURITY", name: "Income/Debt Oriented Index Funds (Target Maturity Index Funds)", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "DEBT_INDEX_FUND_OTHER", name: "Income/Debt Oriented Index Funds (Other than Target Maturity Index Funds)", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "OTHER_INDEX_FUND", name: "Other Index Funds", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "GOLD_ETF", name: "Gold ETF", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "EQUITY_ETF_DOMESTIC", name: "Equity oriented ETFs (Domestic ETFs)", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "EQUITY_ETF_INTERNATIONAL", name: "Equity oriented ETFs (International ETFs)", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "DEBT_ETF", name: "Income/Debt Oriented oriented ETFs", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "OTHER_DOMESTIC_ETF", name: "Other Domestic ETFs", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "SILVER_ETF", name: "Silver ETF", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "FOF_OVERSEAS_ACTIVE", name: "Fund of funds investing overseas in Active Funds", level: 3, isLeaf: true, parentCode: "OE_OTHER" },
    { code: "FOF_OVERSEAS_PASSIVE", name: "Fund of funds investing overseas in Passive Funds", level: 3, isLeaf: true, parentCode: "OE_OTHER" },

    // -------------------------------------------------------------------
    // Level 2 — under Close Ended Schemes
    // -------------------------------------------------------------------
    { code: "CE_INCOME_DEBT", name: "Income/Debt Oriented Schemes", level: 2, isLeaf: false, parentCode: "CLOSE_ENDED" },
    { code: "CE_EQUITY", name: "Growth/Equity Oriented Schemes", level: 2, isLeaf: false, parentCode: "CLOSE_ENDED" },
    { code: "CE_OTHER", name: "Other Schemes", level: 2, isLeaf: false, parentCode: "CLOSE_ENDED" },

    // -------------------------------------------------------------------
    // Leaves — under Close Ended > Income/Debt Oriented Schemes
    // -------------------------------------------------------------------
    { code: "FIXED_TERM_PLAN", name: "Fixed Term Plan", level: 3, isLeaf: true, parentCode: "CE_INCOME_DEBT" },
    { code: "CAPITAL_PROTECTION_ORIENTED_SCHEME", name: "Capital Protection Oriented Schemes", level: 3, isLeaf: true, parentCode: "CE_INCOME_DEBT" },
    { code: "INFRASTRUCTURE_DEBT_FUND", name: "Infrastructure Debt Fund", level: 3, isLeaf: true, parentCode: "CE_INCOME_DEBT" },
    { code: "OTHER_DEBT_SCHEME", name: "Other Debt Scheme", level: 3, isLeaf: true, parentCode: "CE_INCOME_DEBT" },

    // -------------------------------------------------------------------
    // Leaves — under Close Ended > Growth/Equity Oriented Schemes
    // -------------------------------------------------------------------
    { code: "CE_ELSS", name: "ELSS", level: 3, isLeaf: true, parentCode: "CE_EQUITY" },
    { code: "OTHER_EQUITY_SCHEME", name: "Other Equity Schemes", level: 3, isLeaf: true, parentCode: "CE_EQUITY" },

    // -------------------------------------------------------------------
    // Leaves — under Interval Schemes (no level-2 subdivision; leaves sit
    // directly under the level-1 "Interval Schemes" category)
    // -------------------------------------------------------------------
    { code: "INTERVAL_INCOME_DEBT", name: "Income/Debt Oriented Schemes", level: 2, isLeaf: true, parentCode: "INTERVAL" },
    { code: "INTERVAL_EQUITY", name: "Growth/Equity Oriented Schemes", level: 2, isLeaf: true, parentCode: "INTERVAL" },
    { code: "INTERVAL_OTHER", name: "Other Schemes", level: 2, isLeaf: true, parentCode: "INTERVAL" },
];

module.exports = { AMFI_AUM_CATEGORY_HIERARCHY };
