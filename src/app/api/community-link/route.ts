import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAcceptedCommunityApplicantContext } from "@/lib/community-join-access";

export const dynamic = "force-dynamic";

const URL_KEY = "community_group_url";
const LABEL_KEY = "community_group_label";
const ENABLED_KEY = "community_group_enabled";
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStoreHeaders });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return json({ error: "Unauthorized" }, 401);

    const [context, configs] = await Promise.all([
      getAcceptedCommunityApplicantContext(session.user.id),
      prisma.systemConfig.findMany({
        where: { key: { in: [URL_KEY, LABEL_KEY, ENABLED_KEY] } },
        select: { key: true, value: true },
      }),
    ]);

    const configMap = new Map(configs.map(({ key, value }) => [key, value]));
    const enabled = configMap.get(ENABLED_KEY) !== "false";
    const label = configMap.get(LABEL_KEY)?.trim() || "Join Community Group";
    const configuredUrl = configMap.get(URL_KEY)?.trim() || "";
    let safeUrl = "";
    try {
      const parsed = new URL(configuredUrl);
      if (parsed.protocol === "https:") safeUrl = parsed.toString();
    } catch {
      // An unset or malformed link is not returned to applicants.
    }

    const canAccessInvite = context?.paymentApproved === true && enabled;

    return json({
      enabled,
      url: canAccessInvite ? safeUrl : "",
      label,
    });
  } catch (error) {
    console.error("Get community link error:", error);
    return json({ error: "Internal server error" }, 500);
  }
}
