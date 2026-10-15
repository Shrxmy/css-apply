-- Explicitly approved additive setup: ONLY these two new campaign tables.
-- Does not replay historical migrations or modify application/account records.
-- Prisma generates ids and updatedAt values; existing migration history is untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS "EmailCampaign" (
  "id" TEXT NOT NULL,
  "recruitmentCycleId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT,
  "subject" TEXT NOT NULL,
  "templateType" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "messageIds" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailCampaign_status_check" CHECK ("status" IN ('DRAFT','SENDING','ACCEPTED','FAILED','UNKNOWN')),
  CONSTRAINT "EmailCampaign_templateType_check" CHECK ("templateType" IN ('event','reminder'))
);

CREATE TABLE IF NOT EXISTS "EmailCampaignRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "groups" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EmailCampaignRecipient_status_check" CHECK ("status" IN ('PENDING','SENDING','ACCEPTED','FAILED','UNKNOWN'))
);

CREATE INDEX IF NOT EXISTS "EmailCampaign_recruitmentCycleId_createdAt_idx" ON "EmailCampaign"("recruitmentCycleId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailCampaign_status_idx" ON "EmailCampaign"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailCampaignRecipient_campaignId_userId_key" ON "EmailCampaignRecipient"("campaignId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailCampaignRecipient_campaignId_email_key" ON "EmailCampaignRecipient"("campaignId", "email");
CREATE INDEX IF NOT EXISTS "EmailCampaignRecipient_campaignId_status_idx" ON "EmailCampaignRecipient"("campaignId", "status");

COMMIT;
