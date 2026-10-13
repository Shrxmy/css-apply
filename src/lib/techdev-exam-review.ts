import "server-only";
import {
  TECHDEV_EXAM_QUESTIONS,
  type TechDevExamQuestion,
} from "@/data/techdev-exam";
import { TECHDEV_CHOICE_ANSWERS } from "@/lib/techdev-exam-key";

export const TECHDEV_WRITTEN_MAX_POINTS = 5;
export const TECHDEV_WRITTEN_QUESTION_IDS = new Set(
  TECHDEV_EXAM_QUESTIONS.filter((question) => question.kind === "code").map(
    (question) => question.id,
  ),
);

const CHOICE_QUESTIONS = TECHDEV_EXAM_QUESTIONS.filter(
  (question) => question.kind === "choice",
);
const WRITTEN_QUESTIONS = TECHDEV_EXAM_QUESTIONS.filter(
  (question) => question.kind === "code",
);

export type TechDevScores = Record<string, number>;

export function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function toScoreRecord(value: unknown): TechDevScores {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        TECHDEV_WRITTEN_QUESTION_IDS.has(entry[0]) &&
        typeof entry[1] === "number" &&
        Number.isInteger(entry[1]) &&
        entry[1] >= 0 &&
        entry[1] <= TECHDEV_WRITTEN_MAX_POINTS,
    ),
  );
}

export function summarizeTechDevScore(
  answers: Record<string, string>,
  manualScores: TechDevScores,
) {
  const choiceCorrect = CHOICE_QUESTIONS.filter(
    (question) => answers[question.id] === TECHDEV_CHOICE_ANSWERS[question.id],
  ).length;
  const graded = WRITTEN_QUESTIONS.filter(
    (question) => typeof manualScores[question.id] === "number",
  );
  const writtenPoints = graded.reduce(
    (total, question) => total + manualScores[question.id],
    0,
  );

  return {
    choiceCorrect,
    choiceTotal: CHOICE_QUESTIONS.length,
    writtenPoints,
    writtenMax: WRITTEN_QUESTIONS.length * TECHDEV_WRITTEN_MAX_POINTS,
    writtenGraded: graded.length,
    writtenTotal: WRITTEN_QUESTIONS.length,
    total: choiceCorrect + writtenPoints,
    max:
      CHOICE_QUESTIONS.length +
      WRITTEN_QUESTIONS.length * TECHDEV_WRITTEN_MAX_POINTS,
  };
}

/** Reviewer view of every question: the applicant's answer plus the key for choices. */
export function reviewQuestions(
  answers: Record<string, string>,
  manualScores: TechDevScores,
) {
  return TECHDEV_EXAM_QUESTIONS.map((question: TechDevExamQuestion) => ({
    ...question,
    answer: answers[question.id] ?? "",
    correctAnswer:
      question.kind === "choice" ? TECHDEV_CHOICE_ANSWERS[question.id] : null,
    isCorrect:
      question.kind === "choice"
        ? answers[question.id] === TECHDEV_CHOICE_ANSWERS[question.id]
        : null,
    manualScore:
      question.kind === "code" ? (manualScores[question.id] ?? null) : null,
  }));
}
