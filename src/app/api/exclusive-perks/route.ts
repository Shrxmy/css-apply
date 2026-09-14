import { NextResponse } from "next/server";
import {
  EXCLUSIVE_PERKS_CONFIG_KEY,
  isLocalPerkImagePath,
  parseExclusivePerks,
} from "@/lib/exclusive-perks";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: EXCLUSIVE_PERKS_CONFIG_KEY },
      select: { value: true },
    });
    const items = parseExclusivePerks(config?.value);

    return NextResponse.json(
      {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          destinationUrl: item.destinationUrl,
          imageUrl: isLocalPerkImagePath(item.imagePath)
            ? item.imagePath
            : `/api/exclusive-perks/image?v=${encodeURIComponent(item.imagePath)}`,
          shape: item.shape,
          fit: item.fit,
          size: item.size,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "Get public exclusive perks failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Unable to load exclusive perks" },
      { status: 500 },
    );
  }
}
