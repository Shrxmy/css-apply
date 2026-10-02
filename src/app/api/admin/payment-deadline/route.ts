import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAcceptedPaymentApplicants,
  getPaymentPolicy,
  PAYMENT_REMINDER_RECIPIENT_LIMIT,
  paymentPolicyKey,
} from "@/lib/payment-deadline";
import { emailTemplates, sendEmailBatch } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paymentPolicySchema = z
  .object({
    deadline: z.string().datetime({ offset: true }).nullable(),
    closed: z.boolean(),
  })
  .strict();

const reminderConfirmationSchema = z
  .object({ confirm: z.literal(true) })
  .strict();

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

async function authorize(request?: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isSuperAdmin(session.user.role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (request) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return {
        response: NextResponse.json(
          { error: "Invalid request origin" },
          { status: 403 },
        ),
      };
    }
  }

  return { email: session.user.email };
}

export async function GET() {
  try {
    const authorization = await authorize();
    if ("response" in authorization) return authorization.response;

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json(
        {
          cycle: null,
          deadline: null,
          closed: false,
          deadlinePassed: false,
          applicants: [],
          counts: {
            accepted: 0,
            noReceipt: 0,
            awaitingReview: 0,
            approved: 0,
            needsRevision: 0,
            late: 0,
          },
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    const policy = await getPaymentPolicy(cycle.id);
    const deadlinePassed = Boolean(
      policy.deadline && Date.now() >= new Date(policy.deadline).getTime(),
    );
    const applicants = await getAcceptedPaymentApplicants(cycle.id, policy);
    const counts = {
      accepted: applicants.length,
      noReceipt: applicants.filter(
        (applicant) => applicant.paymentStatus === "no_receipt",
      ).length,
      awaitingReview: applicants.filter(
        (applicant) => applicant.paymentStatus === "pending",
      ).length,
      approved: applicants.filter(
        (applicant) => applicant.paymentStatus === "approved",
      ).length,
      needsRevision: applicants.filter(
        (applicant) =>
          applicant.paymentStatus === "needs_revision" ||
          applicant.paymentStatus === "rejected",
      ).length,
      late: applicants.filter((applicant) => applicant.isLate).length,
    };

    return NextResponse.json(
      {
        cycle,
        ...policy,
        deadlinePassed,
        reminderRecipientLimit: PAYMENT_REMINDER_RECIPIENT_LIMIT,
        applicants,
        counts,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      "Get payment deadline tracking failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await authorize(request);
    if ("response" in authorization) return authorization.response;

    const parsed = paymentPolicySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payment policy" },
        { status: 400 },
      );
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json(
        { error: "No active recruitment cycle" },
        { status: 409 },
      );
    }

    const key = paymentPolicyKey(cycle.id);
    const policy = {
      deadline: parsed.data.deadline
        ? new Date(parsed.data.deadline).toISOString()
        : null,
      closed: parsed.data.closed,
    };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext(${key}))
      `);
      await tx.systemConfig.upsert({
        where: { key },
        update: { value: JSON.stringify(policy) },
        create: {
          key,
          value: JSON.stringify(policy),
          description: `Payment deadline and submission status for ${cycle.schoolYear}`,
        },
      });
    });

    return NextResponse.json({ success: true, ...policy });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error(
      "Save payment deadline failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorize(request);
    if ("response" in authorization) return authorization.response;

    const parsed = reminderConfirmationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Explicit confirmation is required" },
        { status: 400 },
      );
    }

    const cycle = await getActiveCycle();
    if (!cycle) {
      return NextResponse.json(
        { error: "No active recruitment cycle" },
        { status: 409 },
      );
    }

    const policy = await getPaymentPolicy(cycle.id);
    if (!policy.deadline) {
      return NextResponse.json(
        { error: "Set a payment deadline before sending reminders" },
        { status: 409 },
      );
    }
    if (policy.closed) {
      return NextResponse.json(
        { error: "Payment submissions are closed; reminders were not sent" },
        { status: 409 },
      );
    }

    const applicants = await getAcceptedPaymentApplicants(cycle.id, policy);
    const recipientMap = new Map<string, string>();
    for (const applicant of applicants) {
      if (applicant.paymentStatus !== "no_receipt") continue;
      const email = applicant.email.trim();
      const normalizedEmail = email.toLowerCase();
      if (!recipientMap.has(normalizedEmail)) {
        recipientMap.set(normalizedEmail, email);
      }
    }
    const recipients = [...recipientMap.values()];

    if (recipients.length > PAYMENT_REMINDER_RECIPIENT_LIMIT) {
      return NextResponse.json(
        {
          error: `There are ${recipients.length} eligible applicants, exceeding the ${PAYMENT_REMINDER_RECIPIENT_LIMIT}-recipient safety limit. Please contact them in separate batches.`,
        },
        { status: 409 },
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0 });
    }

    const template = emailTemplates.paymentDeadlineReminder(policy.deadline);
    const result = await sendEmailBatch(
      recipients,
      template.subject,
      template.html,
    );
    if (!result.success) {
      return NextResponse.json(
        { error: "Brevo could not accept the payment reminder batch" },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, sentCount: result.sentCount });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error(
      "Send payment deadline reminders failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
