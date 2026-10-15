/**
 * Karvy transaction persistence helpers, shared by the database service.
 *
 * Mirrors `cams_transactions/camsPersistence.js` exactly in shape and
 * intent — maps every CSV header to a Prisma field, and provides stable
 * SHA-256 idempotency fingerprints plus safe date conversion — but for
 * Karvy's own, entirely different 90-column "Transaction Feeds Report"
 * CSV. Kept as a fully separate file (not shared with the CAMS one)
 * since the two column sets have nothing in common.
 */
import crypto from "crypto";

/** Maps each Karvy "Transaction Feeds Report" CSV header to a first-class Prisma column. No raw CSV/JSON is persisted. */
const KARVY_TRANSACTION_FIELDS = {
    "Product Code": "productCode",
    "Fund": "fund",
    "Folio Number": "folioNumber",
    "Scheme Code": "schemeCode",
    "Fund Description": "fundDescription",
    "Transaction Head": "transactionHead",
    "Transaction Number": "transactionNumber",
    "Switch_Ref. No.": "switchRefNo",
    "Instrument Number": "instrumentNumber",
    "Investor Name": "investorName",
    "Transaction Mode": "transactionMode",
    "Transaction Status": "transactionStatus",
    "Branch Name": "branchName",
    "Branch Transaction No": "branchTransactionNo",
    "Transaction Date": "transactionDate",
    "Process Date": "processDate",
    "Price": "price",
    "Units": "units",
    "Amount": "amount",
    "Agent Code": "agentCode",
    "Sub-Broker Code": "subBrokerCode",
    "Brokerage Percentage": "brokeragePercentage",
    "Commission": "commission",
    "Investor ID": "investorId",
    "Report Date": "reportDate",
    "Report Time": "reportTime",
    "Transaction Sub": "transactionSub",
    "Application Number": "applicationNumber",
    "Transaction ID": "transactionId",
    "Transaction Description": "transactionDescription",
    "Transaction Type": "transactionType",
    "Instrument Date": "instrumentDate",
    "Instrument Bank": "instrumentBank",
    "Dividend Option": "dividendOption",
    "Purchase Amount": "purchaseAmount",
    "Purchase Date": "purchaseDate",
    "Switch Fund Date": "switchFundDate",
    "Transaction Flag": "transactionFlag",
    "Nav": "nav",
    "Purchase Transaction No": "purchaseTransactionNo",
    "STT": "stt",
    "Load Percentage": "loadPercentage",
    "Load Amount": "loadAmount",
    "Purchase Units": "purchaseUnits",
    "Ihno": "ihno",
    "Branch Code": "branchCode",
    "Inward Number": "inwardNumber",
    "PAN1": "pan1",
    "Remarks": "remarks",
    "Nav Date": "navDate",
    "PAN2": "pan2",
    "PAN3": "pan3",
    "TDSAmount": "tdsAmount",
    "Scheme": "scheme",
    "Plan": "plan",
    "ToProductCode": "toProductCode",
    "td_trxnmode": "tdTrxnmode",
    "ClientId": "clientId",
    "DpId": "dpId",
    "Status": "status",
    "RejTrnoOrgNo": "rejTrnoOrgNo",
    "SubTranType": "subTranType",
    "TrCharges": "trCharges",
    "ATMCardStatus": "atmCardStatus",
    "ATMCardRemarks": "atmCardRemarks",
    "NCT Change Date": "nctChangeDate",
    "ISIN": "isin",
    "CityCategory": "cityCategory",
    "PortDate": "portDate",
    "NewUnqno": "newUnqno",
    "EUIN": "euin",
    "Sub Broker ARN Code": "subBrokerArnCode",
    "EUIN Valid Indicator": "euinValidIndicator",
    "EUIN Declaration Indicator": "euinDeclarationIndicator",
    "AssetType": "assetType",
    "SIP Regn Date": "sipRegnDate",
    "DivPer": "divPer",
    "GuardPanNo": "guardPanNo",
    "Common Account Number": "commonAccountNumber",
    "Exchange OrgTrType": "exchangeOrgTrType",
    "Electronic transaction Flag": "electronicTransactionFlag",
    "sipregslno": "sipregslno",
    "chequeclearnce": "chequeclearnce",
    "InvestorState": "investorState",
    "Retail Flag": "retailFlag",
    "Stamp Duty Charges": "stampDutyCharges",
    "Feed Type": "feedType",
    "UTR No": "utrNo",
    "Payment Instrument Type": "paymentInstrumentType",
    "Bank Acno": "bankAcno",
};

/** Hash a string with SHA-256, used to build short, stable fingerprints. */
function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

/** Turn null/undefined into an empty string and trim everything else, so fingerprints are stable. */
function canonicalize(value) {
    return value === null || value === undefined ? "" : String(value).trim();
}

/**
 * Build a stable fingerprint identifying one report, from its email
 * identifiers (the same generic identifier shape every email service
 * in this codebase produces). Two reports with the same identifiers
 * always produce the same fingerprint, which is what lets the database
 * service recognise "we've already seen this report before".
 */
function reportFingerprint(identifiers = {}) {
    return sha256(["messageId", "reportRequestNumber", "reportNumber", "dispatchDateTime", "toEmail"]
        .map((key) => `${key}=${canonicalize(identifiers[key])}`).join("|"));
}

/** Map one CSV transaction record's fields onto their Prisma column names. */
function transactionData(record) {
    const data = {};
    for (const [csvField, prismaField] of Object.entries(KARVY_TRANSACTION_FIELDS)) {
        data[prismaField] = record[csvField] === undefined ? null : record[csvField];
    }
    return data;
}

/**
 * Build a stable fingerprint identifying one transaction row, from all
 * of its Karvy field values. Used to silently drop exact-duplicate rows.
 */
function transactionFingerprint(record) {
    return sha256(Object.keys(KARVY_TRANSACTION_FIELDS)
        .map((csvField) => `${csvField}=${canonicalize(record[csvField])}`).join("|"));
}

/** Safely convert a value to a Date, returning null instead of an invalid date. */
function validDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export { KARVY_TRANSACTION_FIELDS, reportFingerprint, transactionData, transactionFingerprint, validDate };
