import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPositionTitle } from "@/lib/eb-mapping";

// GET all available interview slots
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ position: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin access
    const userRole = session.user.role;
    const hasAdminAccess = userRole === "admin" || userRole === "super_admin";

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const { position } = await params;

    // Normalize position: handle both EB role IDs and position titles case-insensitively
    // Convert role IDs like "president" to position titles like "President"
    // For position titles or committee names, use as-is but ensure consistent casing
    const normalizedPosition = getPositionTitle(position);

    const applications: Array<{
      id: string;
      interviewSlotDay: string | null;
      interviewSlotTimeStart: string | null;
      interviewSlotTimeEnd: string | null;
      user: { name: string };
    }> = [];
    const committeeApplicationsSlots =
      await prisma.committeeApplication.findMany({
        where: {
          interviewBy: {
            equals: normalizedPosition,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          interviewSlotDay: true,
          interviewSlotTimeStart: true,
          interviewSlotTimeEnd: true,
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          { interviewSlotDay: "asc" },
          { interviewSlotTimeStart: "asc" },
        ],
      });
    applications.push(...committeeApplicationsSlots);

    const eaApplicationsSlots = await prisma.eAApplication.findMany({
      where: {
        interviewBy: {
          equals: normalizedPosition,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        interviewSlotDay: true,
        interviewSlotTimeStart: true,
        interviewSlotTimeEnd: true,
        interviewBy: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ interviewSlotDay: "asc" }, { interviewSlotTimeStart: "asc" }],
    });
    applications.push(...eaApplicationsSlots);

    // Get meeting link from EBProfile
    let meetingLink = null;
    const ebProfile = await prisma.eBProfile.findFirst({
      where: {
        position: normalizedPosition,
      },
    });
    meetingLink = ebProfile?.meetingLink || null;

    const slots = applications.map((application) => ({
      id: application.id,
      day: application.interviewSlotDay,
      name: application.user.name,
      meetingLink: meetingLink,
      timeStart: application.interviewSlotTimeStart,
      timeEnd: application.interviewSlotTimeEnd,
    }));

    return NextResponse.json({
      success: true,
      slots,
    });
  } catch (error) {
    console.error("Error fetching interview slots:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
