import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import {
  TECHDEV_EXAM_DURATION_MINUTES,
  TECHDEV_EXAM_QUESTIONS,
  TECHDEV_EXAM_VERSION,
  type TechDevExamQuestion,
} from "@/data/techdev-exam";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TECHDEV_COMMITTEE_ID = "technology";
const QUESTION_IDS = new Set(
  TECHDEV_EXAM_QUESTIONS.map((question) => question.id),
);
const actionSchema = z.object({
  action: z.enum(["start", "save", "heartbeat", "submit"]),
  answers: z
    .record(z.string(), z.string().max(20_000))
    .refine((answers) =>
      Object.keys(answers).every((id) => QUESTION_IDS.has(id)),
    )
    .optional(),
  focusLossCount: z.number().int().min(0).max(10_000).optional(),
  totalAwayMilliseconds: z.number().int().min(0).max(86_400_000).optional(),
});

type AttemptAnswers = Record<string, string>;

type EligibleContext = {
  userId: string;
  applicationId: string;
  recruitmentCycleId: string;
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function publicQuestions(questionOrder: string[]): TechDevExamQuestion[] {
  const questionMap = new Map(
    TECHDEV_EXAM_QUESTIONS.map((question) => [question.id, question]),
  );
  return questionOrder
    .map((id) => questionMap.get(id))
    .filter((question): question is TechDevExamQuestion => Boolean(question));
}

function attemptResponse(attempt: {
  id: string;
  version: string;
  questionOrder: unknown;
  answers: unknown;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  focusLossCount: number;
  totalAwayMilliseconds: number;
}) {
  const questionOrder = Array.isArray(attempt.questionOrder)
    ? attempt.questionOrder.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const answers =
    attempt.answers && typeof attempt.answers === "object"
      ? (attempt.answers as AttemptAnswers)
      : {};

  return {
    attempt: {
      id: attempt.id,
      version: attempt.version,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      focusLossCount: attempt.focusLossCount,
      totalAwayMilliseconds: attempt.totalAwayMilliseconds,
      answers,
    },
    questions: publicQuestions(questionOrder),
  };
}

// POST and GET share the envelope expected by the applicant page.
function examResponse(attempt: Parameters<typeof attemptResponse>[0]) {
  return {
    eligible: true,
    durationMinutes: TECHDEV_EXAM_DURATION_MINUTES,
    attempt: attemptResponse(attempt),
  };
}

async function getEligibleContext(): Promise<EligibleContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, studentNumber: true },
  });
  if (!user?.studentNumber) return null;

  const cycle = await prisma.recruitmentCycle.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!cycle) return null;

  const application = await prisma.committeeApplication.findFirst({
    where: {
      studentNumber: user.studentNumber,
      recruitmentCycleId: cycle.id,
      firstOptionCommittee: TECHDEV_COMMITTEE_ID,
      hasFinishedInterview: true,
    },
    select: { id: true },
  });
  if (!application) return null;

  return {
    userId: user.id,
    applicationId: application.id,
    recruitmentCycleId: cycle.id,
  };
}

export async function GET() {
  try {
    const context = await getEligibleContext();
    if (!context) {
      return NextResponse.json(
        {
          eligible: false,
          error: "The TechDev examination is not available yet.",
        },
        { status: 403 },
      );
    }

    const attempt = await prisma.techDevExamAttempt.findUnique({
      where: { applicationId: context.applicationId },
    });
    return NextResponse.json({
      eligible: true,
      durationMinutes: TECHDEV_EXAM_DURATION_MINUTES,
      attempt: attempt ? attemptResponse(attempt) : null,
    });
  } catch (error) {
    console.error(
      "Load TechDev exam failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "TechDev examination could not be loaded" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getEligibleContext();
    if (!context) {
      return NextResponse.json(
        { error: "The TechDev examination is not available yet." },
        { status: 403 },
      );
    }

    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid examination request" },
        { status: 400 },
      );
    }

    const { action } = parsed.data;
    let attempt = await prisma.techDevExamAttempt.findUnique({
      where: { applicationId: context.applicationId },
    });

    if (action === "start") {
      if (!attempt) {
        attempt = await prisma.techDevExamAttempt.create({
          data: {
            applicationId: context.applicationId,
            userId: context.userId,
            recruitmentCycleId: context.recruitmentCycleId,
            version: TECHDEV_EXAM_VERSION,
            questionOrder: shuffle(
              TECHDEV_EXAM_QUESTIONS.map((question) => question.id),
            ),
            answers: {},
            expiresAt: new Date(
              Date.now() + TECHDEV_EXAM_DURATION_MINUTES * 60_000,
            ),
          },
        });
      }
      return NextResponse.json(examResponse(attempt));
    }

    if (!attempt) {
      return NextResponse.json(
        { error: "Start the examination first" },
        { status: 409 },
      );
    }
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(examResponse(attempt));
    }

    const now = new Date();
    if (now >= attempt.expiresAt) {
      await prisma.techDevExamAttempt.updateMany({
        where: {
          id: attempt.id,
          status: "IN_PROGRESS",
          expiresAt: { lte: now },
        },
        data: { status: "EXPIRED" },
      });
      attempt = await prisma.techDevExamAttempt.findUnique({
        where: { id: attempt.id },
      });
      if (!attempt) {
        return NextResponse.json(
          { error: "Examination attempt not found" },
          { status: 404 },
        );
      }
      if (attempt.status === "EXPIRED") {
        return NextResponse.json(
          {
            error: "The examination time has expired",
            ...examResponse(attempt),
          },
          { status: 409 },
        );
      }
      // A concurrent submission may have won the status transition. Never
      // replace that final state with EXPIRED.
      return NextResponse.json(examResponse(attempt));
    }

    const attemptId = attempt.id;
    if (action === "save" || action === "submit") {
      const updatedAt = new Date();
      const updateResult = await prisma.techDevExamAttempt.updateMany({
        where: {
          id: attemptId,
          status: "IN_PROGRESS",
          expiresAt: { gt: updatedAt },
        },
        data: {
          answers: parsed.data.answers || {},
          ...(action === "submit"
            ? { status: "SUBMITTED", submittedAt: updatedAt }
            : {}),
        },
      });
      attempt = await prisma.techDevExamAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt) {
        return NextResponse.json(
          { error: "Examination attempt not found" },
          { status: 404 },
        );
      }
      if (updateResult.count !== 1) {
        if (
          attempt.status === "IN_PROGRESS" &&
          attempt.expiresAt <= updatedAt
        ) {
          await prisma.techDevExamAttempt.updateMany({
            where: {
              id: attemptId,
              status: "IN_PROGRESS",
              expiresAt: { lte: updatedAt },
            },
            data: { status: "EXPIRED" },
          });
          attempt = await prisma.techDevExamAttempt.findUnique({
            where: { id: attemptId },
          });
        }
        if (!attempt) {
          return NextResponse.json(
            { error: "Examination attempt not found" },
            { status: 404 },
          );
        }
        return NextResponse.json(
          {
            error:
              attempt.status === "EXPIRED"
                ? "The examination time has expired"
                : "The examination is no longer accepting answers",
            ...examResponse(attempt),
          },
          { status: 409 },
        );
      }
    } else {
      // Heartbeats cannot update telemetry after an attempt is submitted or expired.
      const { focusLossCount = 0, totalAwayMilliseconds = 0 } = parsed.data;
      await prisma.$transaction(async (tx) => {
        await tx.techDevExamAttempt.updateMany({
          where: {
            id: attemptId,
            status: "IN_PROGRESS",
            expiresAt: { gt: now },
            focusLossCount: { lt: focusLossCount },
          },
          data: { focusLossCount },
        });
        await tx.techDevExamAttempt.updateMany({
          where: {
            id: attemptId,
            status: "IN_PROGRESS",
            expiresAt: { gt: now },
            totalAwayMilliseconds: { lt: totalAwayMilliseconds },
          },
          data: { totalAwayMilliseconds },
        });
        await tx.techDevExamAttempt.updateMany({
          where: {
            id: attemptId,
            status: "IN_PROGRESS",
            expiresAt: { gt: now },
          },
          data: { lastHeartbeatAt: now },
        });
      });
      attempt = await prisma.techDevExamAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt) {
        return NextResponse.json(
          { error: "Examination attempt not found" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(examResponse(attempt));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error(
      "Update TechDev exam failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "TechDev examination could not be updated" },
      { status: 500 },
    );
  }
}
