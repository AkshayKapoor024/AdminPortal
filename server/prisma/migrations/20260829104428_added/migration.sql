-- CreateEnum
CREATE TYPE "AumImportSource" AS ENUM ('AMFI', 'COMPANY');

-- CreateEnum
CREATE TYPE "AumImportStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'PROCESSING', 'COMPLETED', 'FAILED');

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
    "aum" DECIMAL(20,4) NOT NULL,
    "aaum" DECIMAL(20,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_aum_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "company_aum_period_id_category_id_key" ON "company_aum"("period_id", "category_id");

-- CreateIndex
CREATE INDEX "aum_imports_period_id_idx" ON "aum_imports"("period_id");

-- CreateIndex
CREATE INDEX "aum_imports_source_status_idx" ON "aum_imports"("source", "status");

-- CreateIndex
CREATE UNIQUE INDEX "aum_imports_source_period_id_key" ON "aum_imports"("source", "period_id");

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
ALTER TABLE "aum_imports" ADD CONSTRAINT "aum_imports_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "aum_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
