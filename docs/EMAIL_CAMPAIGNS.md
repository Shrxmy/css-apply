# Super Admin email composer

## Sending an announcement

Open **Super Admin → Email Composer**.

1. Choose **Event announcement** or **General reminder**.
2. Enter a subject, heading, and plain-text message. Event date, time, and venue are optional. A button requires both a label and an HTTPS URL.
3. Filter the audience by Executive Associates, Committee Staff, or Members. Search and select the individual recipients to include (maximum **250**).
4. Preview the formatted email, review the recipients, and explicitly confirm the send.
5. Check the campaign status in history. **Provider accepted** means Brevo accepted the request—not that every inbox received it.

Only current database Super Admins can access these endpoints. Audience eligibility is **accepted in the active recruitment cycle, regardless of payment status**, as explicitly requested. Accepted redirections use their destination group. Addresses are normalized and deduplicated; a person matching multiple groups receives only one copy. Existing payment-gated community invitations are unchanged.

Each recipient is a separate Brevo message version, so other recipients' email addresses are not disclosed. Provider daily limits still apply. There are no scheduled sends, automatic sends, or automatic retries.

## Recovery and duplicate-send protection

- A client-generated request ID identifies one immutable draft. Retrying a creation request with that same ID cannot silently create a second campaign.
- Sending atomically claims a draft before contacting Brevo. A campaign cannot be dispatched again after its first attempt, even under concurrent requests.
- The server rechecks the active cycle, acceptance, and email addresses immediately before sending.
- Provider calls disable SDK retries and have a 30-second timeout. Claim and outcome storage do not hold a database transaction open during provider I/O.
- Provider acceptance is recorded with two bulk updates in a transaction, not one transaction per recipient.
- **Sending / Unknown**, a network timeout, or acceptance followed by a tracking failure must be investigated in Brevo before any deliberate new send. Do not reset a campaign to Draft or recreate it as an automatic retry.
- A provider rejection is recorded as **Failed**. No automated retry is performed. Fix the cause and review whether a deliberate new campaign is appropriate.
- Never infer delivery from the API acceptance response. Check Brevo transactional logs and, when needed, the recipient's inbox.

## Approved additive database setup

The user approved only these two new tracking tables:

- `EmailCampaign`: immutable content, creator and cycle snapshots, state, timestamps, and provider IDs.
- `EmailCampaignRecipient`: immutable selected-recipient snapshots and attempt outcomes.

`prisma/manual/email-campaign-tracking-tables.sql` creates only those tables, their indexes, checks, and their mutual foreign key, in a transaction with bounded lock/statement timeouts. It does not alter application/account tables or the migration ledger. Historical sender/cycle/account IDs are snapshots; deleting an application or account does not rewrite the audit record.

**The existing migration-history drift remains unresolved. Do not run `prisma migrate deploy`, `migrate reset`, or blanket `db push` against the existing database.** See [TechDev rollout and recovery guidance](TECHDEV_EXAM_ROLLOUT.md).

Before applying the approved SQL to any additional environment:

1. Confirm the target database and obtain the appropriate backup/approval.
2. Run a read-only schema diff. The expected additions are exactly the two campaign tables, indexes, and their foreign key. Stop if other changes are proposed.
3. Apply only the reviewed manual SQL, then verify schema parity and the custom check constraints. Do not repair or replay the historical migration ledger.

```sh
pnpm exec prisma validate
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
# Apply only the explicitly approved manual SQL through the controlled database connection.
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

The approved setup was applied to the configured database on October 15, 2026. The only added tables were the two listed above, both initially empty; the migration-ledger fingerprint was unchanged and the post-setup schema diff reported no differences. This verifies the configured database, not every deployment's database URL.

The build generates Prisma Client only. It does not install these tables automatically or apply historical migrations.

## Offline verification and rollout smoke checks

```sh
node --test tests/*.test.cjs
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Before the first real campaign, verify the composer at desktop and mobile widths; access denial for ordinary admins/applicants; active-cycle audience and accepted redirections; preview escaping; group/individual selection; explicit confirmation; and history refresh. Only send a real test email or campaign with explicit recipient approval. Never use existing applicant reminder batches as a smoke test.
