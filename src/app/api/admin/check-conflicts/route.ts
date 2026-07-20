import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// GET to check for interview slot conflicts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "admin" && session.user.role !== "super_admin")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const activeCycleId = activeCycle?.id ?? "__no_active_cycle__";

    // Check for conflicts in EA Applications
    const eaConflicts = await prisma.executiveAssociateApplication.findMany({
      where: {
        recruitmentCycleId: activeCycleId,
        AND: [
          { interviewSlotDay: { not: null } },
          { interviewSlotTimeStart: { not: null } },
          { interviewSlotTimeEnd: { not: null } },
          { interviewBy: { not: null } },
        ],
      },
      select: {
        studentNumber: true,
        interviewSlotDay: true,
        interviewSlotTimeStart: true,
        interviewSlotTimeEnd: true,
        interviewBy: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { interviewSlotDay: "asc" },
        { interviewSlotTimeStart: "asc" },
        { interviewBy: "asc" },
      ],
    });

    // Check for conflicts in Committee Applications
    const committeeConflicts = await prisma.committeeApplication.findMany({
      where: {
        recruitmentCycleId: activeCycleId,
        AND: [
          { interviewSlotDay: { not: null } },
          { interviewSlotTimeStart: { not: null } },
          { interviewSlotTimeEnd: { not: null } },
          { interviewBy: { not: null } },
        ],
      },
      select: {
        studentNumber: true,
        interviewSlotDay: true,
        interviewSlotTimeStart: true,
        interviewSlotTimeEnd: true,
        interviewBy: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { interviewSlotDay: "asc" },
        { interviewSlotTimeStart: "asc" },
        { interviewBy: "asc" },
      ],
    });

    // Define types for better type safety
    type ApplicationWithUser = {
      studentNumber: string;
      interviewSlotDay: string | null;
      interviewSlotTimeStart: string | null;
      interviewSlotTimeEnd: string | null;
      interviewBy: string | null;
      user: {
        name: string | null;
        email: string;
      };
    };

    // Find actual conflicts by grouping by slot details
    const findConflicts = (applications: ApplicationWithUser[]) => {
      const slotGroups: { [key: string]: ApplicationWithUser[] } = {};

      applications.forEach((app) => {
        const key = `${app.interviewSlotDay}-${app.interviewSlotTimeStart}-${app.interviewSlotTimeEnd}-${app.interviewBy}`;
        if (!slotGroups[key]) {
          slotGroups[key] = [];
        }
        slotGroups[key].push(app);
      });

      const conflicts = Object.entries(slotGroups)
        .filter(([, apps]) => apps.length > 1)
        .map(([slotKey, apps]) => ({
          slotKey,
          slotDetails: {
            day: apps[0].interviewSlotDay,
            timeStart: apps[0].interviewSlotTimeStart,
            timeEnd: apps[0].interviewSlotTimeEnd,
            interviewer: apps[0].interviewBy,
          },
          conflictingApplications: apps,
        }));

      return conflicts;
    };

    const eaConflictsFound = findConflicts(eaConflicts);
    const committeeConflictsFound = findConflicts(committeeConflicts);

    return NextResponse.json({
      success: true,
      conflicts: {
        ea: eaConflictsFound,
        committee: committeeConflictsFound,
        total: eaConflictsFound.length + committeeConflictsFound.length,
      },
      allBookings: {
        ea: eaConflicts,
        committee: committeeConflicts,
      },
    });
  } catch (error) {
    console.error("Error checking conflicts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
