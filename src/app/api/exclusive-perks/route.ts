import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import {
  EXCLUSIVE_PERKS_BUCKET,
  EXCLUSIVE_PERKS_CONFIG_KEY,
  isLocalPerkImagePath,
  parseExclusivePerks,
} from "@/lib/exclusive-perks";

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: EXCLUSIVE_PERKS_CONFIG_KEY },
      select: { value: true },
    });
    const items = parseExclusivePerks(config?.value);
    const storagePaths = items.flatMap((item) =>
      isLocalPerkImagePath(item.imagePath) ? [] : [item.imagePath],
    );
    const signedUrls = new Map<string, string>();

    if (storagePaths.length > 0) {
      const { data, error } = await supabase.storage
        .from(EXCLUSIVE_PERKS_BUCKET)
        .createSignedUrls(storagePaths, 60 * 60);
      if (error) throw new Error("Unable to prepare exclusive perk images");

      for (const image of data) {
        if (image.path && image.signedUrl) {
          signedUrls.set(image.path, image.signedUrl);
        }
      }
    }

    return NextResponse.json(
      {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          destinationUrl: item.destinationUrl,
          imageUrl: isLocalPerkImagePath(item.imagePath)
            ? item.imagePath
            : signedUrls.get(item.imagePath) || "",
          shape: item.shape,
          fit: item.fit,
          size: item.size,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error(
      "Get public exclusive perks failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Unable to load exclusive perks" }, { status: 500 });
  }
}
