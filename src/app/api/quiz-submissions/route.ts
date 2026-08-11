import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const RECENT_SUBMISSION_TTL_MS = 5 * 60 * 1000;
const recentSubmissionKeys = new Map<string, number>();

const pruneRecentSubmissionKeys = (now: number) => {
  for (const [key, expiresAt] of recentSubmissionKeys) {
    if (expiresAt <= now) recentSubmissionKeys.delete(key);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const submission = body?.submission ?? body;

    if (!isRecord(submission)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Minimal shape validation
    const hasTop = typeof submission.top_committee === "string";
    if (!hasTop) {
      return NextResponse.json(
        { error: "Missing top_committee" },
        { status: 400 },
      );
    }

    const { idempotencyKey, ...submissionRecord } = submission;

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
