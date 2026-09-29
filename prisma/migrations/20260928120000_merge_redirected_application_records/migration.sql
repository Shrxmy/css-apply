-- Keep the accepted destination application as the canonical record for a
-- redirected applicant. Accepted source records are redundant and can cause
-- duplicate exports. Same-type committee redirects are normalized in place.

DELETE FROM "CommitteeApplication" source
USING "MemberApplication" destination
WHERE source."recruitmentCycleId" = destination."recruitmentCycleId"
  AND source."hasAccepted" = true
  AND source.redirection = 'member'
  AND destination."studentNumber" = source."studentNumber"
  AND destination."hasAccepted" = true;

DELETE FROM "CommitteeApplication" source
USING "EAApplication" destination
WHERE source."recruitmentCycleId" = destination."recruitmentCycleId"
  AND source."hasAccepted" = true
  AND source.redirection NOT LIKE 'committee-%'
  AND source.redirection <> 'member'
  AND destination."studentNumber" = source."studentNumber"
  AND destination."ebRole" = source.redirection
  AND destination."hasAccepted" = true;

DELETE FROM "EAApplication" source
USING "CommitteeApplication" destination
WHERE source."recruitmentCycleId" = destination."recruitmentCycleId"
  AND source."hasAccepted" = true
  AND source.redirection LIKE 'committee-%'
  AND destination."studentNumber" = source."studentNumber"
  AND destination."firstOptionCommittee" = substring(source.redirection from 11)
  AND destination."hasAccepted" = true;

UPDATE "CommitteeApplication"
SET "firstOptionCommittee" = substring(redirection from 11),
    "secondOptionCommittee" = '',
    redirection = NULL
WHERE "hasAccepted" = true
  AND redirection LIKE 'committee-%';
