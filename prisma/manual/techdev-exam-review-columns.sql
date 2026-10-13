-- Approved additive repair for an existing TechDevExamAttempt table.
-- This is NOT part of migrate deploy: historical migration drift remains unresolved.
-- Do not use this script to bootstrap an empty database.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "public"."TechDevExamAttempt"
  ADD COLUMN IF NOT EXISTS "manualScores" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

COMMIT;
