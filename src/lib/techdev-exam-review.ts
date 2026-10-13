import "server-only";
import { prisma } from "@/lib/prisma";
import type { TechDevExamSet } from "@/lib/techdev-exam-set";

export const TECHDEV_WRITTEN_MAX_POINTS = 5;
const TECHDEV_COMMITTEE_ID = "technology";

export type TechDevScores = Record<string, number>;

// Super admins, or active TechDev EB members of the current cycle.
export async function authorizeTechDevReviewer(email: string, cycleId: string) {
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

export function writtenQuestionIds(set: TechDevExamSet) {
  return new Set(
    set.questions
      .filter((question) => question.kind === "code")
      .map((question) => question.id),
  );
}

export function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function toScoreRecord(
  set: TechDevExamSet,
  value: unknown,
): TechDevScores {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const writtenIds = writtenQuestionIds(set);
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        writtenIds.has(entry[0]) &&
        typeof entry[1] === "number" &&
        Number.isInteger(entry[1]) &&
        entry[1] >= 0 &&
        entry[1] <= TECHDEV_WRITTEN_MAX_POINTS,
    ),
  );
}

export function summarizeTechDevScore(
  set: TechDevExamSet,
  answers: Record<string, string>,
  manualScores: TechDevScores,
) {
  const choices = set.questions.filter((question) => question.kind === "choice");
  const written = set.questions.filter((question) => question.kind === "code");
  const choiceCorrect = choices.filter(
    (question) => answers[question.id] === question.answer,
  ).length;
  const graded = written.filter(
    (question) => typeof manualScores[question.id] === "number",
  );
  const writtenPoints = graded.reduce(
    (total, question) => total + manualScores[question.id],
    0,
  );

  return {
    choiceCorrect,
    choiceTotal: choices.length,
    writtenPoints,
    writtenMax: written.length * TECHDEV_WRITTEN_MAX_POINTS,
    writtenGraded: graded.length,
    writtenTotal: written.length,
    total: choiceCorrect + writtenPoints,
    max: choices.length + written.length * TECHDEV_WRITTEN_MAX_POINTS,
  };
}

/** Reviewer view of every question: the applicant's answer plus the key for choices. */
export function reviewQuestions(
  set: TechDevExamSet,
  answers: Record<string, string>,
  manualScores: TechDevScores,
) {
  return set.questions.map(({ answer: correctAnswer, ...question }) => ({
    ...question,
    answer: answers[question.id] ?? "",
    correctAnswer: question.kind === "choice" ? (correctAnswer ?? null) : null,
    isCorrect:
      question.kind === "choice" ? answers[question.id] === correctAnswer : null,
    manualScore:
      question.kind === "code" ? (manualScores[question.id] ?? null) : null,
  }));
}
