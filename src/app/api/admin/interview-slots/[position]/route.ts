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

    const userRole = session.user.role;
    const hasAdminAccess =
      userRole === "admin" ||
      userRole === "super_admin" ||
      userRole === "super-admin";

    const { position } = await params;

    // Normalize position: handle both EB role IDs and position titles case-insensitively
    // Convert role IDs like "president" to position titles like "President"
    // For position titles or committee names, use as-is but ensure consistent casing
    const normalizedPosition = getPositionTitle(position);

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const activeCycleId = activeCycle?.id ?? "__no_active_cycle__";

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
          recruitmentCycleId: activeCycleId,
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

    const executiveAssociateApplicationsSlots =
      await prisma.executiveAssociateApplication.findMany({
        where: {
          recruitmentCycleId: activeCycleId,
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
        orderBy: [
          { interviewSlotDay: "asc" },
          { interviewSlotTimeStart: "asc" },
        ],
      });
    applications.push(...executiveAssociateApplicationsSlots);

    const meetingLink = hasAdminAccess && activeCycle
      ? (
          await prisma.eBProfile.findFirst({
            where: {
              recruitmentCycleId: activeCycle?.id,
              isActive: true,
              position: {
                equals: normalizedPosition,
                mode: "insensitive",
              },
            },
            select: { meetingLink: true },
          })
        )?.meetingLink || null
      : null;

    const slots = applications.map((application) => ({
      id: application.id,
      day: application.interviewSlotDay,
      name: hasAdminAccess ? application.user.name : "Booked",
      meetingLink,
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
