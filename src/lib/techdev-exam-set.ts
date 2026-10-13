import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  TECHDEV_EXAM_DURATION_MINUTES,
  TECHDEV_EXAM_QUESTIONS,
  type TechDevExamQuestion,
} from "@/data/techdev-exam";
import { TECHDEV_CHOICE_ANSWERS } from "@/lib/techdev-exam-key";
import { prisma } from "@/lib/prisma";

const questionSchema = z
  .object({
    id: z.string().regex(/^[\w-]{1,64}$/).refine(
      (id) => !Object.prototype.hasOwnProperty.call(Object.prototype, id),
      "Question ids cannot use reserved object keys",
    ),
    section: z.string().trim().min(1).max(60),
    prompt: z.string().trim().min(1).max(2000),
    kind: z.enum(["choice", "code"]),
    code: z
      .string()
      .max(5000)
      .optional()
      .transform((code) => (code?.trim() ? code : undefined)),
    options: z.array(z.string().trim().min(1).max(500)).max(8).optional(),
    answer: z.string().trim().max(500).optional(),
  })
  .strict();

export const techDevExamSetSchema = z
  .object({
    durationMinutes: z.number().int().min(5).max(240),
    questions: z.array(questionSchema).min(1).max(100),
  })
  .strict()
  .superRefine((set, ctx) => {
    const ids = new Set<string>();
    set.questions.forEach((question, index) => {
      const label = `Question ${index + 1}`;
      if (ids.has(question.id)) {
        ctx.addIssue({ code: "custom", message: `${label} has a duplicate id` });
      }
      ids.add(question.id);
      if (question.kind === "code") {
        if (question.options?.length || question.answer) {
          ctx.addIssue({
            code: "custom",
            message: `${label} is written and cannot have choices`,
          });
        }
        return;
      }
      const options = question.options ?? [];
      if (options.length < 2 || new Set(options).size !== options.length) {
        ctx.addIssue({
          code: "custom",
          message: `${label} needs at least two different choices`,
        });
      } else if (!question.answer || !options.includes(question.answer)) {
        ctx.addIssue({
          code: "custom",
          message: `${label} needs a correct answer`,
        });
      }
    });
  });

export type TechDevExamSetQuestion = TechDevExamQuestion & { answer?: string };
export type TechDevExamSet = {
  durationMinutes: number;
  questions: TechDevExamSetQuestion[];
};

type Db = Prisma.TransactionClient | typeof prisma;

export const techDevExamSetKey = (cycleId: string) =>
  `techdev_exam_set:${cycleId}`;

export const DEFAULT_TECHDEV_EXAM_SET: TechDevExamSet = {
  durationMinutes: TECHDEV_EXAM_DURATION_MINUTES,
  questions: TECHDEV_EXAM_QUESTIONS.map((question) =>
    question.kind === "choice"
      ? { ...question, answer: TECHDEV_CHOICE_ANSWERS[question.id] }
      : question,
  ),
};

/** The A.Y.'s saved set, or the default bank until TechDev saves one. */
export async function getTechDevExamSet(cycleId: string, db: Db = prisma) {
  const config = await db.systemConfig.findUnique({
    where: { key: techDevExamSetKey(cycleId) },
  });
  if (config) {
    try {
      const parsed = techDevExamSetSchema.safeParse(JSON.parse(config.value));
      if (parsed.success) {
        return { set: parsed.data, updatedAt: config.updatedAt };
      }
    } catch {}
    // Never silently serve or grade a different bank for an existing saved set.
    throw new Error("Stored TechDev exam set is invalid");
  }
  return { set: DEFAULT_TECHDEV_EXAM_SET, updatedAt: null };
}

/** Called under the cycle lock. Persist defaults too, so future deployments
 * cannot change the content/key of an exam that has already started. */
export async function freezeTechDevExamSet(
  cycleId: string,
  tx: Prisma.TransactionClient,
) {
  const current = await getTechDevExamSet(cycleId, tx);
  if (current.updatedAt) return current;
  const saved = await tx.systemConfig.create({
    data: {
      key: techDevExamSetKey(cycleId),
      value: JSON.stringify(current.set),
      description: "Frozen default TechDev exam set",
    },
  });
  return { set: current.set, updatedAt: saved.updatedAt };
}

/** Serializes set edits against exam starts so a started set never changes. */
export async function lockTechDevExamSet(
  tx: Prisma.TransactionClient,
  cycleId: string,
) {
  const key = techDevExamSetKey(cycleId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

/** Applicant-safe question: never includes the answer key. */
export function toPublicQuestion({
  answer: _answer,
  ...question
}: TechDevExamSetQuestion): TechDevExamQuestion {
  return question;
}
