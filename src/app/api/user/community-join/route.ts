import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge-payment") }).strict(),
  z
    .object({
      action: z.literal("answer-join-question"),
      hasJoined: z.boolean(),
    })
    .strict(),
]);

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStoreHeaders });
}

async function getAcceptedContext(userId: string) {
  const [cycle, user] = await Promise.all([
    prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, studentNumber: true },
    }),
  ]);

  if (!cycle || !user?.studentNumber) return null;

  const applicationWhere = {
    studentNumber: user.studentNumber,
    recruitmentCycleId: cycle.id,
    hasAccepted: true,
  };
  const [member, committee, ea] = await Promise.all([
    prisma.memberApplication.findFirst({
      where: applicationWhere,
      select: { id: true },
    }),
    prisma.committeeApplication.findFirst({
      where: { ...applicationWhere, redirection: null },
      select: { id: true },
    }),
    prisma.executiveAssociateApplication.findFirst({
      where: { ...applicationWhere, redirection: null },
      select: { id: true },
    }),
  ]);

  if (!member && !committee && !ea) return null;
  return { cycleId: cycle.id, userId: user.id };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return json({ error: "Unauthorized" }, 401);

    const context = await getAcceptedContext(session.user.id);
    if (!context) {
      return json(
        {
          error:
            "Only accepted applicants in the active cycle can confirm community membership.",
        },
        403,
      );
    }

    const status = await prisma.communityJoinConfirmation.findUnique({
      where: {
        userId_recruitmentCycleId: {
          userId: context.userId,
          recruitmentCycleId: context.cycleId,
        },
      },
      select: {
        paymentRequirementAcknowledgedAt: true,
        hasJoined: true,
        respondedAt: true,
      },
    });

    return json({
      paymentRequirementAcknowledgedAt:
        status?.paymentRequirementAcknowledgedAt ?? null,
      hasJoined: status?.hasJoined ?? null,
      respondedAt: status?.respondedAt ?? null,
    });
  } catch (error) {
    console.error("Get applicant community confirmation failed", error);
    return json({ error: "Could not load community confirmation." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return json({ error: "Unauthorized" }, 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid community confirmation." }, 400);
    }

    const context = await getAcceptedContext(session.user.id);
    if (!context) {
      return json(
        {
          error:
            "Only accepted applicants in the active cycle can confirm community membership.",
        },
        403,
      );
    }

    const key = {
      userId_recruitmentCycleId: {
        userId: context.userId,
        recruitmentCycleId: context.cycleId,
      },
    };
    const current = await prisma.communityJoinConfirmation.findUnique({
      where: key,
      select: { id: true, paymentRequirementAcknowledgedAt: true },
    });

    if (parsed.data.action === "acknowledge-payment") {
      const acknowledgedAt =
        current?.paymentRequirementAcknowledgedAt ?? new Date();
      const status = await prisma.communityJoinConfirmation.upsert({
        where: key,
        update: { paymentRequirementAcknowledgedAt: acknowledgedAt },
        create: {
          userId: context.userId,
          recruitmentCycleId: context.cycleId,
          paymentRequirementAcknowledgedAt: acknowledgedAt,
        },
        select: {
          paymentRequirementAcknowledgedAt: true,
          hasJoined: true,
          respondedAt: true,
        },
      });

      return json(status);
    }

    if (!current?.paymentRequirementAcknowledgedAt) {
      return json(
        {
          error:
            "Acknowledge the Member ID payment requirement before answering the join question.",
        },
        409,
      );
    }

    const status = await prisma.communityJoinConfirmation.update({
      where: key,
      data: {
        hasJoined: parsed.data.hasJoined,
        respondedAt: new Date(),
      },
      select: {
        paymentRequirementAcknowledgedAt: true,
        hasJoined: true,
        respondedAt: true,
      },
    });

    return json(status);
  } catch (error) {
    console.error("Save applicant community confirmation failed", error);
    return json({ error: "Could not save community confirmation." }, 500);
  }
}
