import {
  AttendanceGroup,
  AttendanceMethod,
  AttendanceRosterSource,
  Prisma,
} from "@prisma/client";
import { acceptedDestination } from "@/lib/digital-id-role";

const DESTINATION_GROUPS = {
  member: AttendanceGroup.MEMBER,
  committee: AttendanceGroup.COMMITTEE_STAFF,
  ea: AttendanceGroup.EXECUTIVE_ASSOCIATE,
} as const;

export const ATTENDANCE_GROUPS = [
  AttendanceGroup.MEMBER,
  AttendanceGroup.COMMITTEE_STAFF,
  AttendanceGroup.EXECUTIVE_ASSOCIATE,
  AttendanceGroup.IMPORTED_STUDENT,
] as const;

export const ATTENDANCE_GROUP_LABELS: Record<AttendanceGroup, string> = {
  MEMBER: "Members",
  COMMITTEE_STAFF: "Committee Staff",
  EXECUTIVE_ASSOCIATE: "Executive Associates",
  IMPORTED_STUDENT: "Imported CS students",
};

export function isAttendanceGroup(value: string): value is AttendanceGroup {
  return ATTENDANCE_GROUPS.includes(value as AttendanceGroup);
}

export function normalizeStudentNumber(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/^'/, "");
  const withoutExcelDecimal = /^\d{10}\.0$/.test(normalized)
    ? normalized.slice(0, -2)
    : normalized;
  const compact = /^[\d\s-]+$/.test(withoutExcelDecimal)
    ? withoutExcelDecimal.replace(/[\s-]/g, "")
    : withoutExcelDecimal;

  if (!/^\d{10}$/.test(compact)) {
    throw new Error("Student number must contain exactly 10 digits.");
  }
  return compact;
}

export function normalizeAttendanceName(value: string) {
  let normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 200) {
    throw new Error("Name must contain between 1 and 200 characters.");
  }
  if (/\p{Cc}/u.test(normalized) || /\d/u.test(normalized)) {
    throw new Error("Name contains unsupported characters.");
  }
  if (
    normalized === normalized.toUpperCase() ||
    normalized === normalized.toLowerCase()
  ) {
    const romanSuffixes = new Set(["II", "III", "IV", "V", "VI"]);
    normalized = normalized
      .toLocaleLowerCase("en-PH")
      .replace(/(^|[\s'-])\p{L}/gu, (match) => match.toLocaleUpperCase("en-PH"))
      .split(" ")
      .map((word) =>
        romanSuffixes.has(word.toUpperCase()) ? word.toUpperCase() : word,
      )
      .join(" ");
  }
  return normalized;
}

export function normalizeAttendanceSection(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!normalized || normalized.length > 100 || /\p{Cc}/u.test(normalized)) {
    throw new Error("Section must contain between 1 and 100 valid characters.");
  }
  return normalized;
}

type ParsedCredential =
  | { method: typeof AttendanceMethod.CSS_ID_QR; memberId: string }
  | { method: typeof AttendanceMethod.UST_QR; studentNumber: string }
  | null;

export function parseAttendanceCredential(rawValue: string): ParsedCredential {
  const normalized = rawValue.trim();
  if (!normalized || normalized.length > 2048 || /\p{Cc}/u.test(normalized)) {
    throw new Error(
      "Credential must contain between 1 and 2048 valid characters.",
    );
  }

  const ustQr = /^(\d{10})-\d$/.exec(normalized);
  if (ustQr?.[1]) {
    return {
      method: AttendanceMethod.UST_QR,
      studentNumber: ustQr[1],
    };
  }

  // Digital ID QRs carry the plain member ID. No format is assumed here: any
  // value that fits the memberId column is looked up in the database.
  if (normalized.length <= 32 && !/\s/u.test(normalized)) {
    return {
      method: AttendanceMethod.CSS_ID_QR,
      memberId: normalized.toUpperCase(),
    };
  }

  return null;
}

type MaterializedRosterRow = {
  userId: string | null;
  guestId: string | null;
  studentNumber: string;
  memberId: string | null;
  fullName: string;
  section: string | null;
  source: AttendanceRosterSource;
  affiliationGroups: AttendanceGroup[];
};

function intersects(groups: AttendanceGroup[], eligible: Set<AttendanceGroup>) {
  return groups.some((group) => eligible.has(group));
}

const redirectableSelect = {
  id: true,
  hasAccepted: true,
  paymentStatus: true,
  redirection: true,
} as const;

export async function buildAttendanceRosterRows(
  tx: Prisma.TransactionClient,
  recruitmentCycleId: string,
  eligibleGroups: AttendanceGroup[],
  // Limits the build to one person, for scan-time roster additions.
  onlyStudentNumber?: string,
) {
  const eligible = new Set(eligibleGroups);
  const roster = new Map<string, MaterializedRosterRow>();

  if (eligible.has(AttendanceGroup.IMPORTED_STUDENT)) {
    const guests = await tx.attendanceGuest.findMany({
      where: {
        recruitmentCycleId,
        isActive: true,
        ...(onlyStudentNumber ? { studentNumber: onlyStudentNumber } : {}),
      },
      select: {
        id: true,
        studentNumber: true,
        fullName: true,
        section: true,
      },
    });
    for (const guest of guests) {
      roster.set(guest.studentNumber, {
        userId: null,
        guestId: guest.id,
        studentNumber: guest.studentNumber,
        memberId: null,
        fullName: guest.fullName,
        section: guest.section,
        source: AttendanceRosterSource.IMPORTED,
        affiliationGroups: [AttendanceGroup.IMPORTED_STUDENT],
      });
    }
  }

  const approved = {
    recruitmentCycleId,
    hasAccepted: true,
    paymentStatus: "approved",
  };
  const approvedStaff = {
    ...approved,
    status: { in: ["passed", "redirected"] },
  };
  // Start from approved applications, not Membership rows: older approved
  // members only get a member ID once they open their digital ID.
  const users = await tx.user.findMany({
    where: {
      studentNumber: onlyStudentNumber ?? { not: null },
      OR: [
        { memberApplications: { some: approved } },
        { committeeApplications: { some: approvedStaff } },
        { executiveAssociateApplications: { some: approvedStaff } },
        {
          role: { in: ["admin", "super_admin"] },
          ebProfile: {
            is: {
              isActive: true,
              OR: [{ recruitmentCycleId }, { recruitmentCycleId: null }],
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      studentNumber: true,
      section: true,
      role: true,
      ebProfile: { select: { isActive: true, recruitmentCycleId: true } },
      memberships: {
        where: { recruitmentCycleId },
        select: { memberId: true },
        take: 1,
      },
      memberApplications: { where: approved, select: { id: true }, take: 1 },
      committeeApplications: {
        where: approvedStaff,
        select: redirectableSelect,
        take: 1,
      },
      executiveAssociateApplications: {
        where: approvedStaff,
        select: redirectableSelect,
        take: 1,
      },
    },
  });

  for (const user of users) {
    const studentNumber = user.studentNumber;
    if (!studentNumber) continue;

    const groups: AttendanceGroup[] = [];
    // Active EB officers get their digital ID as members without applying.
    const isExecutiveBoard =
      (user.role === "admin" || user.role === "super_admin") &&
      user.ebProfile?.isActive === true &&
      (user.ebProfile.recruitmentCycleId ?? recruitmentCycleId) ===
        recruitmentCycleId;
    if (user.memberApplications.length > 0 || isExecutiveBoard) {
      groups.push(AttendanceGroup.MEMBER);
    }
    // Same accepted-redirection resolution as the digital ID role.
    for (const application of user.committeeApplications) {
      const destination = acceptedDestination(application);
      groups.push(
        destination
          ? DESTINATION_GROUPS[destination.applicationType]
          : AttendanceGroup.COMMITTEE_STAFF,
      );
    }
    for (const application of user.executiveAssociateApplications) {
      const destination = acceptedDestination(application);
      groups.push(
        destination
          ? DESTINATION_GROUPS[destination.applicationType]
          : AttendanceGroup.EXECUTIVE_ASSOCIATE,
      );
    }
    if (!intersects(groups, eligible)) continue;

    const imported = roster.get(studentNumber);
    roster.set(studentNumber, {
      userId: user.id,
      guestId: imported?.guestId ?? null,
      studentNumber,
      memberId: user.memberships[0]?.memberId ?? null,
      fullName: user.name,
      section: user.section,
      source: AttendanceRosterSource.CSSAPPLY,
      affiliationGroups: [
        ...new Set([
          ...groups.filter((group) => eligible.has(group)),
          ...(imported?.affiliationGroups ?? []),
        ]),
      ],
    });
  }

  return [...roster.values()];
}

async function insertRosterRows(
  tx: Prisma.TransactionClient,
  eventId: string,
  rows: MaterializedRosterRow[],
  skipDuplicates: boolean,
) {
  let inserted = 0;
  for (let index = 0; index < rows.length; index += 500) {
    const result = await tx.attendanceEventRoster.createMany({
      data: rows.slice(index, index + 500).map((row) => ({ eventId, ...row })),
      skipDuplicates,
    });
    inserted += result.count;
  }
  return inserted;
}

/** Replaces the whole snapshot. Only safe before any check-ins exist (draft). */
export async function materializeAttendanceRoster(
  tx: Prisma.TransactionClient,
  eventId: string,
  recruitmentCycleId: string,
  eligibleGroups: AttendanceGroup[],
) {
  const rows = await buildAttendanceRosterRows(
    tx,
    recruitmentCycleId,
    eligibleGroups,
  );
  await tx.attendanceEventRoster.deleteMany({ where: { eventId } });
  await insertRosterRows(tx, eventId, rows, false);
  return rows.length;
}

/**
 * Add-only sync for open/closed events: never removes rows (check-ins
 * reference them), only adds newly eligible people and links imported
 * guests who have since received a member ID.
 */
export async function syncAttendanceRoster(
  tx: Prisma.TransactionClient,
  eventId: string,
  recruitmentCycleId: string,
  eligibleGroups: AttendanceGroup[],
  onlyStudentNumber?: string,
) {
  const rows = await buildAttendanceRosterRows(
    tx,
    recruitmentCycleId,
    eligibleGroups,
    onlyStudentNumber,
  );
  const memberIds = rows.flatMap((row) => (row.memberId ? [row.memberId] : []));
  const existing = await tx.attendanceEventRoster.findMany({
    // Narrowed syncs still load rows holding the same member IDs, so the
    // per-event memberId uniqueness check below stays correct.
    where: onlyStudentNumber
      ? {
          eventId,
          OR: [
            { studentNumber: onlyStudentNumber },
            { memberId: { in: memberIds } },
          ],
        }
      : { eventId },
    select: { id: true, studentNumber: true, memberId: true, userId: true },
  });
  const existingByNumber = new Map(
    existing.map((entry) => [entry.studentNumber, entry]),
  );
  const takenMemberIds = new Set(
    existing.flatMap((entry) => (entry.memberId ? [entry.memberId] : [])),
  );

  let linked = 0;
  for (const row of rows) {
    const entry = existingByNumber.get(row.studentNumber);
    if (!entry || entry.memberId || !row.memberId) continue;
    if (takenMemberIds.has(row.memberId)) continue;
    await tx.attendanceEventRoster.update({
      where: { id: entry.id },
      data: {
        memberId: row.memberId,
        userId: entry.userId ?? row.userId,
      },
    });
    takenMemberIds.add(row.memberId);
    linked += 1;
  }

  const added = await insertRosterRows(
    tx,
    eventId,
    rows.filter((row) => !existingByNumber.has(row.studentNumber)),
    true,
  );
  return { added, linked, rosterCount: existing.length + added };
}

/** Student number behind a parsed credential; CSS IDs resolve via Membership. */
export async function credentialStudentNumber(
  tx: Prisma.TransactionClient,
  credential: NonNullable<ParsedCredential>,
) {
  if (credential.method === AttendanceMethod.UST_QR) {
    return credential.studentNumber;
  }
  const membership = await tx.membership.findUnique({
    where: { memberId: credential.memberId },
    select: { user: { select: { studentNumber: true } } },
  });
  return membership?.user.studentNumber ?? null;
}

/**
 * Adds one person who became eligible after the roster snapshot (approved or
 * imported later). Returns false when they are not eligible for the event.
 */
export async function addEligibleAttendee(
  tx: Prisma.TransactionClient,
  event: {
    id: string;
    recruitmentCycleId: string;
    eligibleGroups: AttendanceGroup[];
  },
  studentNumber: string,
) {
  const { added, linked } = await syncAttendanceRoster(
    tx,
    event.id,
    event.recruitmentCycleId,
    event.eligibleGroups,
    studentNumber,
  );
  return added + linked > 0;
}

export function addAttendanceAudit(
  tx: Prisma.TransactionClient,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Prisma.InputJsonValue,
) {
  return tx.attendanceAuditLog.create({
    data: { actorId, action, entityType, entityId, details },
  });
}

export function csvEscape(value: string | number | Date | null) {
  const text =
    value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
