# TechDev exam rollout and migration-history warning

## Current rollout

The applicant exam and Super Admin preview share the public question bank in `src/data/techdev-exam.ts`. Choice keys and scoring helpers are server-only. Only Super Admins and active, current-cycle TechDev EB admins can access `/api/admin/techdev-exam`. Written answers are graded manually (0–5 points).

Before deploying the review feature, compare the configured database against the schema:

```sh
pnpm exec prisma validate
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

The existing configured database already contained `TechDevExamAttempt`. The newly added review feature needed `manualScores`, `reviewedAt`, and `reviewedById`. With explicit user approval, only these additive columns were applied using `prisma/manual/techdev-exam-review-columns.sql`. A subsequent schema diff reported no differences. This verifies the configured database, not that every deployment uses the same database URL.

The manual SQL is intentionally outside `prisma/migrations`: it neither bootstraps an empty database nor repairs migration history. It uses a transaction and bounded lock/statement timeouts and does not modify answers, statuses, application records, or `_prisma_migrations`.

## Historical migration drift remains unresolved

**Do not run `prisma migrate deploy`, `migrate reset`, or blanket `db push` against the existing database.** The build generates Prisma Client only and does not apply migrations.

The last audited database ledger contained:

- `20250905132408_cssapply`
- `20250906092513_add_role_field` (source missing locally)
- `20261006150000_add_community_join_confirmation`

These local migrations were not recorded in that ledger:

- `20260323000000_add_eb_profile_image`
- `20260324000000_add_applicant_sex`
- `20260325000000_add_payment_receipt_review`
- `20260928110000_add_needs_revision_payment_status`
- `20260928120000_merge_redirected_application_records`

Their schema effects already exist, including the sex/payment check constraints. Audited redirect duplicate-pair counts were zero; that is not proof of historical execution. Do not replay receipt approval backfills or redirected-record deletion SQL. Membership, recruitment-cycle, attendance, and TechDev schema changes also lack a complete replayable migration history.

## Safe recovery plan (not performed)

1. Recover missing migration sources from the original deployer/backups and verify checksums against the ledger. Do not invent a replacement for an applied migration under its existing name.
2. Capture a verified database backup and schema/constraint/index inventory; use a separate disposable database for all replay tests.
3. Prefer recovering a complete replayable history. If unavailable, explicitly approve a baseline/squash strategy, preserve the historical ledger as an audit artifact, and document how every deployed database will be transitioned.
4. Include custom PostgreSQL check constraints and data-migration semantics: Prisma schema diffs alone do not prove these were applied correctly.
5. Verify both empty-database replay and an upgrade against a restored database before approving any production ledger changes or normal migration deployment.

## Post-deploy smoke checks

- Super Admin: open TechDev Exam Preview and TechDev Exam Results.
- Current-cycle TechDev EB admin: can review; ordinary applicants and other EB committees: API denied.
- Eligible TechDev applicant after interview: start/resume/save/submit; submitted answers remain immutable under a concurrent save.
- Reviewer: grade, clear, and reload written scores; stale edits must not overwrite a newer review.
- Verify deployment uses the database whose schema was checked. No reminder emails are part of this rollout.
