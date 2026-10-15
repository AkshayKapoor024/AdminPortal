-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueDateLabel" TEXT NOT NULL DEFAULT 'Upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "interested" TEXT NOT NULL,
    "lead_value" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "follow_up_date" TIMESTAMP(3) NOT NULL,
    "follow_up_label" TEXT NOT NULL DEFAULT 'Upcoming',
    "reminder" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "documents" TEXT[],
    "clientId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cams_reports" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "identifierFingerprint" TEXT NOT NULL,
    "reportRequestNumber" TEXT,
    "reportNumber" TEXT,
    "dispatchDateTime" TIMESTAMP(3),
    "toEmail" TEXT,
    "status" "CamsReportStatus" NOT NULL,
    "error" TEXT,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "processingAttempts" INTEGER NOT NULL DEFAULT 1,
    "parsedAt" TIMESTAMP(3),
    "storedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cams_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cams_transactions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amcCode" TEXT,
    "folioNo" TEXT,
    "prodcode" TEXT,
    "scheme" TEXT,
    "invName" TEXT,
    "trxntype" TEXT,
    "trxnno" TEXT,
    "trxnmode" TEXT,
    "trxnstat" TEXT,
    "usercode" TEXT,
    "usrtrxno" TEXT,
    "traddate" TEXT,
    "postdate" TEXT,
    "purprice" TEXT,
    "units" TEXT,
    "amount" TEXT,
    "brokcode" TEXT,
    "subbrok" TEXT,
    "brokperc" TEXT,
    "brokcomm" TEXT,
    "altfolio" TEXT,
    "repDate" TEXT,
    "time1" TEXT,
    "trxnsubtyp" TEXT,
    "applicationNo" TEXT,
    "trxnNature" TEXT,
    "tax" TEXT,
    "totalTax" TEXT,
    "te15h" TEXT,
    "micrNo" TEXT,
    "remarks" TEXT,
    "swflag" TEXT,
    "oldFolio" TEXT,
    "seqNo" TEXT,
    "reinvestFlag" TEXT,
    "multBrok" TEXT,
    "stt" TEXT,
    "location" TEXT,
    "schemeType" TEXT,
    "taxStatus" TEXT,
    "load" TEXT,
    "scanrefno" TEXT,
    "pan" TEXT,
    "invIin" TEXT,
    "targSrcScheme" TEXT,
    "trxnTypeFlag" TEXT,
    "ticobTrtype" TEXT,
    "ticobTrno" TEXT,
    "ticobPostedDate" TEXT,
    "dpId" TEXT,
    "trxnCharges" TEXT,
    "eligibAmt" TEXT,
    "srcOfTxn" TEXT,
    "trxnSuffix" TEXT,
    "siptrxnno" TEXT,
    "terLocation" TEXT,
    "euin" TEXT,
    "euinValid" TEXT,
    "euinOpted" TEXT,
    "subBrkArn" TEXT,
    "exchDcFlag" TEXT,
    "srcBrkCode" TEXT,
    "sysRegnDate" TEXT,
    "acNo" TEXT,
    "bankName" TEXT,
    "reversalCode" TEXT,
    "exchangeFlag" TEXT,
    "caInitiatedDate" TEXT,
    "gstStateCode" TEXT,
    "igstAmount" TEXT,
    "cgstAmount" TEXT,
    "sgstAmount" TEXT,
    "revRemark" TEXT,
    "originalTrxnno" TEXT,
    "stampDuty" TEXT,
    "folioOld" TEXT,
    "schemeFolioNumber" TEXT,
    "amcRefNo" TEXT,
    "requestRefNo" TEXT,
    "transmissionFlag" TEXT,

    CONSTRAINT "cams_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aum_periods" (
    "id" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aum_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aum_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "is_leaf" BOOLEAN NOT NULL DEFAULT false,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aum_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_aum" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "aum" DECIMAL(20,4) NOT NULL,
    "aaum" DECIMAL(20,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_aum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_aum" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "scheme_name" TEXT NOT NULL,
    "amc_code" TEXT,
    "aum" DECIMAL(20,4) NOT NULL,
    "aaum" DECIMAL(20,4) NOT NULL,
    "days_recorded" INTEGER NOT NULL DEFAULT 0,
    "last_updated_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_aum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_aum_file_imports" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "file_name" TEXT,
    "file_hash" TEXT NOT NULL,
    "arn_no" TEXT,
    "report_from_date" TEXT,
    "report_to_date" TEXT,
    "status" "AumImportStatus" NOT NULL DEFAULT 'PENDING',
    "matched_scheme_count" INTEGER NOT NULL DEFAULT 0,
    "unmatched_scheme_count" INTEGER NOT NULL DEFAULT 0,
    "total_closing_assets" DECIMAL(20,4),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "company_aum_file_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aum_imports" (
    "id" TEXT NOT NULL,
    "source" "AumImportSource" NOT NULL,
    "period_id" TEXT NOT NULL,
    "file_url" TEXT,
    "file_name" TEXT,
    "status" "AumImportStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aum_imports_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "bse_scheme_masters" (
    "id" TEXT NOT NULL,
    "unique_no" TEXT,
    "scheme_code" TEXT NOT NULL,
    "rta_scheme_code" TEXT,
    "amc_scheme_code" TEXT,
    "isin" TEXT,
    "amc_code" TEXT,
    "scheme_type" TEXT,
    "scheme_plan" TEXT,
    "scheme_name" TEXT NOT NULL,
    "purchase_allowed" TEXT,
    "purchase_transaction_mode" TEXT,
    "minimum_purchase_amount" TEXT,
    "additional_purchase_amount" TEXT,
    "maximum_purchase_amount" TEXT,
    "purchase_amount_multiplier" TEXT,
    "purchase_cutoff_time" TEXT,
    "redemption_allowed" TEXT,
    "redemption_transaction_mode" TEXT,
    "minimum_redemption_qty" TEXT,
    "redemption_qty_multiplier" TEXT,
    "maximum_redemption_qty" TEXT,
    "redemption_amount_minimum" TEXT,
    "redemption_amount_maximum" TEXT,
    "redemption_amount_multiple" TEXT,
    "redemption_cutoff_time" TEXT,
    "rta_agent_code" TEXT,
    "amc_active_flag" TEXT,
    "dividend_reinvestment_flag" TEXT,
    "sip_flag" TEXT,
    "stp_flag" TEXT,
    "swp_flag" TEXT,
    "switch_flag" TEXT,
    "settlement_type" TEXT,
    "amc_ind" TEXT,
    "face_value" TEXT,
    "start_date" TEXT,
    "end_date" TEXT,
    "exit_load_flag" TEXT,
    "exit_load" TEXT,
    "lock_in_period_flag" TEXT,
    "lock_in_period" TEXT,
    "channel_partner_code" TEXT,
    "reopening_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bse_scheme_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_mobile_key" ON "leads"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "leads_pan_key" ON "leads"("pan");

-- CreateIndex
CREATE UNIQUE INDEX "cams_reports_messageId_key" ON "cams_reports"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "cams_reports_identifierFingerprint_key" ON "cams_reports"("identifierFingerprint");

-- CreateIndex
CREATE INDEX "cams_reports_reportRequestNumber_idx" ON "cams_reports"("reportRequestNumber");

-- CreateIndex
CREATE INDEX "cams_reports_dispatchDateTime_idx" ON "cams_reports"("dispatchDateTime");

-- CreateIndex
CREATE INDEX "cams_transactions_folioNo_idx" ON "cams_transactions"("folioNo");

-- CreateIndex
CREATE INDEX "cams_transactions_pan_idx" ON "cams_transactions"("pan");

-- CreateIndex
CREATE INDEX "cams_transactions_trxnno_idx" ON "cams_transactions"("trxnno");

-- CreateIndex
CREATE UNIQUE INDEX "cams_transactions_reportId_fingerprint_key" ON "cams_transactions"("reportId", "fingerprint");

-- CreateIndex
CREATE INDEX "aum_periods_period_end_idx" ON "aum_periods"("period_end");

-- CreateIndex
CREATE UNIQUE INDEX "aum_periods_financial_year_quarter_key" ON "aum_periods"("financial_year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "aum_categories_code_key" ON "aum_categories"("code");

-- CreateIndex
CREATE INDEX "aum_categories_parent_id_idx" ON "aum_categories"("parent_id");

-- CreateIndex
CREATE INDEX "aum_categories_level_idx" ON "aum_categories"("level");

-- CreateIndex
CREATE INDEX "industry_aum_category_id_idx" ON "industry_aum"("category_id");

-- CreateIndex
CREATE INDEX "industry_aum_period_id_idx" ON "industry_aum"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "industry_aum_period_id_category_id_key" ON "industry_aum"("period_id", "category_id");

-- CreateIndex
CREATE INDEX "company_aum_category_id_idx" ON "company_aum"("category_id");

-- CreateIndex
CREATE INDEX "company_aum_period_id_idx" ON "company_aum"("period_id");

-- CreateIndex
CREATE INDEX "company_aum_amc_code_idx" ON "company_aum"("amc_code");

-- CreateIndex
CREATE UNIQUE INDEX "company_aum_period_id_scheme_name_key" ON "company_aum"("period_id", "scheme_name");

-- CreateIndex
CREATE INDEX "company_aum_file_imports_period_id_idx" ON "company_aum_file_imports"("period_id");

-- CreateIndex
CREATE INDEX "company_aum_file_imports_arn_no_idx" ON "company_aum_file_imports"("arn_no");

-- CreateIndex
CREATE UNIQUE INDEX "company_aum_file_imports_period_id_file_hash_key" ON "company_aum_file_imports"("period_id", "file_hash");

-- CreateIndex
CREATE INDEX "aum_imports_period_id_idx" ON "aum_imports"("period_id");

-- CreateIndex
CREATE INDEX "aum_imports_source_status_idx" ON "aum_imports"("source", "status");

-- CreateIndex
CREATE UNIQUE INDEX "aum_imports_source_period_id_key" ON "aum_imports"("source", "period_id");

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
CREATE INDEX "bse_scheme_masters_scheme_code_idx" ON "bse_scheme_masters"("scheme_code");

-- CreateIndex
CREATE INDEX "bse_scheme_masters_isin_idx" ON "bse_scheme_masters"("isin");

-- CreateIndex
CREATE INDEX "bse_scheme_masters_scheme_name_idx" ON "bse_scheme_masters"("scheme_name");

-- CreateIndex
CREATE INDEX "bse_scheme_masters_amc_code_idx" ON "bse_scheme_masters"("amc_code");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cams_transactions" ADD CONSTRAINT "cams_transactions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "cams_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aum_categories" ADD CONSTRAINT "aum_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "aum_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_aum" ADD CONSTRAINT "industry_aum_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "aum_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_aum" ADD CONSTRAINT "industry_aum_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "aum_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_aum" ADD CONSTRAINT "company_aum_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "aum_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_aum" ADD CONSTRAINT "company_aum_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "aum_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_aum_file_imports" ADD CONSTRAINT "company_aum_file_imports_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "aum_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aum_imports" ADD CONSTRAINT "aum_imports_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "aum_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karvy_transactions" ADD CONSTRAINT "karvy_transactions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "karvy_transaction_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
