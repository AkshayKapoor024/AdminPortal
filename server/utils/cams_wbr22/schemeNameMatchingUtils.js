/**
 * WBR22 <-> master scheme list name matching.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * The WBR22 file only tells us a fund's name and how much money is in
 * it — never its category. The master scheme list tells us every fund's
 * category — but its spelling of a fund's name is rarely byte-identical
 * to WBR22's spelling (different punctuation, "Regular Plan" vs no plan
 * text, "Multicap" vs "Multi Cap", stray "(erstwhile ...)" asides, and
 * so on). This file bridges the two: it normalizes both sides the same
 * way, tries an exact match first, and falls back to fuzzy
 * (sequence-similarity) matching against a shortlist of same-AMC
 * candidates when no exact match exists.
 *
 * IMPORTANT — why the match doesn't need to be perfect: we only need to
 * get the *category* right, not identify the exact specific fund. Two
 * similarly-named funds from the same AMC are very likely to share the
 * same broad category (EQUITY, DEBT, LIQUID, etc.), so a close-but-not-
 * exact fuzzy match still produces the correct category in the vast
 * majority of cases. Because of that, the match threshold below is
 * tuned to be fairly strict (favouring "leave it unmatched and flag it"
 * over "guess and risk the wrong category").
 */

const { sequenceMatcherRatio } = require("./sequenceMatcher");

/**
 * A fuzzy match must score at least this well (0-1) to be accepted.
 * This was tuned against a real WBR22 file + master scheme list: at
 * 0.90, every accepted fuzzy match observed was either exactly correct
 * or matched a same-AMC, same-category near-duplicate (safe), while
 * every match that only differed from the correct answer because the
 * true fund was simply absent from the master list scored below this.
 */
const FUZZY_MATCH_THRESHOLD = 0.9;

/** Plan/option wording that carries no category information and only adds noise to comparisons. */
const NOISE_WORDS = new Set([
    "REGULAR", "DIRECT", "PLAN", "GROWTH", "IDCW", "DIVIDEND", "PAYOUT",
    "REINVESTMENT", "REINVEST", "BONUS", "OPTION", "SCHEME",
]);

// -----------------------------------------------------------------------------
// Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize a fund name for comparison: uppercase, drop parenthetical
 * asides (e.g. "(erstwhile ...)", "(Regular Plan)"), spell out "&",
 * strip punctuation, and drop plan/option noise words.
 *
 * @param {string} name
 * @returns {string}
 */
function normalizeSchemeName(name) {
    let value = String(name || "").toUpperCase();

    value = value.replace(/\([^)]*\)/g, " ");
    value = value.replace(/&/g, " AND ");
    value = value.replace(/[^A-Z0-9\s]/g, " ");

    const words = value
        .split(/\s+/)
        .filter(Boolean)
        .filter((word) => !NOISE_WORDS.has(word));

    return words.join(" ");
}

// -----------------------------------------------------------------------------
// Match index
// -----------------------------------------------------------------------------

/**
 * Build a lookup index from the master scheme list, once per ingestion
 * batch (so it can be reused across every uploaded file without
 * re-normalizing 12000+ names each time).
 *
 * @param {Array<{schemeName: string, schemeType: string, amcCode: string|null}>} masterSchemeList
 * @returns {{exactIndex: Map<string,object>, blockIndex: Map<string, Array<[string,object]>>}}
 */
function buildSchemeMatchIndex(masterSchemeList) {
    const exactIndex = new Map();
    const blockIndex = new Map();

    for (const entry of masterSchemeList) {
        const normalized = normalizeSchemeName(entry.schemeName);

        if (!normalized) {
            continue;
        }

        const category = String(entry.schemeType || "").trim().toUpperCase();

        if (!category) {
            continue;
        }

        const details = { category, amcCode: entry.amcCode || null };

        // First entry for a given normalized name wins; later duplicates
        // (a fund's other plan/option rows) are expected to agree anyway.
        if (!exactIndex.has(normalized)) {
            exactIndex.set(normalized, details);
        }

        // Bucket candidates by their first word (almost always the AMC
        // name) so fuzzy matching only has to scan a small shortlist
        // instead of the entire master list.
        const firstWord = normalized.split(" ")[0];

        if (!blockIndex.has(firstWord)) {
            blockIndex.set(firstWord, []);
        }

        blockIndex.get(firstWord).push([normalized, details]);
    }

    return { exactIndex, blockIndex };
}

// -----------------------------------------------------------------------------
// Matching
// -----------------------------------------------------------------------------

/**
 * Resolve one WBR22 fund name to a master-list category (and AMC).
 *
 * @param {string} schemeName the raw fund name from WBR22
 * @param {{exactIndex: Map, blockIndex: Map}} matchIndex from `buildSchemeMatchIndex`
 * @returns {{
 *   matched: boolean,
 *   category: string|null,
 *   amcCode: string|null,
 *   matchedName: string|null,
 *   method: "exact"|"fuzzy"|"unmatched",
 *   score: number
 * }}
 */
function matchSchemeName(schemeName, matchIndex) {
    const normalized = normalizeSchemeName(schemeName);

    if (!normalized) {
        return { matched: false, category: null, amcCode: null, matchedName: null, method: "unmatched", score: 0 };
    }

    const exactDetails = matchIndex.exactIndex.get(normalized);

    if (exactDetails) {
        return {
            matched: true,
            category: exactDetails.category,
            amcCode: exactDetails.amcCode,
            matchedName: normalized,
            method: "exact",
            score: 1,
        };
    }

    const firstWord = normalized.split(" ")[0];
    const candidates = matchIndex.blockIndex.get(firstWord) || [];

    let bestScore = 0;
    let bestName = null;
    let bestDetails = null;

    for (const [candidateName, candidateDetails] of candidates) {
        const score = sequenceMatcherRatio(normalized, candidateName);

        if (score > bestScore) {
            bestScore = score;
            bestName = candidateName;
            bestDetails = candidateDetails;
        }
    }

    if (bestScore >= FUZZY_MATCH_THRESHOLD) {
        return {
            matched: true,
            category: bestDetails.category,
            amcCode: bestDetails.amcCode,
            matchedName: bestName,
            method: "fuzzy",
            score: bestScore,
        };
    }

    // Unmatched — still report the closest candidate found, so an admin
    // reviewing the import summary has a starting point for investigation.
    return {
        matched: false,
        category: null,
        amcCode: null,
        matchedName: bestName,
        method: "unmatched",
        score: bestScore,
    };
}

module.exports = {
    FUZZY_MATCH_THRESHOLD,
    normalizeSchemeName,
    buildSchemeMatchIndex,
    matchSchemeName,
};
