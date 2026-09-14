import { AttendanceEventStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addAttendanceAudit,
  isAttendanceGroup,
  materializeAttendanceRoster,
} from "@/lib/attendance";
import { authorizeAttendanceOperator } from "@/lib/attendance-auth";
import { prisma } from "@/lib/prisma";

const updateEventSchema = z
  .object({
    recruitmentCycleId: z.string().min(1),
    title: z.string().trim().min(1).max(160),
    venue: z.string().trim().min(1).max(160),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    checkInOpensAt: z.coerce.date(),
    checkInClosesAt: z.coerce.date(),
    eligibleGroups: z.array(z.string()).min(1),
  })
  .superRefine((value, context) => {
    if (!value.eligibleGroups.every(isAttendanceGroup)) {
      context.addIssue({
        code: "custom",
        path: ["eligibleGroups"],
        message: "One or more eligibility groups are invalid",
      });
    }
    if (value.endsAt <= value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Event end must be after its start",
      });
    }
    if (value.checkInClosesAt <= value.checkInOpensAt) {
      context.addIssue({
        code: "custom",
        path: ["checkInClosesAt"],
        message: "Check-in closing time must be after its opening time",
      });
    }
  });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const authorization = await authorizeAttendanceOperator();
    if (authorization.response) return authorization.response;

    const { eventId } = await params;
    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1,
    );
    const limit = 50;
    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const attendanceStatus =
      request.nextUrl.searchParams.get("status") || "all";
    const where = {
      eventId,
      ...(attendanceStatus === "present"
        ? { attendance: { isNot: null } }
        : attendanceStatus === "absent"
          ? { attendance: { is: null } }
          : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { studentNumber: { contains: search } },
              { memberId: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const event = await prisma.attendanceEvent.findUnique({
      where: { id: eventId },
      include: {
        recruitmentCycle: { select: { schoolYear: true } },
        createdBy: { select: { name: true } },
        _count: { select: { rosterEntries: true, attendances: true } },
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const [entries, total] = await Promise.all([
      prisma.attendanceEventRoster.findMany({
        where,
        orderBy: [{ attendance: { checkedInAt: "desc" } }, { fullName: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          attendance: {
            select: {
              id: true,
              checkedInAt: true,
              method: true,
              checkedInBy: { select: { name: true } },
            },
          },
        },
      }),
      prisma.attendanceEventRoster.count({ where }),
    ]);

    return NextResponse.json({
      canManage: authorization.operator.role === "super_admin",
      event: {
        id: event.id,
        recruitmentCycleId: event.recruitmentCycleId,
        title: event.title,
        venue: event.venue,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        checkInOpensAt: event.checkInOpensAt,
        checkInClosesAt: event.checkInClosesAt,
        status: event.status,
        eligibleGroups: event.eligibleGroups,
        schoolYear: event.recruitmentCycle.schoolYear,
        createdBy: event.createdBy.name,
        rosterCount: event._count.rosterEntries,
        attendanceCount: event._count.attendances,
      },
      entries: entries.map((entry) => ({
        id: entry.id,
        fullName: entry.fullName,
        studentNumber: entry.studentNumber,
        memberId: entry.memberId,
        section: entry.section,
        source: entry.source,
        affiliationGroups: entry.affiliationGroups,
        isActive: entry.isActive,
        attendance: entry.attendance,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error(
      "Load attendance event failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Attendance event could not be loaded" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
        select: {
          id: true,
          title: true,
          status: true,
          _count: { select: { rosterEntries: true, attendances: true } },
        },
      });
      if (!event) return { error: "Event not found", status: 404 } as const;

      // These relations intentionally use RESTRICT in the schema so that
      // attendance cannot disappear accidentally. A deliberate event delete
      // removes the dependent scan history and snapshot in one transaction.
      await tx.attendanceScanAttempt.deleteMany({ where: { eventId } });
      await tx.eventAttendance.deleteMany({ where: { eventId } });
      await tx.attendanceEventRoster.deleteMany({ where: { eventId } });
      await tx.attendanceEvent.delete({ where: { id: eventId } });
      await addAttendanceAudit(
        tx,
        authorization.operator.id,
        "ATTENDANCE_EVENT_DELETED",
        "attendance_event",
        eventId,
        {
          title: event.title,
          status: event.status,
          rosterCount: event._count.rosterEntries,
          attendanceCount: event._count.attendances,
        },
      );

      return { deleted: true, status: 200 } as const;
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      "Delete attendance event failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Attendance event could not be deleted" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const authorization = await authorizeAttendanceOperator({
      superAdminOnly: true,
    });
    if (authorization.response) return authorization.response;
    const parsed = updateEventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid event details" },
        { status: 400 },
      );
    }
    const { eventId } = await params;
    const cycle = await prisma.recruitmentCycle.findUnique({
      where: { id: parsed.data.recruitmentCycleId },
      select: { id: true },
    });
    if (!cycle) {
      return NextResponse.json(
        { error: "Recruitment cycle not found" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "AttendanceEvent" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.attendanceEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) return { error: "Event not found", status: 404 } as const;
      if (
        event.status !== AttendanceEventStatus.DRAFT &&
        event.status !== AttendanceEventStatus.OPEN
      ) {
        return {
          error: "Only draft or open events can be edited",
          status: 409,
        } as const;
      }

      const eligibleGroups = [
        ...new Set(parsed.data.eligibleGroups.filter(isAttendanceGroup)),
      ];
      const configurationChanged =
        event.recruitmentCycleId !== parsed.data.recruitmentCycleId ||
        [...event.eligibleGroups].sort().join("|") !==
          [...eligibleGroups].sort().join("|");
      if (event.status === AttendanceEventStatus.OPEN && configurationChanged) {
        return {
          error:
            "Academic year and eligibility groups cannot change while an event is open",
          status: 409,
        } as const;
      }

      const updated = await tx.attendanceEvent.update({
        where: { id: event.id },
        data: {
          recruitmentCycleId: parsed.data.recruitmentCycleId,
          title: parsed.data.title,
          venue: parsed.data.venue,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
          checkInOpensAt: parsed.data.checkInOpensAt,
          checkInClosesAt: parsed.data.checkInClosesAt,
          eligibleGroups,
        },
      });
      const rosterCount = configurationChanged
        ? await materializeAttendanceRoster(
            tx,
            updated.id,
            updated.recruitmentCycleId,
            updated.eligibleGroups,
          )
        : await tx.attendanceEventRoster.count({
            where: { eventId: updated.id },
          });
      await addAttendanceAudit(
        tx,
        authorization.operator.id,
        "ATTENDANCE_EVENT_UPDATED",
        "attendance_event",
        updated.id,
        { configurationChanged, rosterCount },
      );
      return { event: updated, rosterCount, status: 200 } as const;
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      event: result.event,
      rosterCount: result.rosterCount,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error(
      "Update attendance event failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Attendance event could not be updated" },
      { status: 500 },
    );
  }
}
