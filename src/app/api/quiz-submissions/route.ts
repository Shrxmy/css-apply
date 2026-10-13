import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const RECENT_SUBMISSION_TTL_MS = 5 * 60 * 1000;
const recentSubmissionKeys = new Map<string, number>();

const pruneRecentSubmissionKeys = (now: number) => {
  for (const [key, expiresAt] of recentSubmissionKeys) {
    if (expiresAt <= now) recentSubmissionKeys.delete(key);
  }
};

// Public endpoint: only the columns the personality test writes are accepted.
const committeeName = z.string().trim().min(1).max(100);
const submissionSchema = z
  .object({
    top_committee: committeeName,
    second_committee: committeeName,
    third_committee: committeeName,
    idempotencyKey: z.string().max(100).optional(),
  })
  .catchall(z.number().finite().min(-1000).max(1000))
  .refine(
    (value) =>
      Object.keys(value).every(
        (key) =>
          /^score_[a-z_]{1,60}$/.test(key) ||
          [
            "top_committee",
            "second_committee",
            "third_committee",
            "idempotencyKey",
          ].includes(key),
      ) && Object.keys(value).length <= 30,
  );

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const submission = body?.submission ?? body;

    const parsed = submissionSchema.safeParse(submission);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { idempotencyKey, ...submissionRecord } = parsed.data;

    if (typeof idempotencyKey === "string" && idempotencyKey.length > 0) {
      const now = Date.now();
      pruneRecentSubmissionKeys(now);

      if (recentSubmissionKeys.has(idempotencyKey)) {
        return NextResponse.json(
          { data: [], duplicate: true },
          { status: 200 },
        );
      }

      recentSubmissionKeys.set(idempotencyKey, now + RECENT_SUBMISSION_TTL_MS);
    }

    const { data, error } = await supabase
      .from("quiz_submissions")
      .insert([submissionRecord])
      .select();

    if (error) {
      if (typeof idempotencyKey === "string") {
        recentSubmissionKeys.delete(idempotencyKey);
      }
      console.error("Quiz submission insert failed", error.code);
      return NextResponse.json(
        { error: "Failed to save submission" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    console.error("Quiz submission failed", err);
    return NextResponse.json(
      { error: "Failed to save submission" },
      { status: 500 },
    );
  }
}
