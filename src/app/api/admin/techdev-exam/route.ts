import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getActiveCycle,
  getApplicationRuleResponse,
} from "@/lib/application-rules";
import {
  TECHDEV_WRITTEN_MAX_POINTS,
  TECHDEV_WRITTEN_QUESTION_IDS,
  reviewQuestions,
  summarizeTechDevScore,
  toScoreRecord,
  toStringRecord,
} from "@/lib/techdev-exam-review";

export const dynamic = "force-dynamic";

const TECHDEV_COMMITTEE_ID = "technology";

const gradeSchema = z
  .object({
    attemptId: z.string().min(1),
    expectedUpdatedAt: z.string().datetime(),
    scores: z
      // null clears a previously saved score.
      .record(
        z.string(),
        z.number().int().min(0).max(TECHDEV_WRITTEN_MAX_POINTS).nullable(),
      )
      .refine((scores) =>
        Object.keys(scores).every((id) => TECHDEV_WRITTEN_QUESTION_IDS.has(id)),
      ),
  })
  .strict();

// Super admins, or active TechDev EB members of the current cycle.
async function authorizeTechDevReviewer(email: string, cycleId: string) {
  const reviewer = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      ebProfile: {
        select: { committees: true, isActive: true, recruitmentCycleId: true },
      },
    },
  });
  const isSuperAdmin =
    reviewer?.role === "super_admin" || reviewer?.role === "super-admin";
  const isTechDevEb =
    reviewer?.role === "admin" &&
    reviewer.ebProfile?.isActive === true &&
    reviewer.ebProfile.recruitmentCycleId === cycleId &&
    reviewer.ebProfile.committees.includes(TECHDEV_COMMITTEE_ID);
  return reviewer && (isSuperAdmin || isTechDevEb) ? reviewer : null;
}

type AttemptRow = Awaited<ReturnType<typeof findAttempts>>[number];

function findAttempts(where: { recruitmentCycleId: string; id?: string }) {
  return prisma.techDevExamAttempt.findMany({
    where,
    orderBy: { startedAt: "desc" },
    include: {
      user: {
        select: { name: true, email: true, studentNumber: true, section: true },
      },
    },
  });
}

function toReview(attempt: AttemptRow, now: Date) {
  const answers = toStringRecord(attempt.answers);
  const manualScores = toScoreRecord(attempt.manualScores);
  // An IN_PROGRESS attempt past its deadline is final even before the server marks it EXPIRED.
  const status =
    attempt.status === "IN_PROGRESS" && attempt.expiresAt <= now
      ? "EXPIRED"
      : attempt.status;
  return {
    id: attempt.id,
    status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    focusLossCount: attempt.focusLossCount,
    totalAwayMilliseconds: attempt.totalAwayMilliseconds,
    reviewedAt: attempt.reviewedAt,
    updatedAt: attempt.updatedAt,
    user: attempt.user,
    score: summarizeTechDevScore(answers, manualScores),
    questions: reviewQuestions(answers, manualScores),
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const cycle = await getActiveCycle();
    if (!(await authorizeTechDevReviewer(session.user.email, cycle.id))) {
      return NextResponse.json(
        { error: "Only TechDev EB members or Super Admins can review exams" },
        { status: 403 },
      );
    }

    const now = new Date();
    const attempts = await findAttempts({ recruitmentCycleId: cycle.id });
    return NextResponse.json({
      schoolYear: cycle.schoolYear,
      writtenMaxPoints: TECHDEV_WRITTEN_MAX_POINTS,
      attempts: attempts.map((attempt) => toReview(attempt, now)),
    });
  } catch (error) {
    const ruleError = getApplicationRuleResponse(error);
    if (ruleError) {
      return NextResponse.json(ruleError.body, { status: ruleError.status });
    }
    console.error(
      "Load TechDev exam reviews failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "TechDev exam results could not be loaded" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const cycle = await getActiveCycle();
    const reviewer = await authorizeTechDevReviewer(
      session.user.email,
      cycle.id,
    );
    if (!reviewer) {
      return NextResponse.json(
        { error: "Only TechDev EB members or Super Admins can review exams" },
        { status: 403 },
      );
    }

    const parsed = gradeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid scores" }, { status: 400 });
    }

    const now = new Date();
    const [attempt] = await findAttempts({
      recruitmentCycleId: cycle.id,
      id: parsed.data.attemptId,
    });
    if (!attempt) {
      return NextResponse.json(
        { error: "Exam attempt not found" },
        { status: 404 },
      );
    }
    if (attempt.status === "IN_PROGRESS" && attempt.expiresAt > now) {
      return NextResponse.json(
        { error: "This examination is still in progress" },
        { status: 409 },
      );
    }

    const manualScores = toScoreRecord(attempt.manualScores);
    for (const [questionId, points] of Object.entries(parsed.data.scores)) {
      if (points === null) delete manualScores[questionId];
      else manualScores[questionId] = points;
    }

    // Advance the version even when two reviews land in the same millisecond.
    const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
    const reviewUpdatedAt = new Date(
      Math.max(now.getTime(), expectedUpdatedAt.getTime() + 1),
    );
    // Compare the browser's version, not just this request's database read:
    // a reviewer may have kept an old draft open while another reviewer saved.
    const { count } = await prisma.techDevExamAttempt.updateMany({
      where: {
        id: attempt.id,
        recruitmentCycleId: cycle.id,
        updatedAt: expectedUpdatedAt,
      },
      data: {
        manualScores,
        reviewedAt: now,
        reviewedById: reviewer.id,
        updatedAt: reviewUpdatedAt,
      },
    });
    if (count !== 1) {
      return NextResponse.json(
        {
          error:
            "These scores changed while you were editing. Reload and try again.",
        },
        { status: 409 },
      );
    }
    const [updated] = await findAttempts({
      recruitmentCycleId: cycle.id,
      id: attempt.id,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Exam attempt not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ attempt: toReview(updated, now) });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const ruleError = getApplicationRuleResponse(error);
    if (ruleError) {
      return NextResponse.json(ruleError.body, { status: ruleError.status });
    }
    console.error(
      "Save TechDev exam scores failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "TechDev exam scores could not be saved" },
      { status: 500 },
    );
  }
}
