import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmailBatch } from "@/lib/email";
import {
  campaignContentSchema,
  buildCampaignEmail,
} from "@/lib/email-campaign-content";
import { getEmailCampaignAudience } from "@/lib/email-campaign-recipients";
import {
  EMAIL_CAMPAIGN_RECIPIENT_LIMIT,
  type EmailCampaignAudienceRecipient,
  type EmailCampaignCounts,
  type EmailCampaignDetail,
  type EmailCampaignSummary,
} from "@/lib/email-campaign-contract";

// Authorization and explicit confirmed:true belong to the Super Admin API boundary.
export class EmailCampaignError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EmailCampaignError";
  }
}

const identifierSchema = z.string().trim().min(1).max(200);
const createSchema = z
  .object({
    clientRequestId: z
      .string()
      .uuid()
      .transform((id) => id.toLowerCase()),
    recruitmentCycleId: identifierSchema,
    content: campaignContentSchema,
    recipientIds: z
      .array(identifierSchema)
      .min(1)
      .max(EMAIL_CAMPAIGN_RECIPIENT_LIMIT)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
const statusSchema = z.enum([
  "DRAFT",
  "SENDING",
  "ACCEPTED",
  "FAILED",
  "UNKNOWN",
]);
const recipientStatusSchema = z.enum([
  "PENDING",
  "SENDING",
  "ACCEPTED",
  "FAILED",
  "UNKNOWN",
]);
const templateSchema = z.enum(["event", "reminder"]);
const groupsSchema = z
  .array(z.enum(["ea", "staff", "member"]))
  .min(1)
  .max(3);
const uncertainMessage =
  "The provider outcome is uncertain. Do not resend this campaign.";
const rejectedMessage =
  "The email provider rejected this campaign. This campaign cannot be sent again.";
const trackingMessage =
  "The provider accepted the campaign but tracking failed. DO NOT RESEND.";
const audienceMessage =
  "The active cycle or selected recipients have changed. Review the audience and create a new draft.";

const summarySelect = {
  id: true,
  subject: true,
  templateType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  acceptedAt: true,
  errorMessage: true,
  recipients: { select: { status: true } },
} satisfies Prisma.EmailCampaignSelect;
type SummaryRow = Prisma.EmailCampaignGetPayload<{
  select: typeof summarySelect;
}>;
type DetailRow = Prisma.EmailCampaignGetPayload<{
  include: { recipients: true };
}>;
type CreateInput = z.infer<typeof createSchema>;

function savedValue<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new EmailCampaignError(
      500,
      "The saved campaign could not be read safely.",
    );
  return parsed.data;
}

function summary(row: SummaryRow): EmailCampaignSummary {
  const counts: EmailCampaignCounts = {
    total: row.recipients.length,
    pending: 0,
    sending: 0,
    accepted: 0,
    failed: 0,
    unknown: 0,
  };
  for (const recipient of row.recipients) {
    switch (savedValue(recipientStatusSchema, recipient.status)) {
      case "PENDING":
        counts.pending++;
        break;
      case "SENDING":
        counts.sending++;
        break;
      case "ACCEPTED":
        counts.accepted++;
        break;
      case "FAILED":
        counts.failed++;
        break;
      case "UNKNOWN":
        counts.unknown++;
        break;
    }
  }
  const status = savedValue(statusSchema, row.status);
  return {
    id: row.id,
    subject: row.subject,
    templateType: savedValue(templateSchema, row.templateType),
    status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    counts,
    // A crashed worker must not make a stuck SENDING record look retryable.
    errorMessage: status === "SENDING" ? uncertainMessage : row.errorMessage,
  };
}

function detail(row: DetailRow): EmailCampaignDetail {
  return {
    ...summary(row),
    content: savedValue(campaignContentSchema, row.content),
    recipients: row.recipients.map((recipient) => ({
      userId: recipient.userId,
      name: recipient.name,
      email: recipient.email,
      groups: savedValue(groupsSchema, recipient.groups),
      status: savedValue(recipientStatusSchema, recipient.status),
    })),
  };
}

async function readCampaign(id: string): Promise<DetailRow> {
  const parsed = identifierSchema.safeParse(id);
  if (!parsed.success)
    throw new EmailCampaignError(400, "Invalid campaign ID.");
  const row = await prisma.emailCampaign.findUnique({
    where: { id: parsed.data },
    include: { recipients: true },
  });
  if (!row) throw new EmailCampaignError(404, "Email campaign not found.");
  return row;
}

function sameDraft(
  row: DetailRow,
  input: CreateInput,
  actorId: string,
): EmailCampaignDetail {
  const savedContent = campaignContentSchema.safeParse(row.content);
  const sameIds =
    row.recipients.length === input.recipientIds.length &&
    row.recipients.every((recipient) =>
      input.recipientIds.includes(recipient.userId),
    );
  if (
    row.createdById !== actorId ||
    row.recruitmentCycleId !== input.recruitmentCycleId ||
    !savedContent.success ||
    JSON.stringify(savedContent.data) !== JSON.stringify(input.content) ||
    !sameIds
  ) {
    throw new EmailCampaignError(
      409,
      "This request ID already belongs to a different campaign request.",
    );
  }
  return detail(row);
}

async function selectedAudience(
  cycleId: string,
  ids: string[],
  db?: Parameters<typeof getEmailCampaignAudience>[0],
): Promise<EmailCampaignAudienceRecipient[]> {
  // The helper is the sole authority for ACTIVE-cycle acceptance, canonical
  // redirection groups, and eligibility independent of payment status.
  const audience = await getEmailCampaignAudience(db);
  if (!audience.cycle || audience.cycle.id !== cycleId)
    throw new EmailCampaignError(409, audienceMessage);
  const byId = new Map(
    audience.recipients.map((recipient) => [recipient.userId, recipient]),
  );
  const selected: EmailCampaignAudienceRecipient[] = [];
  const emails = new Set<string>();
  for (const id of ids) {
    const recipient = byId.get(id);
    if (!recipient) throw new EmailCampaignError(409, audienceMessage);
    const email = recipient.email.trim().toLowerCase();
    if (
      !z.email().safeParse(email).success ||
      emails.has(email) ||
      !groupsSchema.safeParse(recipient.groups).success
    ) {
      throw new EmailCampaignError(409, audienceMessage);
    }
    emails.add(email);
    selected.push({ ...recipient, email });
  }
  return selected;
}

function errorProperty(error: unknown, key: string): unknown {
  return error && typeof error === "object" && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

export async function createEmailCampaign(
  input: unknown,
  actor: { id: string; name: string | null },
): Promise<EmailCampaignDetail> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    throw new EmailCampaignError(
      400,
      "Invalid email campaign request. Select 1–250 unique eligible recipients and valid content.",
    );
  const data = parsed.data;
  const existing = await prisma.emailCampaign.findUnique({
    where: { id: data.clientRequestId },
    include: { recipients: true },
  });
  // Retry an ambiguous creation even if eligibility has changed in the meantime.
  if (existing) return sameDraft(existing, data, actor.id);
  const recipients = await selectedAudience(
    data.recruitmentCycleId,
    data.recipientIds,
  );
  const rendered = buildCampaignEmail(data.content);
  let row: DetailRow;
  try {
    // A nested write is atomic, including all immutable recipient snapshots.
    row = await prisma.emailCampaign.create({
      data: {
        id: data.clientRequestId,
        recruitmentCycleId: data.recruitmentCycleId,
        createdById: actor.id,
        createdByName: actor.name,
        subject: rendered.subject,
        templateType: data.content.templateType,
        content: { ...data.content } as Prisma.InputJsonObject,
        recipients: {
          create: recipients.map((recipient) => ({
            userId: recipient.userId,
            name: recipient.name,
            email: recipient.email,
            groups: [...recipient.groups],
          })),
        },
      },
      include: { recipients: true },
    });
  } catch (error) {
    if (errorProperty(error, "code") === "P2002") {
      const winner = await prisma.emailCampaign.findUnique({
        where: { id: data.clientRequestId },
        include: { recipients: true },
      });
      if (winner) return sameDraft(winner, data, actor.id);
      throw new EmailCampaignError(
        409,
        "The campaign contains conflicting recipient snapshots.",
      );
    }
    throw new EmailCampaignError(
      502,
      "Unable to confirm draft creation. Retry with the same client request ID.",
    );
  }
  return detail(row);
}

export async function listEmailCampaigns(): Promise<EmailCampaignSummary[]> {
  // Fetch only statuses for counts, never bodies or recipient identity for history.
  const rows = await prisma.emailCampaign.findMany({
    take: 50,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: summarySelect,
  });
  return rows.map(summary);
}

export async function getEmailCampaign(
  id: string,
): Promise<EmailCampaignDetail> {
  return detail(await readCampaign(id));
}

function cannotSend(): EmailCampaignError {
  return new EmailCampaignError(
    409,
    "This campaign has already been claimed or attempted and cannot be sent again. Check history; do not resend uncertain outcomes.",
  );
}

// Exactly two bulk updates per outcome, committed together. No per-user writes.
async function recordOutcome(
  id: string,
  recipientCount: number,
  status: "ACCEPTED" | "FAILED" | "UNKNOWN",
  errorMessage: string | null,
  messageIds?: Prisma.InputJsonObject,
): Promise<void> {
  const acceptedAt = status === "ACCEPTED" ? new Date() : null;
  await prisma.$transaction(async (tx) => {
    const campaign = await tx.emailCampaign.updateMany({
      where: { id, status: "SENDING" },
      data: {
        status,
        acceptedAt,
        errorMessage,
        ...(messageIds ? { messageIds } : {}),
      },
    });
    if (campaign.count !== 1) throw cannotSend();
    const recipients = await tx.emailCampaignRecipient.updateMany({
      where: { campaignId: id, status: "SENDING" },
      data: { status, acceptedAt },
    });
    if (recipients.count !== recipientCount)
      throw new EmailCampaignError(
        502,
        "Unable to track all campaign recipients.",
      );
  });
}

export async function sendEmailCampaign(
  id: string,
): Promise<EmailCampaignDetail> {
  const row = await readCampaign(id);
  if (row.status === "ACCEPTED") return detail(row); // Safe replay, not delivery.
  if (row.status !== "DRAFT") throw cannotSend();
  const parsed = campaignContentSchema.safeParse(row.content);
  if (!parsed.success)
    throw new EmailCampaignError(
      409,
      "The saved campaign content is invalid. Create a new draft.",
    );
  const rendered = buildCampaignEmail(parsed.data);
  const ids = row.recipients.map((recipient) => recipient.userId);
  if (
    row.templateType !== parsed.data.templateType ||
    row.subject !== rendered.subject ||
    ids.length < 1 ||
    ids.length > EMAIL_CAMPAIGN_RECIPIENT_LIMIT ||
    new Set(ids).size !== ids.length ||
    row.recipients.some(
      (recipient) =>
        recipient.status !== "PENDING" ||
        !groupsSchema.safeParse(recipient.groups).success,
    )
  ) {
    throw new EmailCampaignError(
      409,
      "The saved campaign snapshot is invalid. Create a new draft.",
    );
  }
  let claimed: boolean;
  try {
    claimed = await prisma.$transaction(async (tx) => {
      const campaign = await tx.emailCampaign.updateMany({
        where: { id: row.id, status: "DRAFT" },
        data: { status: "SENDING", startedAt: new Date(), errorMessage: null },
      });
      if (campaign.count !== 1) return false;
      // Revalidate under the campaign claim. A stale audience rolls the entire
      // claim back to the untouched draft; provider I/O remains outside the tx.
      const current = await selectedAudience(row.recruitmentCycleId, ids, tx);
      if (
        current.some(
          (recipient, index) => recipient.email !== row.recipients[index].email,
        )
      ) {
        throw new EmailCampaignError(409, audienceMessage);
      }
      const recipients = await tx.emailCampaignRecipient.updateMany({
        where: { campaignId: row.id, status: "PENDING" },
        data: { status: "SENDING" },
      });
      if (recipients.count !== ids.length)
        throw new EmailCampaignError(
          409,
          "The recipient snapshot changed. No dispatch was attempted.",
        );
      return true;
    });
  } catch (error) {
    if (error instanceof EmailCampaignError) throw error;
    // A commit response may itself be ambiguous. Never dispatch without a known claim.
    throw new EmailCampaignError(
      502,
      "Unable to confirm the campaign claim. Check history before taking further action.",
    );
  }
  if (!claimed) {
    const latest = await readCampaign(row.id);
    if (latest.status === "ACCEPTED") return detail(latest);
    throw cannotSend();
  }

  let result: Awaited<ReturnType<typeof sendEmailBatch>>;
  try {
    // This is the only provider call. Never retry, reset, or automatically resume.
    result = await sendEmailBatch(
      row.recipients.map((recipient) => recipient.email),
      rendered.subject,
      rendered.html,
      {
        maxRetries: 0,
        timeoutInSeconds: 30,
      },
    );
  } catch (error) {
    result = { success: false, error };
  }

  if (result.success) {
    const messageIds = {
      messageId: result.messageId ?? null,
      messageIds: result.messageIds ?? [],
    };
    try {
      await recordOutcome(row.id, ids.length, "ACCEPTED", null, messageIds);
      return await getEmailCampaign(row.id);
    } catch {
      // Log only provider identifiers/counts, never content, addresses or raw errors.
      console.error(
        "[email-campaigns] Provider accepted but tracking failed; DO NOT RESEND",
        {
          campaignId: row.id,
          recipientCount: ids.length,
          ...messageIds,
        },
      );
      try {
        await recordOutcome(
          row.id,
          ids.length,
          "UNKNOWN",
          trackingMessage,
          messageIds,
        );
      } catch {
        /* Keep SENDING (or already ACCEPTED after ambiguous commit), never DRAFT. */
      }
      throw new EmailCampaignError(502, trackingMessage);
    }
  }

  const statusCode =
    errorProperty(result.error, "statusCode") ??
    errorProperty(result.error, "status");
  const definitive =
    typeof statusCode === "number" &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode < 500 &&
    statusCode !== 408;
  const status = definitive ? "FAILED" : "UNKNOWN";
  const message = definitive ? rejectedMessage : uncertainMessage;
  try {
    await recordOutcome(row.id, ids.length, status, message);
    return await getEmailCampaign(row.id);
  } catch {
    console.error(
      "[email-campaigns] Attempt outcome tracking failed; DO NOT RESEND",
      {
        campaignId: row.id,
        recipientCount: ids.length,
        status,
      },
    );
    throw new EmailCampaignError(
      502,
      "The campaign was attempted but tracking failed. Check history; DO NOT RESEND.",
    );
  }
}
