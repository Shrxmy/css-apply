import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { committeeRoles } from "@/data/committeeRoles";
import { supabase } from "@/lib/supabase";
import { getRoleId } from "@/lib/eb-mapping";

const EB_IMAGE_BUCKET = "eb-profile-images";

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
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

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true, schoolYear: true },
    });

    if (!activeCycle) {
      return NextResponse.json({ profiles: [], activeCycle: null });
    }

    const profiles = await prisma.eBProfile.findMany({
      where: { recruitmentCycleId: activeCycle.id, isActive: true },
      select: {
        userId: true,
        position: true,
        imagePath: true,
        user: { select: { name: true } },
      },
      orderBy: { position: "asc" },
    });

    return NextResponse.json({
      profiles: profiles.map((profile) => ({
        userId: profile.userId,
        position: profile.position,
        roleId: getRoleId(profile.position),
        userName: profile.user.name,
        imageUrl: profile.imagePath
          ? `/api/admin/eb-profiles/image?userId=${encodeURIComponent(profile.userId)}&v=${encodeURIComponent(profile.imagePath)}`
          : null,
      })),
      activeCycle,
    });
  } catch (error) {
    console.error(
      "Get active EB profiles failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const normalizeCommitteeId = (value: string) => {
  const normalizedValue = value.toLowerCase().replace(/&/g, "and");
  const committee = committeeRoles.find(
    ({ id, title }) =>
      id.toLowerCase() === normalizedValue ||
      title.toLowerCase().replace(/&/g, "and") === normalizedValue,
  );

  return committee?.id ?? value;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json(
        { error: "Forbidden - Super admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { userId, position, committees, isActive, meetingLink } = body;

    if (!userId || !position) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const normalizedCommittees = Array.isArray(committees)
      ? Array.from(
          new Set(
            committees
              .filter(
                (committee): committee is string =>
                  typeof committee === "string",
              )
              .map(normalizeCommitteeId),
          ),
        )
      : [];

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    // Create or update EB profile for the current active academic year
    const ebProfile = await prisma.eBProfile.upsert({
      where: { userId },
      update: {
        position,
        committees: normalizedCommittees,
        isActive: isActive ?? true,
        meetingLink: meetingLink ?? null,
        recruitmentCycleId: activeCycle?.id ?? null,
      },
      create: {
        userId,
        position,
        committees: normalizedCommittees,
        isActive: isActive ?? true,
        meetingLink: meetingLink ?? null,
        recruitmentCycleId: activeCycle?.id ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      ebProfile,
    });
  } catch (error) {
    console.error("Error managing EB profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json(
        { error: "Forbidden - Super admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const deletedProfile = await prisma.eBProfile.delete({
      where: { userId },
      select: { imagePath: true },
    });

    if (deletedProfile.imagePath) {
      const { error } = await supabase.storage
        .from(EB_IMAGE_BUCKET)
        .remove([deletedProfile.imagePath]);
      if (error) console.error("Removed EB profile image cleanup failed");
    }

    return NextResponse.json({
      success: true,
      message: "EB profile removed successfully",
    });
  } catch (error) {
    console.error("Error removing EB profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
