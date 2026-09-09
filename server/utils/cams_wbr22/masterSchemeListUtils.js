/**
 * BSE STAR MF master scheme list.
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * Fetches the master list of every mutual fund scheme BSE knows about,
 * each tagged with its category ("Scheme Type" — EQUITY, DEBT, LIQUID,
 * etc). This is the reference list `utils/schemeNameMatchingUtils.js`
 * matches WBR22 fund names against, so each fund's assets can be
 * grouped into the right category for `CompanyAum`.
 *
 * IMPORTANT — this is an undocumented/internal BSE endpoint. The exact
 * shape of a successful response (which wrapper key the scheme array
 * sits under, and the exact casing of each scheme's field names) isn't
 * publicly documented, so this file is deliberately defensive: it scans
 * the response for the first array of scheme-like objects it can find,
 * and accepts several common spellings of the two fields it needs. If
 * BSE's real response shape turns out to differ from what's handled
 * here, `extractSchemeRows`/`pickField` below are the only two things
 * that should need adjusting — everything else in the ingestion
 * pipeline stays the same.
 */

const CustomError = require("../customError");

const MASTER_SCHEME_LIST_URL = "https://starmfv2demo.bseindia.com/api/master_scheme_list";

/** Common spellings a scheme's display name might be returned under. */
const SCHEME_NAME_FIELD_CANDIDATES = [
    "Scheme Name", "scheme_name", "SCHEME_NAME", "SchemeName", "schemeName",
];

/** Common spellings a scheme's category might be returned under. */
const SCHEME_TYPE_FIELD_CANDIDATES = [
    "Scheme Type", "scheme_type", "SCHEME_TYPE", "SchemeType", "schemeType",
];

/** Read the first present field from a list of candidate key names. */
function pickField(row, candidates) {
    for (const key of candidates) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
            return String(row[key]).trim();
        }
    }

    return null;
}

/**
 * Find the array of scheme records inside an arbitrarily-wrapped API
 * response, since the exact response envelope isn't documented.
 *
 * @param {*} json
 * @returns {Array<object>|null}
 */
function extractSchemeRows(json) {
    if (Array.isArray(json)) {
        return json;
    }

    if (json && typeof json === "object") {
        // Depth-1 scan: most APIs wrap the array under a single key like
        // `data`, `Data`, `result`, `schemes`, etc.
        for (const value of Object.values(json)) {
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
                return value;
            }
        }

        // Depth-2 scan, for a doubly-wrapped response.
        for (const value of Object.values(json)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const nested = extractSchemeRows(value);

                if (nested) {
                    return nested;
                }
            }
        }
    }

    return null;
}

/**
 * Fetch the full master scheme list from BSE.
 *
 * @param {string} token a short-lived bearer token obtained from BSE login
 *
 * @returns {Promise<Array<{schemeName: string, schemeType: string}>>}
 */
async function fetchMasterSchemeList(token) {
    if (!token || !String(token).trim()) {
        throw new CustomError(
            500,
            "A valid BSE STAR MF bearer token is required before loading the master scheme list"
        );
    }

    let response;

    try {
        response = await fetch(MASTER_SCHEME_LIST_URL, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        throw new CustomError(502, `Failed to reach BSE master scheme list API: ${error.message}`);
    }

    if (!response.ok) {
        throw new CustomError(
            response.status >= 500 ? 502 : response.status,
            `BSE master scheme list API request failed (HTTP ${response.status})`
        );
    }

    let json;

    try {
        json = await response.json();
    } catch (error) {
        throw new CustomError(502, `BSE master scheme list API returned invalid JSON: ${error.message}`);
    }

    const rows = extractSchemeRows(json);

    if (!rows) {
        throw new CustomError(
            502,
            "BSE master scheme list API response did not contain a recognisable scheme list"
        );
    }

    const schemes = [];

    for (const row of rows) {
        const schemeName = pickField(row, SCHEME_NAME_FIELD_CANDIDATES);
        const schemeType = pickField(row, SCHEME_TYPE_FIELD_CANDIDATES);

        if (schemeName && schemeType) {
            schemes.push({ schemeName, schemeType });
        }
    }

    if (schemes.length === 0) {
        throw new CustomError(
            502,
            "BSE master scheme list API response did not contain any usable scheme name/type pairs"
        );
    }

    return schemes;
}

module.exports = { fetchMasterSchemeList, extractSchemeRows, pickField };
