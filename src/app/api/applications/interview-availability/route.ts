import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPositionTitle, getRoleId } from "@/lib/eb-mapping";
import { generateInterviewAvailability } from "@/lib/interview-availability";
import { prisma } from "@/lib/prisma";
import { getManilaDateKey } from "@/lib/manila-date";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: PRIVATE_NO_STORE_HEADERS,
  });
}

function normalized(value: string) {
  return value.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return privateJson({ error: "Unauthorized" }, 401);
    }

    const applicationType = request.nextUrl.searchParams.get("type");
    const target = request.nextUrl.searchParams.get("target")?.trim();
    if (
      (applicationType !== "committee" &&
        applicationType !== "executive-associate") ||
      !target
    ) {
      return privateJson(
        { error: "Invalid interview availability request" },
        400,
      );
    }

    const cycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        interviewStart: true,
        interviewEnd: true,
      },
    });

    if (!cycle?.interviewStart || !cycle.interviewEnd) {
      return privateJson(
        { error: "Interview dates are not configured for the active cycle" },
        409,
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        committeeApplications: {
          where: { recruitmentCycleId: cycle.id },
          select: {
            id: true,
            firstOptionCommittee: true,
            interviewSlotDay: true,
          },
          take: 1,
        },
        executiveAssociateApplications: {
          where: { recruitmentCycleId: cycle.id },
          select: { id: true, ebRole: true, interviewSlotDay: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return privateJson({ error: "User not found" }, 404);
    }

    let applicationId: string;
    let interviewers: Array<{ position: string }>;

    if (applicationType === "committee") {
      const application = user.committeeApplications[0];
      if (!application) {
        return privateJson(
          { error: "Submit your committee application before scheduling" },
          409,
        );
      }
      if (application.interviewSlotDay) {
        return privateJson(
          { error: "Your interview schedule has already been confirmed" },
          409,
        );
      }
      if (normalized(application.firstOptionCommittee) !== normalized(target)) {
        return privateJson(
          { error: "Committee does not match the submitted application" },
          400,
        );
      }

      applicationId = application.id;
      interviewers = await prisma.eBProfile.findMany({
        where: {
          recruitmentCycleId: cycle.id,
          isActive: true,
          committees: { has: application.firstOptionCommittee },
        },
        select: { position: true },
        orderBy: { position: "asc" },
      });
    } else {
      const application = user.executiveAssociateApplications[0];
      if (!application) {
        return privateJson(
          {
            error:
              "Submit your Executive Associate application before scheduling",
          },
          409,
        );
      }
      if (application.interviewSlotDay) {
        return privateJson(
          { error: "Your interview schedule has already been confirmed" },
          409,
        );
      }
      if (getRoleId(application.ebRole) !== getRoleId(target)) {
        return privateJson(
          { error: "Executive Board role does not match the application" },
          400,
        );
      }

      applicationId = application.id;
      interviewers = await prisma.eBProfile.findMany({
        where: {
          recruitmentCycleId: cycle.id,
          isActive: true,
          position: {
            equals: getPositionTitle(application.ebRole),
            mode: "insensitive",
          },
        },
        select: { position: true },
        orderBy: { position: "asc" },
      });
    }

    if (interviewers.length === 0) {
      return privateJson(
        { error: "No active interviewer is assigned to this application" },
        409,
      );
    }

    const interviewerAliases = Array.from(
      new Set(
        interviewers.flatMap(({ position }) => [position, getRoleId(position)]),
      ),
    );
    const interviewerFilter = {
      OR: interviewerAliases.map((value) => ({
        interviewBy: { equals: value, mode: "insensitive" as const },
      })),
    };
    const startDate = getManilaDateKey(cycle.interviewStart);
    const endDate = getManilaDateKey(cycle.interviewEnd);

    const [unavailableBlocks, committeeBookings, executiveBookings] =
      await Promise.all([
        prisma.availableEBInterviewTime.findMany({
          where: {
            maxSlots: 0,
            day: { gte: startDate, lte: endDate },
            OR: interviewerAliases.map((value) => ({
              eb: { equals: value, mode: "insensitive" as const },
            })),
          },
          select: {
            eb: true,
            day: true,
            timeStart: true,
            timeEnd: true,
          },
        }),
        prisma.committeeApplication.findMany({
          where: {
            recruitmentCycleId: cycle.id,
            interviewSlotDay: { gte: startDate, lte: endDate },
            ...interviewerFilter,
          },
          select: {
            id: true,
            interviewBy: true,
            interviewSlotDay: true,
            interviewSlotTimeStart: true,
            interviewSlotTimeEnd: true,
          },
        }),
        prisma.executiveAssociateApplication.findMany({
          where: {
            recruitmentCycleId: cycle.id,
            interviewSlotDay: { gte: startDate, lte: endDate },
            ...interviewerFilter,
          },
          select: {
            id: true,
            interviewBy: true,
            interviewSlotDay: true,
            interviewSlotTimeStart: true,
            interviewSlotTimeEnd: true,
          },
        }),
      ]);

    const bookings = [
      ...committeeBookings.filter(
        (booking) =>
          applicationType !== "committee" || booking.id !== applicationId,
      ),
      ...executiveBookings.filter(
        (booking) =>
          applicationType !== "executive-associate" ||
          booking.id !== applicationId,
      ),
    ];

    const slots = generateInterviewAvailability({
      interviewStart: cycle.interviewStart,
      interviewEnd: cycle.interviewEnd,
      interviewers,
      unavailableBlocks,
      bookings,
      assignmentSeed: user.id,
    });

    return privateJson({
      success: true,
      policy: "AT_LEAST_ONE_INTERVIEWER_AVAILABLE",
      slots,
    });
  } catch (error) {
    console.error(
      "Interview availability error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return privateJson({ error: "Unable to load interview availability" }, 500);
  }
}
