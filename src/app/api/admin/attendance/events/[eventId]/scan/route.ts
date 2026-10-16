import {
  AttendanceEventStatus,
  AttendanceGroup,
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

type LockedEvent = {
  id: string;
  status: string;
  checkInOpensAt: Date;
  checkInClosesAt: Date;
  recruitmentCycleId: string;
  eligibleGroups: AttendanceGroup[];
};

type LockedRosterEntry = {
  id: string;
  fullName: string;
  studentNumber: string;
  memberId: string | null;
  section: string | null;
  isActive: boolean;
};

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
    const { eventId } = await params;
    const parsedBody = await request.json().then(
      (body: unknown) => scanSchema.safeParse(body),
      () => null,
    );
    const clientScanId = parsedBody?.success
      ? parsedBody.data.clientScanId
      : null;
    // Every database call is a network round trip, so independent reads run
    // together. Nothing is returned before authorization passes.
    const [authorization, existingAttempt] = await Promise.all([
      authorizeAttendanceOperator(),
      clientScanId
        ? prisma.attendanceScanAttempt.findUnique({
            where: { eventId_clientScanId: { eventId, clientScanId } },
          })
        : null,
    ]);
    if (authorization.response) return authorization.response;
    if (!parsedBody) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: parsedBody.error.issues[0]?.message || "Invalid scan request",
        },
        { status: 400 },
      );
    }

    submittedClientScanId = parsedBody.data.clientScanId;
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

    const outcome = await prisma.$transaction(async (tx) => {
      const [event] = await tx.$queryRaw<LockedEvent[]>`
        SELECT "id", "status"::text AS "status", "checkInOpensAt",
          "checkInClosesAt", "recruitmentCycleId",
          "eligibleGroups"::text[] AS "eligibleGroups"
        FROM "AttendanceEvent" WHERE "id" = ${eventId} FOR SHARE`;
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
        return {
          attempt: await tx.attendanceScanAttempt.create({
            data: {
              ...attemptBase,
              outcome: AttendanceScanOutcome.OUTSIDE_WINDOW,
            },
          }),
          attendee: null,
        };
      }

      if (parsedBody.data.mode === "QR" && !parsedCredential) {
        return {
          attempt: await tx.attendanceScanAttempt.create({
            data: { ...attemptBase, outcome: AttendanceScanOutcome.UNKNOWN },
          }),
          attendee: null,
        };
      }

      const memberId =
        parsedCredential?.method === AttendanceMethod.CSS_ID_QR
          ? parsedCredential.memberId
          : null;
      const lookupStudentNumber =
        manualStudentNumber ??
        (parsedCredential?.method === AttendanceMethod.UST_QR
          ? parsedCredential.studentNumber
          : null);
      // Row lock taken in the same statement, so scans of one attendee and
      // check-in undos serialize.
      const lockRosterEntry = async () => {
        const rows = memberId
          ? await tx.$queryRaw<LockedRosterEntry[]>`
              SELECT "id", "fullName", "studentNumber", "memberId", "section",
                "isActive"
              FROM "AttendanceEventRoster"
              WHERE "eventId" = ${eventId} AND "memberId" = ${memberId}
              FOR UPDATE`
          : await tx.$queryRaw<LockedRosterEntry[]>`
              SELECT "id", "fullName", "studentNumber", "memberId", "section",
                "isActive"
              FROM "AttendanceEventRoster"
              WHERE "eventId" = ${eventId}
                AND "studentNumber" = ${lookupStudentNumber}
              FOR UPDATE`;
        return rows[0] ?? null;
      };
      let rosterEntry = await lockRosterEntry();

      if (!rosterEntry) {
        // People approved or imported after the snapshot are added on first scan.
        const studentNumber =
          manualStudentNumber ??
          (await credentialStudentNumber(tx, parsedCredential!));
        if (
          studentNumber &&
          (await addEligibleAttendee(tx, event, studentNumber))
        ) {
          rosterEntry = await lockRosterEntry();
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
        return {
          attempt: await tx.attendanceScanAttempt.create({
            data: {
              ...attemptBase,
              outcome: knownPerson
                ? AttendanceScanOutcome.INELIGIBLE
                : AttendanceScanOutcome.UNKNOWN,
            },
          }),
          attendee: null,
        };
      }
      const attendee = {
        fullName: rosterEntry.fullName,
        studentNumber: rosterEntry.studentNumber,
        memberId: rosterEntry.memberId,
        section: rosterEntry.section,
      };
      if (!rosterEntry.isActive) {
        return {
          attempt: await tx.attendanceScanAttempt.create({
            data: {
              ...attemptBase,
              outcome: AttendanceScanOutcome.INACTIVE,
              rosterEntryId: rosterEntry.id,
            },
          }),
          attendee,
        };
      }

      // Read after the row lock, so a check-in committed meanwhile is seen.
      const existingAttendance = await tx.eventAttendance.findUnique({
        where: { rosterEntryId: rosterEntry.id },
        select: { id: true },
      });
      if (existingAttendance) {
        return {
          attempt: await tx.attendanceScanAttempt.create({
            data: {
              ...attemptBase,
              outcome: AttendanceScanOutcome.DUPLICATE,
              rosterEntryId: rosterEntry.id,
              attendanceId: existingAttendance.id,
            },
          }),
          attendee,
        };
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
      return {
        attempt: await tx.attendanceScanAttempt.create({
          data: {
            ...attemptBase,
            outcome: AttendanceScanOutcome.ACCEPTED,
            rosterEntryId: rosterEntry.id,
            attendanceId: attendance.id,
          },
        }),
        attendee,
      };
    });

    // The attendee comes from the locked roster row; no extra lookup needed.
    return NextResponse.json({
      attemptId: outcome.attempt.id,
      outcome: outcome.attempt.outcome,
      attendanceId: outcome.attempt.attendanceId,
      attendee: outcome.attendee,
      idempotentReplay: false,
    } satisfies AttemptResponse);
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
