import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STORAGE_BUCKET = "payment";

// para lang toh mabuhay supabase hahaha

function hasValidCronSecret(request: NextRequest, secret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return false;

  const provided = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("Supabase keepalive is disabled: CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Keepalive is not configured" },
      { status: 503 },
    );
  }

  if (!hasValidCronSecret(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // A metadata-only Storage request is enough to register Supabase activity.
    // It does not query Neon or download/list applicant files.
    const { error } = await supabase.storage.getBucket(STORAGE_BUCKET);

    if (error) {
      console.error("Supabase keepalive storage check failed");
      return NextResponse.json(
        { error: "Storage check failed" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Supabase keepalive failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Storage check failed" },
      { status: 503 },
    );
  }
}
