import { AttendanceEventStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addAttendanceAudit,
  materializeAttendanceRoster,
  syncAttendanceRoster,
} from "@/lib/attendance";
import { authorizeAttendanceOperator } from "@/lib/attendance-auth";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({ status: z.nativeEnum(AttendanceEventStatus) });

const transitions: Record<AttendanceEventStatus, AttendanceEventStatus[]> = {
  DRAFT: [AttendanceEventStatus.OPEN, AttendanceEventStatus.ARCHIVED],
  OPEN: [AttendanceEventStatus.CLOSED],
  CLOSED: [AttendanceEventStatus.OPEN, AttendanceEventStatus.ARCHIVED],
  ARCHIVED: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const authorization = await authorizeAttendanceOperator({
      superAdminOnly: true,
    });
    if (authorization.response) return authorization.response;

    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid event status" },
        { status: 400 },
      );
    }
    const { eventId } = await params;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "AttendanceEvent" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.attendanceEvent.findUnique({
        where: { id: eventId },
        include: { _count: { select: { rosterEntries: true } } },
      });
      if (!event) return { error: "Event not found", status: 404 } as const;
      if (event.status === parsed.data.status) {
        return { event, status: 200 } as const;
      }
      if (!transitions[event.status].includes(parsed.data.status)) {
        return {
          error: `An event cannot move from ${event.status.toLowerCase()} to ${parsed.data.status.toLowerCase()}`,
          status: 409,
        } as const;
      }
      if (
        parsed.data.status === AttendanceEventStatus.OPEN &&
        event._count.rosterEntries === 0
      ) {
        return {
          error: "An event with an empty roster cannot be opened",
          status: 409,
        } as const;
      }

      const updated = await tx.attendanceEvent.update({
        where: { id: event.id },
        data: { status: parsed.data.status },
        include: { _count: { select: { rosterEntries: true } } },
      });
      await addAttendanceAudit(
        tx,
        authorization.operator.id,
        "ATTENDANCE_EVENT_STATUS_CHANGED",
        "attendance_event",
        event.id,
        { from: event.status, to: updated.status },
      );
      return { event: updated, status: 200 } as const;
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      status: result.event.status,
      rosterCount: result.event._count.rosterEntries,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error(
      "Update attendance event status failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Event status could not be updated" },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const authorization = await authorizeAttendanceOperator({
      superAdminOnly: true,
    });
    if (authorization.response) return authorization.response;
    const { eventId } = await params;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "AttendanceEvent" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.attendanceEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) return { error: "Event not found", status: 404 } as const;
      if (event.status === AttendanceEventStatus.ARCHIVED) {
        return {
          error: "Archived event rosters cannot be changed",
          status: 409,
        } as const;
      }
      if (event.status === AttendanceEventStatus.DRAFT) {
        const rosterCount = await materializeAttendanceRoster(
          tx,
          event.id,
          event.recruitmentCycleId,
          event.eligibleGroups,
        );
        await addAttendanceAudit(
          tx,
          authorization.operator.id,
          "ATTENDANCE_EVENT_ROSTER_REFRESHED",
          "attendance_event",
          event.id,
          { mode: "replace", rosterCount },
        );
        return {
          mode: "replace",
          rosterCount,
          added: null,
          status: 200,
        } as const;
      }

      // Open/closed events already have check-ins tied to roster rows.
      const synced = await syncAttendanceRoster(
        tx,
        event.id,
        event.recruitmentCycleId,
        event.eligibleGroups,
      );
      await addAttendanceAudit(
        tx,
        authorization.operator.id,
        "ATTENDANCE_EVENT_ROSTER_SYNCED",
        "attendance_event",
        event.id,
        { mode: "add_only", ...synced },
      );
      return {
        mode: "add_only",
        rosterCount: synced.rosterCount,
        added: synced.added,
        status: 200,
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      mode: result.mode,
      rosterCount: result.rosterCount,
      added: result.added,
    });
  } catch (error) {
    console.error(
      "Refresh attendance roster failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Event roster could not be refreshed" },
      { status: 500 },
    );
  }
}
