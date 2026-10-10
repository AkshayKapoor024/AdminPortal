/**
 * BSE Star MF Scheme Master Scraper Utility.
 *
 * Automated downloader for the Scheme Code Master Details text file from BSE Star MF:
 * URL: https://www.bsestarmf.in/RptSchemeMaster.aspx
 *
 * Performs ASP.NET GET -> extracts __VIEWSTATE, __EVENTVALIDATION -> POST request with ddlTypeOption=SCHEMEMASTER.
 */

const CustomError = require("../customError");

const BSE_SCHEME_MASTER_URL = "https://www.bsestarmf.in/RptSchemeMaster.aspx";

/**
 * Download the latest BSE Star Scheme Master text file.
 *
 * @returns {Promise<string>} The full raw text content (pipe-delimited).
 */
async function fetchLatestBseSchemeMasterText() {
    console.log("[BseStarScraper] Requesting GET page from BSE Star MF...");

    let getRes;
    try {
        getRes = await fetch(BSE_SCHEME_MASTER_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });
    } catch (error) {
        throw new CustomError(502, `Failed to connect to BSE Star MF website: ${error.message}`);
    }

    if (!getRes.ok) {
        throw new CustomError(getRes.status >= 500 ? 502 : getRes.status, `BSE Star MF GET request failed with HTTP ${getRes.status}`);
    }

    const html = await getRes.text();

    const vsMatch = html.match(/id="__VIEWSTATE" value="([^"]*)"/);
    const vsgMatch = html.match(/id="__VIEWSTATEGENERATOR" value="([^"]*)"/);
    const evMatch = html.match(/id="__EVENTVALIDATION" value="([^"]*)"/);

    if (!vsMatch || !evMatch) {
        throw new CustomError(502, "Failed to parse ASP.NET viewstate / event validation parameters from BSE Star MF page");
    }

    console.log("[BseStarScraper] Extracted ASP.NET tokens. Submitting POST request for scheme master text export...");

    const params = new URLSearchParams();
    params.append("__VIEWSTATE", vsMatch[1]);
    params.append("__VIEWSTATEGENERATOR", vsgMatch ? vsgMatch[1] : "");
    params.append("__VIEWSTATEENCRYPTED", "");
    params.append("__EVENTVALIDATION", evMatch[1]);
    params.append("ddlTypeOption", "SCHEMEMASTER");
    params.append("btnText", "Export to Text");

    let postRes;
    try {
        postRes = await fetch(BSE_SCHEME_MASTER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            body: params,
        });
    } catch (error) {
        throw new CustomError(502, `Failed to submit POST export request to BSE Star MF: ${error.message}`);
    }

    if (!postRes.ok) {
        throw new CustomError(postRes.status >= 500 ? 502 : postRes.status, `BSE Star MF POST export request failed with HTTP ${postRes.status}`);
    }

    const textContent = await postRes.text();

    if (!textContent || textContent.length < 1000) {
        throw new CustomError(502, "BSE Star MF returned empty or unexpectedly small scheme master export file");
    }

    console.log(`[BseStarScraper] Successfully downloaded BSE Star Scheme Master text file (${(textContent.length / 1024 / 1024).toFixed(2)} MB).`);

    return textContent;
}

module.exports = { fetchLatestBseSchemeMasterText, BSE_SCHEME_MASTER_URL };
