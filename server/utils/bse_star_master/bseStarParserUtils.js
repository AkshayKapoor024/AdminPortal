/**
 * BSE Star MF Scheme Master Text Parser.
 *
 * Parses pipe-delimited text files into objects matching the BseSchemeMaster model.
 */

const HEADER_INDEX_MAP = {
    0: "uniqueNo",
    1: "schemeCode",
    2: "rtaSchemeCode",
    3: "amcSchemeCode",
    4: "isin",
    5: "amcCode",
    6: "schemeType",
    7: "schemePlan",
    8: "schemeName",
    9: "purchaseAllowed",
    10: "purchaseTransactionMode",
    11: "minimumPurchaseAmount",
    12: "additionalPurchaseAmount",
    13: "maximumPurchaseAmount",
    14: "purchaseAmountMultiplier",
    15: "purchaseCutoffTime",
    16: "redemptionAllowed",
    17: "redemptionTransactionMode",
    18: "minimumRedemptionQty",
    19: "redemptionQtyMultiplier",
    20: "maximumRedemptionQty",
    21: "redemptionAmountMinimum",
    22: "redemptionAmountMaximum",
    23: "redemptionAmountMultiple",
    24: "redemptionCutoffTime",
    25: "rtaAgentCode",
    26: "amcActiveFlag",
    27: "dividendReinvestmentFlag",
    28: "sipFlag",
    29: "stpFlag",
    30: "swpFlag",
    31: "switchFlag",
    32: "settlementType",
    33: "amcInd",
    34: "faceValue",
    35: "startDate",
    36: "endDate",
    37: "exitLoadFlag",
    38: "exitLoad",
    39: "lockInPeriodFlag",
    40: "lockInPeriod",
    41: "channelPartnerCode",
    42: "reopeningDate",
};

/**
 * Parse a pipe-delimited BSE Star scheme master text string into array of objects.
 *
 * @param {string|Buffer} textContent
 * @returns {Array<object>} Array of parsed scheme objects ready for Prisma insertion.
 */
function parseBseSchemeMasterText(textContent) {
    if (Buffer.isBuffer(textContent)) {
        textContent = textContent.toString("utf-8");
    }

    if (!textContent || typeof textContent !== "string") {
        return [];
    }

    const lines = textContent.split(/\r?\n/);
    if (lines.length < 2) {
        return [];
    }

    const records = [];

    // Line 0 is header row. Process lines from index 1.
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split("|");
        // Must at least have schemeCode (index 1) and schemeName (index 8)
        if (parts.length < 9) continue;

        const schemeCode = parts[1] ? parts[1].trim() : "";
        const schemeName = parts[8] ? parts[8].trim() : "";

        if (!schemeCode || !schemeName) continue;

        const record = {};

        for (const [colIdxStr, fieldName] of Object.entries(HEADER_INDEX_MAP)) {
            const colIdx = parseInt(colIdxStr, 10);
            if (colIdx < parts.length) {
                const val = parts[colIdx] ? parts[colIdx].trim() : "";
                record[fieldName] = val !== "" ? val : null;
            } else {
                record[fieldName] = null;
            }
        }

        // Required non-null fields
        record.schemeCode = schemeCode;
        record.schemeName = schemeName;

        records.push(record);
    }

    return records;
}

module.exports = { parseBseSchemeMasterText, HEADER_INDEX_MAP };
