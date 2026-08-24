/**
 * CAMS persistence helpers shared by the database service.
 * Maps every CSV header to a Prisma field and provides stable SHA-256
 * idempotency fingerprints plus safe date conversion.
 */
const crypto = require("crypto");

/* Maps each CAMS CSV header to a first-class Prisma column. No raw CSV/JSON is persisted. */
const CAMS_TRANSACTION_FIELDS = {
    AMC_CODE: "amcCode", FOLIO_NO: "folioNo", PRODCODE: "prodcode", SCHEME: "scheme",
    INV_NAME: "invName", TRXNTYPE: "trxntype", TRXNNO: "trxnno", TRXNMODE: "trxnmode",
    TRXNSTAT: "trxnstat", USERCODE: "usercode", USRTRXNO: "usrtrxno", TRADDATE: "traddate",
    POSTDATE: "postdate", PURPRICE: "purprice", UNITS: "units", AMOUNT: "amount",
    BROKCODE: "brokcode", SUBBROK: "subbrok", BROKPERC: "brokperc", BROKCOMM: "brokcomm",
    ALTFOLIO: "altfolio", REP_DATE: "repDate", TIME1: "time1", TRXNSUBTYP: "trxnsubtyp",
    APPLICATION_NO: "applicationNo", TRXN_NATURE: "trxnNature", TAX: "tax", TOTAL_TAX: "totalTax",
    TE_15H: "te15h", MICR_NO: "micrNo", REMARKS: "remarks", SWFLAG: "swflag",
    OLD_FOLIO: "oldFolio", SEQ_NO: "seqNo", REINVEST_FLAG: "reinvestFlag", MULT_BROK: "multBrok",
    STT: "stt", LOCATION: "location", SCHEME_TYPE: "schemeType", TAX_STATUS: "taxStatus",
    LOAD: "load", SCANREFNO: "scanrefno", PAN: "pan", INV_IIN: "invIin",
    TARG_SRC_SCHEME: "targSrcScheme", TRXN_TYPE_FLAG: "trxnTypeFlag", TICOB_TRTYPE: "ticobTrtype",
    TICOB_TRNO: "ticobTrno", TICOB_POSTED_DATE: "ticobPostedDate", DP_ID: "dpId",
    TRXN_CHARGES: "trxnCharges", ELIGIB_AMT: "eligibAmt", SRC_OF_TXN: "srcOfTxn",
    TRXN_SUFFIX: "trxnSuffix", SIPTRXNNO: "siptrxnno", TER_LOCATION: "terLocation", EUIN: "euin",
    EUIN_VALID: "euinValid", EUIN_OPTED: "euinOpted", SUB_BRK_ARN: "subBrkArn",
    EXCH_DC_FLAG: "exchDcFlag", SRC_BRK_CODE: "srcBrkCode", SYS_REGN_DATE: "sysRegnDate",
    AC_NO: "acNo", BANK_NAME: "bankName", REVERSAL_CODE: "reversalCode", EXCHANGE_FLAG: "exchangeFlag",
    CA_INITIATED_DATE: "caInitiatedDate", GST_STATE_CODE: "gstStateCode", IGST_AMOUNT: "igstAmount",
    CGST_AMOUNT: "cgstAmount", SGST_AMOUNT: "sgstAmount", REV_REMARK: "revRemark",
    ORIGINAL_TRXNNO: "originalTrxnno", STAMP_DUTY: "stampDuty", FOLIO_OLD: "folioOld",
    SCHEME_FOLIO_NUMBER: "schemeFolioNumber", AMC_REF_NO: "amcRefNo", REQUEST_REF_NO: "requestRefNo",
    TRANSMISSION_FLAG: "transmissionFlag",
};

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

function reportFingerprint(identifiers = {}) {
    return sha256(["messageId", "reportRequestNumber", "reportNumber", "dispatchDateTime", "toEmail"]
        .map((key) => `${key}=${canonicalize(identifiers[key])}`).join("|"));
}

function transactionData(record) {
    const data = {};
    for (const [csvField, prismaField] of Object.entries(CAMS_TRANSACTION_FIELDS)) {
        data[prismaField] = record[csvField] === undefined ? null : record[csvField];
    }
    return data;
}

function transactionFingerprint(record) {
    return sha256(Object.keys(CAMS_TRANSACTION_FIELDS)
        .map((csvField) => `${csvField}=${canonicalize(record[csvField])}`).join("|"));
}

function validDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = { CAMS_TRANSACTION_FIELDS, reportFingerprint, transactionData, transactionFingerprint, validDate };
