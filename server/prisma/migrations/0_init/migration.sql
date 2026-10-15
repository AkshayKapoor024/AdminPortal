-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AumImportSource" AS ENUM ('AMFI', 'COMPANY');

-- CreateEnum
CREATE TYPE "public"."AumImportStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."CamsReportStatus" AS ENUM ('RECEIVED', 'PARSED', 'STORED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."KarvyReportStatus" AS ENUM ('RECEIVED', 'PARSED', 'STORED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."bse_webhook_events" (
    "id" SERIAL NOT NULL,
    "request_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(255),
    "event_name" VARCHAR(255),
    "msgcode" VARCHAR(255),
    "client_code" VARCHAR(255),
    "status" VARCHAR(255) NOT NULL DEFAULT 'RECEIVED',
    "error_message" TEXT,
    "retry_count" INTEGER DEFAULT 0,
    "payload" TEXT,
    "received_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bse_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bse_webhook_events_client_code" ON "public"."bse_webhook_events"("client_code" ASC);

-- CreateIndex
CREATE INDEX "bse_webhook_events_event_type" ON "public"."bse_webhook_events"("event_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bse_webhook_events_request_id" ON "public"."bse_webhook_events"("request_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bse_webhook_events_request_id_key" ON "public"."bse_webhook_events"("request_id" ASC);

-- CreateIndex
CREATE INDEX "bse_webhook_events_status" ON "public"."bse_webhook_events"("status" ASC);

