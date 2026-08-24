-- CAMS ingestion storage. Every CSV field is persisted as an individual column.
CREATE TYPE "CamsReportStatus" AS ENUM ('RECEIVED', 'PARSED', 'STORED', 'SKIPPED', 'FAILED');

CREATE TABLE "cams_reports" (
  "id" TEXT NOT NULL, "messageId" TEXT, "identifierFingerprint" TEXT NOT NULL,
  "reportRequestNumber" TEXT, "reportNumber" TEXT, "dispatchDateTime" TIMESTAMP(3), "toEmail" TEXT,
  "status" "CamsReportStatus" NOT NULL, "error" TEXT, "transactionCount" INTEGER NOT NULL DEFAULT 0,
  "processingAttempts" INTEGER NOT NULL DEFAULT 1, "parsedAt" TIMESTAMP(3), "storedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cams_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cams_transactions" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amcCode" TEXT, "folioNo" TEXT, "prodcode" TEXT, "scheme" TEXT, "invName" TEXT, "trxntype" TEXT,
  "trxnno" TEXT, "trxnmode" TEXT, "trxnstat" TEXT, "usercode" TEXT, "usrtrxno" TEXT, "traddate" TEXT,
  "postdate" TEXT, "purprice" TEXT, "units" TEXT, "amount" TEXT, "brokcode" TEXT, "subbrok" TEXT,
  "brokperc" TEXT, "brokcomm" TEXT, "altfolio" TEXT, "repDate" TEXT, "time1" TEXT, "trxnsubtyp" TEXT,
  "applicationNo" TEXT, "trxnNature" TEXT, "tax" TEXT, "totalTax" TEXT, "te15h" TEXT, "micrNo" TEXT,
  "remarks" TEXT, "swflag" TEXT, "oldFolio" TEXT, "seqNo" TEXT, "reinvestFlag" TEXT, "multBrok" TEXT,
  "stt" TEXT, "location" TEXT, "schemeType" TEXT, "taxStatus" TEXT, "load" TEXT, "scanrefno" TEXT,
  "pan" TEXT, "invIin" TEXT, "targSrcScheme" TEXT, "trxnTypeFlag" TEXT, "ticobTrtype" TEXT,
  "ticobTrno" TEXT, "ticobPostedDate" TEXT, "dpId" TEXT, "trxnCharges" TEXT, "eligibAmt" TEXT,
  "srcOfTxn" TEXT, "trxnSuffix" TEXT, "siptrxnno" TEXT, "terLocation" TEXT, "euin" TEXT,
  "euinValid" TEXT, "euinOpted" TEXT, "subBrkArn" TEXT, "exchDcFlag" TEXT, "srcBrkCode" TEXT,
  "sysRegnDate" TEXT, "acNo" TEXT, "bankName" TEXT, "reversalCode" TEXT, "exchangeFlag" TEXT,
  "caInitiatedDate" TEXT, "gstStateCode" TEXT, "igstAmount" TEXT, "cgstAmount" TEXT, "sgstAmount" TEXT,
  "revRemark" TEXT, "originalTrxnno" TEXT, "stampDuty" TEXT, "folioOld" TEXT, "schemeFolioNumber" TEXT,
  "amcRefNo" TEXT, "requestRefNo" TEXT, "transmissionFlag" TEXT,
  CONSTRAINT "cams_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cams_reports_messageId_key" ON "cams_reports"("messageId");
CREATE UNIQUE INDEX "cams_reports_identifierFingerprint_key" ON "cams_reports"("identifierFingerprint");
CREATE INDEX "cams_reports_reportRequestNumber_idx" ON "cams_reports"("reportRequestNumber");
CREATE INDEX "cams_reports_dispatchDateTime_idx" ON "cams_reports"("dispatchDateTime");
CREATE UNIQUE INDEX "cams_transactions_reportId_fingerprint_key" ON "cams_transactions"("reportId", "fingerprint");
CREATE INDEX "cams_transactions_folioNo_idx" ON "cams_transactions"("folioNo");
CREATE INDEX "cams_transactions_pan_idx" ON "cams_transactions"("pan");
CREATE INDEX "cams_transactions_trxnno_idx" ON "cams_transactions"("trxnno");
ALTER TABLE "cams_transactions" ADD CONSTRAINT "cams_transactions_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "cams_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
