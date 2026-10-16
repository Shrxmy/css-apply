import { AttendanceEventStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { addAttendanceAudit } from "@/lib/attendance";
import { authorizeAttendanceOperator } from "@/lib/attendance-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; attendanceId: string }> },
) {
  try {
    const authorization = await authorizeAttendanceOperator({
      superAdminOnly: true,
    });
    if (authorization.response) return authorization.response;
    const { eventId, attendanceId } = await params;

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "AttendanceEvent" WHERE "id" = ${eventId} FOR SHARE`;
      const event = await tx.attendanceEvent.findUnique({
        where: { id: eventId },
        select: { status: true },
      });
      if (!event) return { error: "Event not found", status: 404 } as const;
      if (event.status === AttendanceEventStatus.ARCHIVED) {
        return {
          error: "Check-ins on archived events cannot be undone",
          status: 409,
        } as const;
      }

      const attendance = await tx.eventAttendance.findUnique({
        where: { id: attendanceId },
        include: {
          rosterEntry: { select: { fullName: true, studentNumber: true } },
          checkedInBy: { select: { name: true } },
        },
      });
      if (!attendance || attendance.eventId !== eventId) {
        return { error: "Check-in not found", status: 404 } as const;
      }
      // Same row lock the scan route takes, so an undo and a scan serialize.
      await tx.$queryRaw`SELECT "id" FROM "AttendanceEventRoster" WHERE "id" = ${attendance.rosterEntryId} FOR UPDATE`;

      // Keep scan history; only detach it from the voided check-in.
      await tx.attendanceScanAttempt.updateMany({
        where: { attendanceId: attendance.id },
        data: { attendanceId: null },
      });
      // A concurrent undo may have won the roster lock first.
      const { count } = await tx.eventAttendance.deleteMany({
        where: { id: attendance.id },
      });
      if (count === 0) {
        return { error: "Check-in not found", status: 404 } as const;
      }
      await addAttendanceAudit(
        tx,
        authorization.operator.id,
        "ATTENDANCE_CHECKIN_VOIDED",
        "event_attendance",
        attendance.id,
        {
          eventId,
          rosterEntryId: attendance.rosterEntryId,
          fullName: attendance.rosterEntry.fullName,
          studentNumber: attendance.rosterEntry.studentNumber,
          checkedInAt: attendance.checkedInAt.toISOString(),
          method: attendance.method,
          checkedInBy: attendance.checkedInBy.name,
        },
      );
      return { voided: true, status: 200 } as const;
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ voided: true });
  } catch (error) {
    console.error(
      "Void attendance check-in failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The check-in could not be undone" },
      { status: 500 },
    );
  }
}
