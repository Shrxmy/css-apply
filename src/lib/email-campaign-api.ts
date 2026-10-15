import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailCampaignError } from "@/lib/email-campaigns";
import { createLogger } from "@/lib/logger";

const logger = createLogger("email-campaign");
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const BODY_LIMIT = 128 * 1024;
type Actor = { id: string; name: string | null };

export async function readCampaignRequest(
  request: NextRequest,
): Promise<unknown> {
  const declaredSize = Number(request.headers.get("content-length"));
  if (declaredSize > BODY_LIMIT)
    throw new EmailCampaignError(413, "Request body is too large.");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > BODY_LIMIT) {
    throw new EmailCampaignError(413, "Request body is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new EmailCampaignError(400, "Invalid JSON body.");
  }
}

/** Every composer endpoint rechecks the account role, not a stale browser role. */
export async function withEmailCampaignAdmin(
  action: (actor: Actor) => Promise<unknown>,
  successStatus = 200,
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers },
      );
    }
    const account = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, role: true },
    });
    if (!account || !["super_admin", "super-admin"].includes(account.role)) {
      return NextResponse.json(
        { error: "Super Admin access is required." },
        { status: 403, headers },
      );
    }
    const result = await action({ id: account.id, name: account.name });
    return NextResponse.json(result, { status: successStatus, headers });
  } catch (error) {
    if (error instanceof EmailCampaignError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid request." },
        { status: 400, headers },
      );
    }
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "unknown";
    // Avoid logging content, recipient lists, provider credentials or ORM arguments.
    logger.error("request failed", undefined, {
      errorName: error instanceof Error ? error.name : "UnknownError",
      code,
    });
    return NextResponse.json(
      {
        error:
          code === "P2021"
            ? "Email campaign tracking is not installed. Apply the approved additive setup first."
            : "The email campaign request could not be completed. Refresh its status before trying again.",
      },
      { status: code === "P2021" ? 503 : 500, headers },
    );
  }
}
