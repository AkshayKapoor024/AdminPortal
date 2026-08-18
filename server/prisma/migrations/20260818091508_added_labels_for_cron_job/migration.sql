-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "dueDateLabel" TEXT NOT NULL DEFAULT 'Upcoming';

-- CreateTable
CREATE TABLE "Lead" (
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
    "primary_user" TEXT NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_mobile_key" ON "Lead"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_pan_key" ON "Lead"("pan");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_primary_user_fkey" FOREIGN KEY ("primary_user") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
