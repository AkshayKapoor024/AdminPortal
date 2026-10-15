/**
 * BSE STAR MF authentication helper.
 *
 * Logs in once per ingestion run and returns the short-lived bearer token
 * needed by the master-scheme endpoint. Credentials and tokens never enter
 * errors or logs.
 */
import CustomError from "../customError.js";

const BSE_STARMF_LOGIN_URL = "https://starmfv2demo.bseindia.com/api/login";

function findBearerToken(value) {
    if (!value || typeof value !== "object") return null;

    for (const [key, nestedValue] of Object.entries(value)) {
        if (typeof nestedValue === "string" && /^(access_?)?token$|^jwt(?:token)?$/i.test(key) && nestedValue.trim()) {
            return nestedValue.trim();
        }

        if (nestedValue && typeof nestedValue === "object") {
            const token = findBearerToken(nestedValue);
            if (token) return token;
        }
    }

    return null;
}

/** Authenticate with BSE using `BSE_STARMF_USERNAME` and `BSE_STARMF_PASSWORD`. */
async function authenticateBseStarmf() {
    const username = process.env.BSE_STARMF_USERNAME;
    const password = process.env.BSE_STARMF_PASSWORD;

    if (!username || !password) {
        throw new CustomError(500, "BSE_STARMF_USERNAME and BSE_STARMF_PASSWORD must be configured");
    }

    let response;
    try {
        response = await fetch(BSE_STARMF_LOGIN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: { username, password } }),
        });
    } catch (error) {
        throw new CustomError(502, `Failed to reach BSE STAR MF login API: ${error.message}`);
    }

    if (!response.ok) {
        throw new CustomError(response.status >= 500 ? 502 : response.status, `BSE STAR MF login failed (HTTP ${response.status})`);
    }

    let json;
    try {
        json = await response.json();
    } catch (error) {
        throw new CustomError(502, `BSE STAR MF login API returned invalid JSON: ${error.message}`);
    }

    const token = findBearerToken(json);
    if (!token) {
        throw new CustomError(502, "BSE STAR MF login succeeded but did not return a bearer token");
    }

    return token;
}

export { authenticateBseStarmf, findBearerToken, BSE_STARMF_LOGIN_URL };
