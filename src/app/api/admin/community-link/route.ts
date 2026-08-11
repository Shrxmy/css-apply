import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const URL_KEY = "community_group_url";
const LABEL_KEY = "community_group_label";
const ENABLED_KEY = "community_group_enabled";

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
}

async function getCommunityLink() {
  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: [URL_KEY, LABEL_KEY, ENABLED_KEY] } },
  });

  const configMap = new Map(configs.map((config) => [config.key, config.value]));

  return {
    enabled: configMap.get(ENABLED_KEY) !== "false",
    url: configMap.get(URL_KEY)?.trim() || "",
    label: configMap.get(LABEL_KEY)?.trim() || "Join Community Group",
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(await getCommunityLink());
  } catch (error) {
    console.error("Get admin community link error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { enabled, url, label } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Community URL is required" }, { status: 400 });
    }

    if (!label || typeof label !== "string") {
      return NextResponse.json({ error: "Button label is required" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.systemConfig.upsert({
        where: { key: URL_KEY },
        update: { value: url.trim() },
        create: {
          key: URL_KEY,
          value: url.trim(),
          description: "Community group invite URL shown to accepted applicants",
        },
      }),
      prisma.systemConfig.upsert({
        where: { key: LABEL_KEY },
        update: { value: label.trim() },
        create: {
          key: LABEL_KEY,
          value: label.trim(),
          description: "Community group button label shown to accepted applicants",
        },
      }),
      prisma.systemConfig.upsert({
        where: { key: ENABLED_KEY },
        update: { value: enabled === false ? "false" : "true" },
        create: {
          key: ENABLED_KEY,
          value: enabled === false ? "false" : "true",
          description: "Whether to show the community group card to accepted applicants",
        },
      }),
    ]);

    return NextResponse.json(await getCommunityLink());
  } catch (error) {
    console.error("Update community link error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
