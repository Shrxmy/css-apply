import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const URL_KEY = "community_group_url";
const LABEL_KEY = "community_group_label";
const ENABLED_KEY = "community_group_enabled";

export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: [URL_KEY, LABEL_KEY, ENABLED_KEY] } },
    });

    const configMap = new Map(configs.map((config) => [config.key, config.value]));

    return NextResponse.json({
      enabled: configMap.get(ENABLED_KEY) !== "false",
      url: configMap.get(URL_KEY)?.trim() || "",
      label: configMap.get(LABEL_KEY)?.trim() || "Join Community Group",
    });
  } catch (error) {
    console.error("Get community link error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
