-- Allow authorized reviewers to request acknowledgement receipt revisions
-- without rejecting the applicant's accepted application.

ALTER TABLE "MemberApplication"
  DROP CONSTRAINT IF EXISTS "MemberApplication_paymentStatus_check";
ALTER TABLE "MemberApplication"
  ADD CONSTRAINT "MemberApplication_paymentStatus_check"
  CHECK ("paymentStatus" IN ('not_submitted', 'pending', 'approved', 'rejected', 'needs_revision'));

ALTER TABLE "CommitteeApplication"
  DROP CONSTRAINT IF EXISTS "CommitteeApplication_paymentStatus_check";
ALTER TABLE "CommitteeApplication"
  ADD CONSTRAINT "CommitteeApplication_paymentStatus_check"
  CHECK ("paymentStatus" IN ('not_submitted', 'pending', 'approved', 'rejected', 'needs_revision'));

ALTER TABLE "EAApplication"
  DROP CONSTRAINT IF EXISTS "EAApplication_paymentStatus_check";
ALTER TABLE "EAApplication"
  ADD CONSTRAINT "EAApplication_paymentStatus_check"
  CHECK ("paymentStatus" IN ('not_submitted', 'pending', 'approved', 'rejected', 'needs_revision'));
