import {
  AttendanceEventStatus,
  AttendanceMethod,
  AttendanceScanOutcome,
  Prisma,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addAttendanceAudit,
  addEligibleAttendee,
  credentialStudentNumber,
  normalizeStudentNumber,
  parseAttendanceCredential,
} from "@/lib/attendance";
import { authorizeAttendanceOperator } from "@/lib/attendance-auth";
import { prisma } from "@/lib/prisma";

const scanSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("QR"),
    clientScanId: z.string().uuid(),
    credential: z.string().min(1).max(2048),
  }),
  z.object({
    mode: z.literal("MANUAL"),
    clientScanId: z.string().uuid(),
    studentNumber: z.string().min(1).max(32),
  }),
]);

type AttemptResponse = {
  attemptId: string;
  outcome: AttendanceScanOutcome;
  attendanceId: string | null;
  attendee: {
    fullName: string;
    studentNumber: string;
    memberId: string | null;
    section: string | null;
  } | null;
  idempotentReplay: boolean;
};

async function responseFromAttempt(
  attempt: {
    id: string;
    eventId: string;
    outcome: AttendanceScanOutcome;
    attendanceId: string | null;
    rosterEntryId: string | null;
  },
  replay = false,
): Promise<AttemptResponse> {
  const attendee = attempt.rosterEntryId
    ? await prisma.attendanceEventRoster.findUnique({
        where: { id: attempt.rosterEntryId },
        select: {
          fullName: true,
          studentNumber: true,
          memberId: true,
          section: true,
        },
      })
    : null;
  return {
    attemptId: attempt.id,
    outcome: attempt.outcome,
    attendanceId: attempt.attendanceId,
    attendee,
    idempotentReplay: replay,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  let submittedClientScanId: string | null = null;
  try {
    const authorization = await authorizeAttendanceOperator();
    if (authorization.response) return authorization.response;
    const { eventId } = await params;

    const parsedBody = scanSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: parsedBody.error.issues[0]?.message || "Invalid scan request",
        },
        { status: 400 },
      );
    }

    submittedClientScanId = parsedBody.data.clientScanId;
    const existingAttempt = await prisma.attendanceScanAttempt.findUnique({
      where: {
        eventId_clientScanId: {
          eventId,
          clientScanId: parsedBody.data.clientScanId,
        },
      },
    });
    if (existingAttempt) {
      return NextResponse.json(
        await responseFromAttempt(existingAttempt, true),
      );
    }

    let parsedCredential: ReturnType<typeof parseAttendanceCredential> = null;
    let manualStudentNumber: string | null = null;
    try {
      if (parsedBody.data.mode === "QR") {
        parsedCredential = parseAttendanceCredential(
          parsedBody.data.credential,
        );
      } else {
        manualStudentNumber = normalizeStudentNumber(
          parsedBody.data.studentNumber,
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Credential is invalid",
        },
        { status: 422 },
      );
    }

    const scanMethod =
      parsedBody.data.mode === "MANUAL"
        ? AttendanceMethod.MANUAL
        : (parsedCredential?.method ?? AttendanceMethod.QR);

    const attempt = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "AttendanceEvent" WHERE "id" = ${eventId} FOR SHARE`;
      const event = await tx.attendanceEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) throw new Error("EVENT_NOT_FOUND");

      const attemptedAt = new Date();
      const attemptBase = {
        eventId,
        clientScanId: parsedBody.data.clientScanId,
        operatorId: authorization.operator.id,
        method: scanMethod,
        attemptedAt,
      };
      if (
        event.status !== AttendanceEventStatus.OPEN ||
        attemptedAt < event.checkInOpensAt ||
        attemptedAt > event.checkInClosesAt
      ) {
        return tx.attendanceScanAttempt.create({
          data: {
            ...attemptBase,
            outcome: AttendanceScanOutcome.OUTSIDE_WINDOW,
          },
        });
      }

      if (parsedBody.data.mode === "QR" && !parsedCredential) {
        return tx.attendanceScanAttempt.create({
          data: { ...attemptBase, outcome: AttendanceScanOutcome.UNKNOWN },
        });
      }

      const rosterWhere = {
        eventId,
        ...(parsedBody.data.mode === "MANUAL"
          ? { studentNumber: manualStudentNumber! }
          : parsedCredential?.method === AttendanceMethod.CSS_ID_QR
            ? { memberId: parsedCredential.memberId }
            : { studentNumber: parsedCredential!.studentNumber }),
      };
      let rosterEntry = await tx.attendanceEventRoster.findFirst({
        where: rosterWhere,
      });

      if (!rosterEntry) {
        // People approved or imported after the snapshot are added on first scan.
        const studentNumber =
          manualStudentNumber ??
          (await credentialStudentNumber(tx, parsedCredential!));
        if (
          studentNumber &&
          (await addEligibleAttendee(tx, event, studentNumber))
        ) {
          rosterEntry = await tx.attendanceEventRoster.findFirst({
            where: rosterWhere,
          });
          if (rosterEntry) {
            await addAttendanceAudit(
              tx,
              authorization.operator.id,
              "ATTENDANCE_ROSTER_AUTO_ADDED",
              "attendance_event",
              eventId,
              { rosterEntryId: rosterEntry.id, studentNumber },
            );
          }
        }
      }

      if (!rosterEntry) {
        const knownPerson = await isKnownCredential(
          tx,
          parsedCredential,
          manualStudentNumber,
          event.recruitmentCycleId,
        );
        return tx.attendanceScanAttempt.create({
          data: {
            ...attemptBase,
            outcome: knownPerson
              ? AttendanceScanOutcome.INELIGIBLE
              : AttendanceScanOutcome.UNKNOWN,
          },
        });
      }
      if (!rosterEntry.isActive) {
        return tx.attendanceScanAttempt.create({
          data: {
            ...attemptBase,
            outcome: AttendanceScanOutcome.INACTIVE,
            rosterEntryId: rosterEntry.id,
          },
        });
      }

      await tx.$queryRaw`SELECT "id" FROM "AttendanceEventRoster" WHERE "id" = ${rosterEntry.id} FOR UPDATE`;
      const existingAttendance = await tx.eventAttendance.findUnique({
        where: { rosterEntryId: rosterEntry.id },
      });
      if (existingAttendance) {
        return tx.attendanceScanAttempt.create({
          data: {
            ...attemptBase,
            outcome: AttendanceScanOutcome.DUPLICATE,
            rosterEntryId: rosterEntry.id,
            attendanceId: existingAttendance.id,
          },
        });
      }

      const attendance = await tx.eventAttendance.create({
        data: {
          eventId,
          rosterEntryId: rosterEntry.id,
          checkedInById: authorization.operator.id,
          method: scanMethod,
          checkedInAt: attemptedAt,
        },
      });
      return tx.attendanceScanAttempt.create({
        data: {
          ...attemptBase,
          outcome: AttendanceScanOutcome.ACCEPTED,
          rosterEntryId: rosterEntry.id,
          attendanceId: attendance.id,
        },
      });
    });

    return NextResponse.json(await responseFromAttempt(attempt));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { eventId } = await params;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      submittedClientScanId
    ) {
      const replay = await prisma.attendanceScanAttempt.findUnique({
        where: {
          eventId_clientScanId: {
            eventId,
            clientScanId: submittedClientScanId,
          },
        },
      });
      if (replay) {
        return NextResponse.json(await responseFromAttempt(replay, true));
      }
    }
    if (error instanceof Error && error.message === "EVENT_NOT_FOUND") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    console.error(
      "Attendance scan failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The attendance scan could not be processed" },
      { status: 500 },
    );
  }
}

async function isKnownCredential(
  tx: Prisma.TransactionClient,
  credential: ReturnType<typeof parseAttendanceCredential>,
  manualStudentNumber: string | null,
  recruitmentCycleId: string,
) {
  if (credential?.method === AttendanceMethod.CSS_ID_QR) {
    return Boolean(
      await tx.membership.findUnique({
        where: { memberId: credential.memberId },
        select: { id: true },
      }),
    );
  }

  const studentNumber =
    manualStudentNumber ||
    (credential?.method === AttendanceMethod.UST_QR
      ? credential.studentNumber
      : null);
  if (!studentNumber) return false;
  const [user, guest] = await Promise.all([
    tx.user.findUnique({
      where: { studentNumber },
      select: { id: true },
    }),
    tx.attendanceGuest.findUnique({
      where: {
        recruitmentCycleId_studentNumber: {
          recruitmentCycleId,
          studentNumber,
        },
      },
      select: { id: true },
    }),
  ]);
  return Boolean(user || guest);
}
