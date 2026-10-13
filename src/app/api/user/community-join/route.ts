import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAcceptedCommunityApplicantContext } from "@/lib/community-join-access";

export const dynamic = "force-dynamic";

const answerSchema = z
  .object({
    action: z.literal("answer-join-question"),
    hasJoined: z.boolean(),
  })
  .strict();

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStoreHeaders });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return json({ error: "Unauthorized" }, 401);

    const context = await getAcceptedCommunityApplicantContext(session.user.id);
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
      select: { hasJoined: true, respondedAt: true },
    });

    return json({
      paymentApproved: context.paymentApproved,
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

    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid community confirmation." }, 400);
    }

    const context = await getAcceptedCommunityApplicantContext(session.user.id);
    if (!context) {
      return json(
        {
          error:
            "Only accepted applicants in the active cycle can confirm community membership.",
        },
        403,
      );
    }
    if (!context.paymentApproved) {
      return json(
        {
          error:
            "Community confirmation is available after an authorized reviewer approves your payment receipt.",
        },
        409,
      );
    }

    const status = await prisma.communityJoinConfirmation.upsert({
      where: {
        userId_recruitmentCycleId: {
          userId: context.userId,
          recruitmentCycleId: context.cycleId,
        },
      },
      update: {
        hasJoined: parsed.data.hasJoined,
        respondedAt: new Date(),
      },
      create: {
        userId: context.userId,
        recruitmentCycleId: context.cycleId,
        hasJoined: parsed.data.hasJoined,
        respondedAt: new Date(),
      },
      select: { hasJoined: true, respondedAt: true },
    });

    return json({ paymentApproved: true, ...status });
  } catch (error) {
    console.error("Save applicant community confirmation failed", error);
    return json({ error: "Could not save community confirmation." }, 500);
  }
}
