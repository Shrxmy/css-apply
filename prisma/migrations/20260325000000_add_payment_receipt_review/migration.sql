-- Add Treasurer review state to acknowledgement receipts.
ALTER TABLE "MemberApplication"
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN "paymentReviewedAt" TIMESTAMP(3),
  ADD COLUMN "paymentReviewedBy" TEXT,
  ADD COLUMN "paymentRejectionReason" TEXT;

ALTER TABLE "EAApplication"
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN "paymentReviewedAt" TIMESTAMP(3),
  ADD COLUMN "paymentReviewedBy" TEXT,
  ADD COLUMN "paymentRejectionReason" TEXT;

ALTER TABLE "CommitteeApplication"
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN "paymentReviewedAt" TIMESTAMP(3),
  ADD COLUMN "paymentReviewedBy" TEXT,
  ADD COLUMN "paymentRejectionReason" TEXT;

-- Preserve the release state of receipts submitted before Treasurer review existed.
UPDATE "MemberApplication"
SET "paymentStatus" = 'approved', "paymentReviewedAt" = "updatedAt"
WHERE BTRIM("paymentProof") <> '';

UPDATE "EAApplication"
SET "paymentStatus" = 'approved', "paymentReviewedAt" = "updatedAt"
WHERE "paymentProof" IS NOT NULL AND BTRIM("paymentProof") <> '';

UPDATE "CommitteeApplication"
SET "paymentStatus" = 'approved', "paymentReviewedAt" = "updatedAt"
WHERE "paymentProof" IS NOT NULL AND BTRIM("paymentProof") <> '';

ALTER TABLE "MemberApplication"
  ADD CONSTRAINT "MemberApplication_paymentStatus_check"
  CHECK ("paymentStatus" IN ('not_submitted', 'pending', 'approved', 'rejected'));

ALTER TABLE "EAApplication"
  ADD CONSTRAINT "EAApplication_paymentStatus_check"
  CHECK ("paymentStatus" IN ('not_submitted', 'pending', 'approved', 'rejected'));

ALTER TABLE "CommitteeApplication"
  ADD CONSTRAINT "CommitteeApplication_paymentStatus_check"
  CHECK ("paymentStatus" IN ('not_submitted', 'pending', 'approved', 'rejected'));

CREATE INDEX "MemberApplication_recruitmentCycleId_paymentStatus_idx"
  ON "MemberApplication"("recruitmentCycleId", "paymentStatus");
CREATE INDEX "EAApplication_recruitmentCycleId_paymentStatus_idx"
  ON "EAApplication"("recruitmentCycleId", "paymentStatus");
CREATE INDEX "CommitteeApplication_recruitmentCycleId_paymentStatus_idx"
  ON "CommitteeApplication"("recruitmentCycleId", "paymentStatus");
