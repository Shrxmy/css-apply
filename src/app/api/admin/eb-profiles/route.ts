import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    const isSuperAdmin =
      userRole === "super_admin" || userRole === "super-admin";

    if (!isSuperAdmin) {
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

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    // Create or update EB profile for the current active academic year
    const ebProfile = await prisma.eBProfile.upsert({
      where: { userId },
      update: {
        position,
        committees: committees || [],
        isActive: isActive ?? true,
        meetingLink: meetingLink ?? null,
        recruitmentCycleId: activeCycle?.id ?? null,
      },
      create: {
        userId,
        position,
        committees: committees || [],
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

    // Check if user has super_admin role
    const userRole = session.user.role;
    const isSuperAdmin =
      userRole === "super_admin" || userRole === "super-admin";

    if (!isSuperAdmin) {
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

    // Delete EB profile
    await prisma.eBProfile.delete({
      where: { userId },
    });

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
