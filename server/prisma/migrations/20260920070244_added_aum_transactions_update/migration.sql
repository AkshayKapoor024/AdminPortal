/*
  Warnings:

  - You are about to drop the column `scheme_count` on the `company_aum` table. All the data in the column will be lost.
  - You are about to drop the column `scheme_fingerprints` on the `company_aum` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[period_id,scheme_name]` on the table `company_aum` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `last_updated_date` to the `company_aum` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheme_name` to the `company_aum` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "KarvyReportStatus" AS ENUM ('RECEIVED', 'PARSED', 'STORED', 'SKIPPED', 'FAILED');

-- DropIndex
DROP INDEX "company_aum_period_id_category_id_key";

-- AlterTable
ALTER TABLE "company_aum" DROP COLUMN "scheme_count",
DROP COLUMN "scheme_fingerprints",
ADD COLUMN     "amc_code" TEXT,
ADD COLUMN     "days_recorded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_updated_date" DATE NOT NULL,
ADD COLUMN     "scheme_name" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "karvy_transaction_reports" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "identifierFingerprint" TEXT NOT NULL,
    "reportRequestNumber" TEXT,
    "reportNumber" TEXT,
    "dispatchDateTime" TIMESTAMP(3),
    "toEmail" TEXT,
    "status" "KarvyReportStatus" NOT NULL,
    "error" TEXT,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "processingAttempts" INTEGER NOT NULL DEFAULT 1,
    "parsedAt" TIMESTAMP(3),
    "storedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "karvy_transaction_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karvy_transactions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productCode" TEXT,
    "fund" TEXT,
    "folioNumber" TEXT,
    "schemeCode" TEXT,
    "fundDescription" TEXT,
    "transactionHead" TEXT,
    "transactionNumber" TEXT,
    "switchRefNo" TEXT,
    "instrumentNumber" TEXT,
    "investorName" TEXT,
    "transactionMode" TEXT,
    "transactionStatus" TEXT,
    "branchName" TEXT,
    "branchTransactionNo" TEXT,
    "transactionDate" TEXT,
    "processDate" TEXT,
    "price" TEXT,
    "units" TEXT,
    "amount" TEXT,
    "agentCode" TEXT,
    "subBrokerCode" TEXT,
    "brokeragePercentage" TEXT,
    "commission" TEXT,
    "investorId" TEXT,
    "reportDate" TEXT,
    "reportTime" TEXT,
    "transactionSub" TEXT,
    "applicationNumber" TEXT,
    "transactionId" TEXT,
    "transactionDescription" TEXT,
    "transactionType" TEXT,
    "instrumentDate" TEXT,
    "instrumentBank" TEXT,
    "dividendOption" TEXT,
    "purchaseAmount" TEXT,
    "purchaseDate" TEXT,
    "switchFundDate" TEXT,
    "transactionFlag" TEXT,
    "nav" TEXT,
    "purchaseTransactionNo" TEXT,
    "stt" TEXT,
    "loadPercentage" TEXT,
    "loadAmount" TEXT,
    "purchaseUnits" TEXT,
    "ihno" TEXT,
    "branchCode" TEXT,
    "inwardNumber" TEXT,
    "pan1" TEXT,
    "remarks" TEXT,
    "navDate" TEXT,
    "pan2" TEXT,
    "pan3" TEXT,
    "tdsAmount" TEXT,
    "scheme" TEXT,
    "plan" TEXT,
    "toProductCode" TEXT,
    "tdTrxnmode" TEXT,
    "clientId" TEXT,
    "dpId" TEXT,
    "status" TEXT,
    "rejTrnoOrgNo" TEXT,
    "subTranType" TEXT,
    "trCharges" TEXT,
    "atmCardStatus" TEXT,
    "atmCardRemarks" TEXT,
    "nctChangeDate" TEXT,
    "isin" TEXT,
    "cityCategory" TEXT,
    "portDate" TEXT,
    "newUnqno" TEXT,
    "euin" TEXT,
    "subBrokerArnCode" TEXT,
    "euinValidIndicator" TEXT,
    "euinDeclarationIndicator" TEXT,
    "assetType" TEXT,
    "sipRegnDate" TEXT,
    "divPer" TEXT,
    "guardPanNo" TEXT,
    "commonAccountNumber" TEXT,
    "exchangeOrgTrType" TEXT,
    "electronicTransactionFlag" TEXT,
    "sipregslno" TEXT,
    "chequeclearnce" TEXT,
    "investorState" TEXT,
    "retailFlag" TEXT,
    "stampDutyCharges" TEXT,
    "feedType" TEXT,
    "utrNo" TEXT,
    "paymentInstrumentType" TEXT,
    "bankAcno" TEXT,

    CONSTRAINT "karvy_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "karvy_transaction_reports_messageId_key" ON "karvy_transaction_reports"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "karvy_transaction_reports_identifierFingerprint_key" ON "karvy_transaction_reports"("identifierFingerprint");

-- CreateIndex
CREATE INDEX "karvy_transaction_reports_reportRequestNumber_idx" ON "karvy_transaction_reports"("reportRequestNumber");

-- CreateIndex
CREATE INDEX "karvy_transaction_reports_dispatchDateTime_idx" ON "karvy_transaction_reports"("dispatchDateTime");

-- CreateIndex
CREATE INDEX "karvy_transactions_folioNumber_idx" ON "karvy_transactions"("folioNumber");

-- CreateIndex
CREATE INDEX "karvy_transactions_pan1_idx" ON "karvy_transactions"("pan1");

-- CreateIndex
CREATE INDEX "karvy_transactions_transactionNumber_idx" ON "karvy_transactions"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "karvy_transactions_reportId_fingerprint_key" ON "karvy_transactions"("reportId", "fingerprint");

-- CreateIndex
CREATE INDEX "company_aum_amc_code_idx" ON "company_aum"("amc_code");

-- CreateIndex
CREATE UNIQUE INDEX "company_aum_period_id_scheme_name_key" ON "company_aum"("period_id", "scheme_name");

-- AddForeignKey
ALTER TABLE "karvy_transactions" ADD CONSTRAINT "karvy_transactions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "karvy_transaction_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
