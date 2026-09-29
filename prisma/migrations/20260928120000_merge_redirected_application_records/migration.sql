-- Keep the original application as the canonical record after a redirect.
-- The destination application is merged into the source only for payment-review
-- fields, then removed so exports contain one record per applicant.

UPDATE "CommitteeApplication" source
SET "hasAccepted" = true,
    status = 'passed',
    "paymentProof" = destination."paymentProof",
    "paymentStatus" = destination."paymentStatus",
    "paymentReviewedAt" = destination."paymentReviewedAt",
    "paymentReviewedBy" = destination."paymentReviewedBy",
    "paymentRejectionReason" = destination."paymentRejectionReason"
FROM "EAApplication" destination
WHERE source."recruitmentCycleId" = destination."recruitmentCycleId"
  AND source."hasAccepted" = true
  AND source.redirection = destination."ebRole"
  AND destination."studentNumber" = source."studentNumber"
  AND destination."hasAccepted" = true;

DELETE FROM "EAApplication" destination
WHERE destination."hasAccepted" = true
  AND EXISTS (
    SELECT 1
    FROM "CommitteeApplication" source
    WHERE source."studentNumber" = destination."studentNumber"
      AND source."recruitmentCycleId" = destination."recruitmentCycleId"
      AND source."hasAccepted" = true
      AND source.redirection = destination."ebRole"
  );

UPDATE "EAApplication" source
SET "hasAccepted" = true,
    status = 'passed',
    "paymentProof" = destination."paymentProof",
    "paymentStatus" = destination."paymentStatus",
    "paymentReviewedAt" = destination."paymentReviewedAt",
    "paymentReviewedBy" = destination."paymentReviewedBy",
    "paymentRejectionReason" = destination."paymentRejectionReason"
FROM "CommitteeApplication" destination
WHERE source."recruitmentCycleId" = destination."recruitmentCycleId"
  AND source."hasAccepted" = true
  AND source.redirection IN (
    'committee-' || destination."firstOptionCommittee",
    destination."firstOptionCommittee"
  )
  AND destination."studentNumber" = source."studentNumber"
  AND destination."hasAccepted" = true;

DELETE FROM "CommitteeApplication" destination
WHERE destination."hasAccepted" = true
  AND EXISTS (
    SELECT 1
    FROM "EAApplication" source
    WHERE source."studentNumber" = destination."studentNumber"
      AND source."recruitmentCycleId" = destination."recruitmentCycleId"
      AND source."hasAccepted" = true
      AND source.redirection IN (
        'committee-' || destination."firstOptionCommittee",
        destination."firstOptionCommittee"
      )
  );

UPDATE "CommitteeApplication" source
SET "hasAccepted" = true,
    status = 'passed',
    "paymentProof" = destination."paymentProof",
    "paymentStatus" = destination."paymentStatus",
    "paymentReviewedAt" = destination."paymentReviewedAt",
    "paymentReviewedBy" = destination."paymentReviewedBy",
    "paymentRejectionReason" = destination."paymentRejectionReason"
FROM "MemberApplication" destination
WHERE source."recruitmentCycleId" = destination."recruitmentCycleId"
  AND source."hasAccepted" = true
  AND source.redirection = 'member'
  AND destination."studentNumber" = source."studentNumber"
  AND destination."hasAccepted" = true;

DELETE FROM "MemberApplication" destination
WHERE destination."hasAccepted" = true
  AND EXISTS (
    SELECT 1
    FROM "CommitteeApplication" source
    WHERE source."studentNumber" = destination."studentNumber"
      AND source."recruitmentCycleId" = destination."recruitmentCycleId"
      AND source."hasAccepted" = true
      AND source.redirection = 'member'
  );
