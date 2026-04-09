import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const submission = body?.submission ?? body;

    if (!submission || typeof submission !== "object") {
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

    const { data, error } = await supabase
      .from("quiz_submissions")
      .insert([submission])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
