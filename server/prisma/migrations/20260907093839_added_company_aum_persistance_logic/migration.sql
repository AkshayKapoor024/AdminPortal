-- AlterTable
ALTER TABLE "company_aum" ADD COLUMN     "scheme_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheme_fingerprints" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "company_aum_file_imports" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "file_name" TEXT,
    "file_hash" TEXT NOT NULL,
    "status" "AumImportStatus" NOT NULL DEFAULT 'PENDING',
    "matched_scheme_count" INTEGER NOT NULL DEFAULT 0,
    "unmatched_scheme_count" INTEGER NOT NULL DEFAULT 0,
    "total_closing_assets" DECIMAL(20,4),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "company_aum_file_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_aum_file_imports_period_id_idx" ON "company_aum_file_imports"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_aum_file_imports_period_id_file_hash_key" ON "company_aum_file_imports"("period_id", "file_hash");

-- AddForeignKey
ALTER TABLE "company_aum_file_imports" ADD CONSTRAINT "company_aum_file_imports_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "aum_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
