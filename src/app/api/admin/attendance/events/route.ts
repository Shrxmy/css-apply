import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAttendanceOperator } from "@/lib/attendance-auth";
import {
  addAttendanceAudit,
  isAttendanceGroup,
  materializeAttendanceRoster,
} from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

const eventSchema = z
  .object({
    recruitmentCycleId: z.string().min(1),
    title: z.string().trim().min(1).max(160),
    venue: z.string().trim().min(1).max(160),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    checkInOpensAt: z.coerce.date(),
    checkInClosesAt: z.coerce.date(),
    eligibleGroups: z
      .array(z.string())
      .min(1)
      .transform((groups, context) => {
        const unique = [...new Set(groups)];
        if (!unique.every(isAttendanceGroup)) {
          context.addIssue({
            code: "custom",
            message: "One or more eligibility groups are invalid",
          });
          return z.NEVER;
        }
        return unique;
      }),
  })
  .superRefine((value, context) => {
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

export async function GET() {
  try {
    // Reads run alongside the authorization lookup to save a database round
    // trip; nothing is returned unless authorization passes.
    const [authorization, events, cycles] = await Promise.all([
      authorizeAttendanceOperator(),
      prisma.attendanceEvent.findMany({
        orderBy: { startsAt: "desc" },
        include: {
          recruitmentCycle: { select: { schoolYear: true } },
          createdBy: { select: { name: true } },
          _count: { select: { rosterEntries: true, attendances: true } },
        },
      }),
      prisma.recruitmentCycle.findMany({
        orderBy: { schoolYear: "desc" },
        select: { id: true, schoolYear: true, isActive: true },
      }),
    ]);
    if (authorization.response) return authorization.response;

    return NextResponse.json({
      canManage: authorization.operator.role === "super_admin",
      cycles,
      events: events.map((event) => ({
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
      })),
    });
  } catch (error) {
    console.error(
      "Load attendance events failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Attendance events could not be loaded" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAttendanceOperator({
      superAdminOnly: true,
    });
    if (authorization.response) return authorization.response;

    const parsed = eventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid event details" },
        { status: 400 },
      );
    }

    const cycle = await prisma.recruitmentCycle.findUnique({
      where: { id: parsed.data.recruitmentCycleId },
      select: { id: true },
    });
    if (!cycle) {
      return NextResponse.json(
        { error: "Recruitment cycle not found" },
        { status: 404 },
      );
    }

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.attendanceEvent.create({
        data: {
          recruitmentCycleId: parsed.data.recruitmentCycleId,
          title: parsed.data.title,
          venue: parsed.data.venue,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
          checkInOpensAt: parsed.data.checkInOpensAt,
          checkInClosesAt: parsed.data.checkInClosesAt,
          eligibleGroups: parsed.data.eligibleGroups,
          createdById: authorization.operator.id,
        },
      });
      const rosterCount = await materializeAttendanceRoster(
        tx,
        created.id,
        created.recruitmentCycleId,
        created.eligibleGroups,
      );
      await addAttendanceAudit(
        tx,
        authorization.operator.id,
        "ATTENDANCE_EVENT_CREATED",
        "attendance_event",
        created.id,
        {
          recruitmentCycleId: created.recruitmentCycleId,
          eligibleGroups: created.eligibleGroups,
          rosterCount,
        },
      );
      return { ...created, rosterCount };
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error(
      "Create attendance event failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Attendance event could not be created" },
      { status: 500 },
    );
  }
}
