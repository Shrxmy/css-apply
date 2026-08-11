import { NextRequest, NextResponse } from "next/server";
import { roles } from "@/data/ebRoles";
import { getPositionTitle } from "@/lib/eb-mapping";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "eb-profile-images";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> },
) {
  try {
    const { roleId } = await params;
    if (!roles.some((role) => role.id === roleId)) {
      return NextResponse.json({ error: "EB role not found" }, { status: 404 });
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (!activeCycle) {
      return NextResponse.json({ error: "No active recruitment cycle" }, { status: 404 });
    }

    const profile = await prisma.eBProfile.findFirst({
      where: {
        recruitmentCycleId: activeCycle.id,
        position: getPositionTitle(roleId),
        isActive: true,
      },
      select: { imagePath: true },
    });

    if (!profile?.imagePath) {
      return NextResponse.json({ error: "EB image not configured" }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(profile.imagePath);

    if (error || !data) {
      console.error("Public EB image download failed");
      return NextResponse.json({ error: "EB image not found" }, { status: 404 });
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": data.type || "image/jpeg",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "Get public EB image failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
