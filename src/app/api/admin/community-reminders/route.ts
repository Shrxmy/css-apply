import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailTemplates, sendEmailBatch } from "@/lib/email";

export const dynamic = "force-dynamic";

const COMMUNITY_REMINDER_LIMIT = 250;
const sendSchema = z.object({ confirmed: z.literal(true) }).strict();
const emailSchema = z.email();
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

type ApplicationType = "Member" | "Committee Staff" | "Executive Associate";
type AcceptedApplicant = {
  userId: string;
  name: string;
  email: string;
  paymentApproved: boolean;
  applicationTypes: Set<ApplicationType>;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStoreHeaders });
}

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
}

async function getActiveCycle() {
  return prisma.recruitmentCycle.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, schoolYear: true },
  });
}

async function getCommunityConfig() {
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          "community_group_url",
          "community_group_label",
          "community_group_enabled",
        ],
      },
    },
    select: { key: true, value: true },
  });
  const values = new Map(configs.map(({ key, value }) => [key, value]));
  const url = values.get("community_group_url")?.trim() || "";
  const label =
    values.get("community_group_label")?.trim() || "Join Community Group";
  let validHttpsUrl = false;
  try {
    validHttpsUrl = new URL(url).protocol === "https:";
  } catch {
    // An unset or malformed invitation link disables sending.
  }

  return {
    enabled: values.get("community_group_enabled") !== "false",
    configured: validHttpsUrl,
    url,
    label,
  };
}

async function getAcceptedApplicants(cycleId: string) {
  const [members, committeeStaff, executiveAssociates] = await Promise.all([
    prisma.memberApplication.findMany({
      where: { recruitmentCycleId: cycleId, hasAccepted: true },
      select: {
        paymentStatus: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.committeeApplication.findMany({
      where: {
        recruitmentCycleId: cycleId,
        hasAccepted: true,
        redirection: null,
      },
      select: {
        paymentStatus: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.executiveAssociateApplication.findMany({
      where: {
        recruitmentCycleId: cycleId,
        hasAccepted: true,
        redirection: null,
      },
      select: {
        paymentStatus: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const applicants = new Map<string, AcceptedApplicant>();
  const addApplicants = (
    records: typeof members,
    applicationType: ApplicationType,
  ) => {
    for (const { user, paymentStatus } of records) {
      const existing = applicants.get(user.id);
      if (existing) {
        existing.paymentApproved =
          existing.paymentApproved && paymentStatus === "approved";
        existing.applicationTypes.add(applicationType);
      } else {
        applicants.set(user.id, {
          userId: user.id,
          name: user.name || "CSS applicant",
          email: user.email,
          paymentApproved: paymentStatus === "approved",
          applicationTypes: new Set([applicationType]),
        });
      }
    }
  };

  addApplicants(members, "Member");
  addApplicants(committeeStaff, "Committee Staff");
  addApplicants(executiveAssociates, "Executive Associate");

  const uniqueApplicants = [...applicants.values()];
  const statuses = uniqueApplicants.length
    ? await prisma.communityJoinConfirmation.findMany({
        where: {
          recruitmentCycleId: cycleId,
          userId: { in: uniqueApplicants.map(({ userId }) => userId) },
        },
        select: {
          userId: true,
          hasJoined: true,
          respondedAt: true,
          lastReminderSentAt: true,
          reminderCount: true,
        },
      })
    : [];
  const statusByUserId = new Map(
    statuses.map((status) => [status.userId, status]),
  );

  return uniqueApplicants
    .map((applicant) => {
      const status = statusByUserId.get(applicant.userId);
      return {
        userId: applicant.userId,
        name: applicant.name,
        email: applicant.email,
        applicationTypes: [...applicant.applicationTypes].sort(),
        paymentApproved: applicant.paymentApproved,
        hasJoined: status?.hasJoined ?? null,
        respondedAt: status?.respondedAt ?? null,
        lastReminderSentAt: status?.lastReminderSentAt ?? null,
        reminderCount: status?.reminderCount ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getDashboardData() {
  const [cycle, community] = await Promise.all([
    getActiveCycle(),
    getCommunityConfig(),
  ]);
  if (!cycle) {
    return {
      cycle: null,
      community,
      applicants: [] as Awaited<ReturnType<typeof getAcceptedApplicants>>,
    };
  }

  return {
    cycle,
    community,
    applicants: await getAcceptedApplicants(cycle.id),
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return json({ error: "Unauthorized" }, 401);
    if (!isSuperAdmin(session.user.role))
      return json({ error: "Forbidden" }, 403);

    const data = await getDashboardData();
    const paymentApprovedApplicants = data.applicants.filter(
      (applicant) => applicant.paymentApproved,
    );
    const joinedCount = paymentApprovedApplicants.filter(
      (applicant) => applicant.hasJoined === true,
    ).length;
    const unconfirmedApplicants = paymentApprovedApplicants.filter(
      (applicant) => applicant.hasJoined !== true,
    );
    const sendableApplicants = unconfirmedApplicants.filter(
      (applicant) => emailSchema.safeParse(applicant.email.trim()).success,
    );

    return json({
      cycle: data.cycle,
      community: data.community,
      totalAccepted: data.applicants.length,
      paymentApprovedCount: paymentApprovedApplicants.length,
      joinedCount,
      notYetJoinedCount: unconfirmedApplicants.filter(
        (applicant) => applicant.hasJoined === false,
      ).length,
      notAnsweredCount: unconfirmedApplicants.filter(
        (applicant) => applicant.hasJoined === null,
      ).length,
      unconfirmedCount: unconfirmedApplicants.length,
      sendableCount: sendableApplicants.length,
      invalidEmailCount:
        unconfirmedApplicants.length - sendableApplicants.length,
      applicants: unconfirmedApplicants,
      recipientLimit: COMMUNITY_REMINDER_LIMIT,
    });
  } catch (error) {
    console.error("Get community reminder dashboard failed", error);
    return json({ error: "Could not load community reminder status." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return json({ error: "Unauthorized" }, 401);
    if (!isSuperAdmin(session.user.role))
      return json({ error: "Forbidden" }, 403);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }
    if (!sendSchema.safeParse(body).success) {
      return json(
        {
          error: "Explicit confirmation is required before sending reminders.",
        },
        400,
      );
    }

    const [cycle, community] = await Promise.all([
      getActiveCycle(),
      getCommunityConfig(),
    ]);
    if (!cycle) return json({ error: "No active recruitment cycle." }, 409);
    if (!community.enabled || !community.configured) {
      return json(
        {
          error:
            "Enable community invitations and save a valid HTTPS group link first.",
        },
        409,
      );
    }

    const applicants = await getAcceptedApplicants(cycle.id);
    const unconfirmed = applicants.filter(
      (applicant) =>
        applicant.paymentApproved && applicant.hasJoined !== true,
    );
    const byEmail = new Map<string, (typeof unconfirmed)[number]>();
    for (const applicant of unconfirmed) {
      const email = applicant.email.trim();
      if (!emailSchema.safeParse(email).success) continue;
      const key = email.toLowerCase();
      if (!byEmail.has(key)) byEmail.set(key, { ...applicant, email });
    }
    const recipients = [...byEmail.values()];

    if (recipients.length > COMMUNITY_REMINDER_LIMIT) {
      return json(
        {
          error: `There are ${recipients.length} payment-approved applicants needing confirmation, exceeding the ${COMMUNITY_REMINDER_LIMIT}-recipient safety limit. No reminders were sent.`,
        },
        409,
      );
    }
    if (recipients.length === 0) {
      return json({
        success: true,
        sentCount: 0,
        message: "No payment-approved applicants need a community reminder.",
      });
    }

    const template = emailTemplates.cssGroupJoin(
      "CSS member",
      community.label,
      community.url,
    );
    const result = await sendEmailBatch(
      recipients.map(({ email }) => email),
      template.subject,
      template.html,
    );
    if (!result.success) {
      return json(
        { error: "The email provider could not accept the reminder batch." },
        502,
      );
    }

    const sentAt = new Date();
    try {
      await prisma.$transaction(
        recipients.map((applicant) =>
          prisma.communityJoinConfirmation.upsert({
            where: {
              userId_recruitmentCycleId: {
                userId: applicant.userId,
                recruitmentCycleId: cycle.id,
              },
            },
            update: {
              lastReminderSentAt: sentAt,
              reminderCount: { increment: 1 },
            },
            create: {
              userId: applicant.userId,
              recruitmentCycleId: cycle.id,
              lastReminderSentAt: sentAt,
              reminderCount: 1,
            },
          }),
        ),
        { maxWait: 10_000, timeout: 20_000 },
      );
    } catch (trackingError) {
      console.error(
        "Community reminder email accepted but tracking update failed",
        {
          recipientCount: recipients.length,
          messageId: result.messageId,
          errorName:
            trackingError instanceof Error
              ? trackingError.name
              : "UnknownError",
          // Prisma code (e.g. P2022 missing column, P2028 transaction timeout).
          errorCode:
            trackingError &&
            typeof trackingError === "object" &&
            "code" in trackingError
              ? String(trackingError.code)
              : undefined,
        },
      );
      return json(
        {
          error:
            "The email provider accepted the batch, but CSSApply could not save its reminder history. Check the provider before retrying.",
          emailsAccepted: true,
        },
        500,
      );
    }

    return json({
      success: true,
      sentCount: recipients.length,
      skippedInvalidEmailCount: unconfirmed.length - recipients.length,
      message: `The email provider accepted ${recipients.length} community reminder${recipients.length === 1 ? "" : "s"} for payment-approved applicants.`,
    });
  } catch (error) {
    console.error(
      "Send community reminders failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json({ error: "Could not send community reminders." }, 500);
  }
}
