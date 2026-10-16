import { AttendanceMethod, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addAttendanceAudit,
  buildAttendanceRosterRows,
  credentialStudentNumber,
  parseAttendanceCredential,
} from "@/lib/attendance";
import { authorizeAttendanceOperator } from "@/lib/attendance-auth";
import { prisma } from "@/lib/prisma";

const testCredentialSchema = z.object({
  // Omitted = identity-only test that needs no attendance event.
  eventId: z.string().min(1).optional(),
  credential: z.string().min(1).max(2048),
});

type CredentialType = "CSS_ID_QR" | "UST_QR" | "UNKNOWN";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAttendanceOperator();
    if (authorization.response) return authorization.response;
    const parsedBody = testCredentialSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return privateJson(
        { error: parsedBody.error.issues[0]?.message || "Invalid QR test" },
        400,
      );
    }

    const recentTests = await prisma.attendanceAuditLog.count({
      where: {
        actorId: authorization.operator.id,
        action: "ATTENDANCE_CREDENTIAL_TESTED",
        occurredAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentTests >= 60) {
      return privateJson(
        { error: "QR testing is temporarily limited. Try again in a minute." },
        429,
      );
    }

    const event = parsedBody.data.eventId
      ? await prisma.attendanceEvent.findUnique({
          where: { id: parsedBody.data.eventId },
          select: {
            id: true,
            title: true,
            status: true,
            recruitmentCycleId: true,
            eligibleGroups: true,
            recruitmentCycle: { select: { schoolYear: true } },
          },
        })
      : null;
    if (parsedBody.data.eventId && !event) {
      return privateJson({ error: "Event not found" }, 404);
    }
    const eventId = event?.id ?? null;

    let credential: ReturnType<typeof parseAttendanceCredential>;
    try {
      credential = parseAttendanceCredential(parsedBody.data.credential);
    } catch (error) {
      await recordCredentialTest(
        authorization.operator.id,
        eventId,
        "UNKNOWN",
        false,
        "INVALID_CONTENT",
      );
      return privateJson({
        recognized: false,
        credentialType: "UNKNOWN",
        event: event ? eventSummary(event) : null,
        attendee: null,
        message:
          error instanceof Error ? error.message : "The QR content is invalid.",
      });
    }
    if (!credential) {
      await recordCredentialTest(
        authorization.operator.id,
        eventId,
        "UNKNOWN",
        false,
        "UNSUPPORTED_FORMAT",
      );
      return privateJson({
        recognized: false,
        credentialType: "UNKNOWN",
        event: event ? eventSummary(event) : null,
        attendee: null,
        message:
          "This is not a supported CSS digital ID or UST student QR format.",
      });
    }

    const credentialType: CredentialType =
      credential.method === AttendanceMethod.CSS_ID_QR ? "CSS_ID_QR" : "UST_QR";
    if (!event) {
      const identity = await findCredentialOwner(credential);
      // Member IDs have no fixed format, so an unmatched value is just unknown.
      const reportedType =
        identity || credentialType === "UST_QR" ? credentialType : "UNKNOWN";
      await recordCredentialTest(
        authorization.operator.id,
        null,
        reportedType,
        Boolean(identity),
        identity ? "IDENTITY_MATCH" : "IDENTITY_NOT_FOUND",
      );
      return privateJson({
        recognized: Boolean(identity),
        credentialType: reportedType,
        event: null,
        attendee: identity,
        message: identity
          ? "The QR works and belongs to the person below. No event roster was checked and no attendance was recorded."
          : reportedType === "UNKNOWN"
            ? "No CSS member has this member ID in the database."
            : "The UST QR format is valid, but this student number is not in CSSApply or any imported roster.",
      });
    }
    const rosterEntry = await prisma.attendanceEventRoster.findFirst({
      where: {
        eventId: event.id,
        ...(credential.method === AttendanceMethod.CSS_ID_QR
          ? { memberId: credential.memberId }
          : { studentNumber: credential.studentNumber }),
      },
      select: {
        fullName: true,
        studentNumber: true,
        memberId: true,
        section: true,
        source: true,
        affiliationGroups: true,
        isActive: true,
        attendance: { select: { checkedInAt: true } },
      },
    });
    if (!rosterEntry) {
      // Dry run of the scan-time addition for people approved after the snapshot.
      const studentNumber = await credentialStudentNumber(prisma, credential);
      const [eligibleRow] = studentNumber
        ? await buildAttendanceRosterRows(
            prisma,
            event.recruitmentCycleId,
            event.eligibleGroups,
            studentNumber,
          )
        : [];
      const matchesCredential =
        eligibleRow &&
        (credential.method === AttendanceMethod.UST_QR ||
          eligibleRow.memberId === credential.memberId);
      if (eligibleRow && matchesCredential) {
        await recordCredentialTest(
          authorization.operator.id,
          eventId,
          credentialType,
          true,
          "ELIGIBLE_NOT_YET_ON_ROSTER",
        );
        return privateJson({
          recognized: true,
          credentialType,
          event: eventSummary(event),
          attendee: attendeeSummary(
            eligibleRow,
            event.recruitmentCycle.schoolYear,
          ),
          message:
            "The QR works and this person is eligible. They are not on the roster snapshot yet and will be added automatically when scanned at check-in. No attendance was recorded.",
        });
      }
      const unknownMemberId =
        credential.method === AttendanceMethod.CSS_ID_QR && !studentNumber;
      await recordCredentialTest(
        authorization.operator.id,
        eventId,
        unknownMemberId ? "UNKNOWN" : credentialType,
        false,
        unknownMemberId ? "MEMBER_ID_NOT_FOUND" : "NOT_ON_EVENT_ROSTER",
      );
      return privateJson({
        recognized: false,
        credentialType: unknownMemberId ? "UNKNOWN" : credentialType,
        event: eventSummary(event),
        attendee: null,
        message: unknownMemberId
          ? "No CSS member has this member ID in the database."
          : `The QR does not match anyone eligible for the “${event.title}” roster.`,
      });
    }
    if (!rosterEntry.isActive) {
      await recordCredentialTest(
        authorization.operator.id,
        eventId,
        credentialType,
        false,
        "INACTIVE_ROSTER_ENTRY",
      );
      return privateJson({
        recognized: false,
        credentialType,
        event: eventSummary(event),
        attendee: attendeeSummary(
          rosterEntry,
          event.recruitmentCycle.schoolYear,
        ),
        message:
          "The QR matches this event roster, but the attendee is inactive.",
      });
    }

    await recordCredentialTest(
      authorization.operator.id,
      event.id,
      credentialType,
      true,
      rosterEntry.attendance ? "ALREADY_CHECKED_IN" : "ROSTER_MATCH",
    );
    return privateJson({
      recognized: true,
      credentialType,
      event: eventSummary(event),
      attendee: attendeeSummary(rosterEntry, event.recruitmentCycle.schoolYear),
      alreadyCheckedIn: Boolean(rosterEntry.attendance),
      message: rosterEntry.attendance
        ? "The QR works and matches this event roster, but this attendee is already checked in. The test did not alter their attendance."
        : "The QR works and matches an active attendee on this event roster. No attendance was recorded.",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return privateJson({ error: "Invalid JSON body" }, 400);
    }
    console.error(
      "Test attendance credential failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return privateJson({ error: "The QR credential could not be tested" }, 500);
  }
}

async function findCredentialOwner(
  credential: NonNullable<ReturnType<typeof parseAttendanceCredential>>,
) {
  if (credential.method === AttendanceMethod.CSS_ID_QR) {
    const membership = await prisma.membership.findUnique({
      where: { memberId: credential.memberId },
      select: {
        memberId: true,
        recruitmentCycle: { select: { schoolYear: true } },
        user: { select: { name: true, studentNumber: true, section: true } },
      },
    });
    if (!membership) return null;
    return {
      fullName: membership.user.name,
      studentNumber: membership.user.studentNumber ?? "",
      memberId: membership.memberId,
      section: membership.user.section,
      source: "CSSAPPLY",
      affiliationGroups: [],
      schoolYear: membership.recruitmentCycle.schoolYear,
    };
  }

  const [user, guest] = await Promise.all([
    prisma.user.findUnique({
      where: { studentNumber: credential.studentNumber },
      select: {
        name: true,
        studentNumber: true,
        section: true,
        memberships: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            memberId: true,
            recruitmentCycle: { select: { schoolYear: true } },
          },
        },
      },
    }),
    prisma.attendanceGuest.findFirst({
      where: { studentNumber: credential.studentNumber },
      orderBy: { createdAt: "desc" },
      select: {
        fullName: true,
        section: true,
        recruitmentCycle: { select: { schoolYear: true } },
      },
    }),
  ]);
  if (user) {
    const membership = user.memberships[0];
    return {
      fullName: user.name,
      studentNumber: credential.studentNumber,
      memberId: membership?.memberId ?? null,
      section: user.section,
      source: "CSSAPPLY",
      affiliationGroups: [],
      schoolYear: membership?.recruitmentCycle.schoolYear ?? null,
    };
  }
  if (!guest) return null;
  return {
    fullName: guest.fullName,
    studentNumber: credential.studentNumber,
    memberId: null,
    section: guest.section,
    source: "IMPORTED",
    affiliationGroups: [],
    schoolYear: guest.recruitmentCycle.schoolYear,
  };
}

function eventSummary(event: {
  title: string;
  status: string;
  recruitmentCycle: { schoolYear: string };
}) {
  return {
    title: event.title,
    status: event.status,
    schoolYear: event.recruitmentCycle.schoolYear,
  };
}

function attendeeSummary(
  entry: {
    fullName: string;
    studentNumber: string;
    memberId: string | null;
    section: string | null;
    source: string;
    affiliationGroups: string[];
  },
  schoolYear: string,
) {
  return {
    fullName: entry.fullName,
    studentNumber: entry.studentNumber,
    memberId: entry.memberId,
    section: entry.section,
    source: entry.source,
    affiliationGroups: entry.affiliationGroups,
    schoolYear,
  };
}

async function recordCredentialTest(
  actorId: string,
  eventId: string | null,
  credentialType: CredentialType,
  recognized: boolean,
  outcome: string,
) {
  await prisma.$transaction((tx) =>
    addAttendanceAudit(
      tx,
      actorId,
      "ATTENDANCE_CREDENTIAL_TESTED",
      eventId ? "attendance_event" : "attendance_credential",
      eventId,
      {
        credentialType,
        recognized,
        outcome,
      } satisfies Prisma.InputJsonValue,
    ),
  );
}
