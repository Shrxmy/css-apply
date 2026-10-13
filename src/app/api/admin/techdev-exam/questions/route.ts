import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getActiveCycle,
  getApplicationRuleResponse,
} from "@/lib/application-rules";
import { authorizeTechDevReviewer } from "@/lib/techdev-exam-review";
import {
  getTechDevExamSet,
  lockTechDevExamSet,
  techDevExamSetKey,
  techDevExamSetSchema,
} from "@/lib/techdev-exam-set";

export const dynamic = "force-dynamic";

const saveSchema = z
  .object({
    set: z.unknown(),
    // null when the A.Y. is still on the default set.
    expectedUpdatedAt: z.string().datetime().nullable(),
  })
  .strict();

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const cycle = await getActiveCycle();
  if (!(await authorizeTechDevReviewer(session.user.email, cycle.id))) {
    return {
      error: NextResponse.json(
        { error: "Only TechDev EB members or Super Admins can edit the exam" },
        { status: 403 },
      ),
    };
  }
  return { cycle };
}

async function examSetResponse(cycle: { id: string; schoolYear: string }) {
  const attemptCount = await prisma.techDevExamAttempt.count({
    where: { recruitmentCycleId: cycle.id },
  });
  const { set, updatedAt } = await getTechDevExamSet(cycle.id);
  return {
    schoolYear: cycle.schoolYear,
    set,
    isCustom: updatedAt !== null,
    updatedAt,
    locked: attemptCount > 0,
  };
}

function errorResponse(error: unknown, action: "Load" | "Save") {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const ruleError = getApplicationRuleResponse(error);
  if (ruleError) {
    return NextResponse.json(ruleError.body, { status: ruleError.status });
  }
  console.error(
    `${action} TechDev exam set failed`,
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    { error: `TechDev exam questions could not be ${action === "Load" ? "loaded" : "saved"}` },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const auth = await authorize();
    if (auth.error) return auth.error;
    return NextResponse.json(await examSetResponse(auth.cycle));
  } catch (error) {
    return errorResponse(error, "Load");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authorize();
    if (auth.error) return auth.error;
    const { cycle } = auth;

    const body = saveSchema.safeParse(await request.json());
    const parsed = body.success
      ? techDevExamSetSchema.safeParse(body.data.set)
      : null;
    if (!body.success || !parsed?.success) {
      return NextResponse.json(
        { error: parsed?.error?.issues[0]?.message ?? "Invalid exam questions" },
        { status: 400 },
      );
    }

    const key = techDevExamSetKey(cycle.id);
    const outcome = await prisma.$transaction(async (tx) => {
      await lockTechDevExamSet(tx, cycle.id);
      // Grading reads the live set, so a started set must stay unchanged.
      if (
        await tx.techDevExamAttempt.count({
          where: { recruitmentCycleId: cycle.id },
        })
      ) {
        return "locked";
      }
      const current = await tx.systemConfig.findUnique({
        where: { key },
        select: { updatedAt: true },
      });
      if (
        (current?.updatedAt.toISOString() ?? null) !==
        body.data.expectedUpdatedAt
      ) {
        return "conflict";
      }
      const value = JSON.stringify(parsed.data);
      const updatedAt = new Date(Math.max(
        Date.now(),
        (current?.updatedAt.getTime() ?? 0) + 1,
      ));
      await tx.systemConfig.upsert({
        where: { key },
        update: { value, updatedAt },
        create: {
          key,
          value,
          updatedAt,
          description: `TechDev exam questions for ${cycle.schoolYear}`,
        },
      });
      return { set: parsed.data, updatedAt };
    });

    if (outcome === "locked") {
      return NextResponse.json(
        {
          error:
            "Applicants have already started this exam, so its questions can no longer change",
        },
        { status: 409 },
      );
    }
    if (outcome === "conflict") {
      return NextResponse.json(
        {
          error:
            "Someone else saved these questions while you were editing. Reload and try again.",
        },
        { status: 409 },
      );
    }
    // Return this save's snapshot/token, not a subsequent editor's newer save.
    return NextResponse.json({
      schoolYear: cycle.schoolYear,
      set: outcome.set,
      isCustom: true,
      updatedAt: outcome.updatedAt,
      locked: false,
    });
  } catch (error) {
    return errorResponse(error, "Save");
  }
}
