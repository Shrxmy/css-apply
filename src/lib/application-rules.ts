import { Prisma } from "@prisma/client";
import { committeeRoles } from "@/data/committeeRoles";
import { roles } from "@/data/ebRoles";
import { getPositionTitle, getRoleId } from "@/lib/eb-mapping";
import { prisma } from "@/lib/prisma";

const BUSINESS_TIME_ZONE = "Asia/Manila";
const EA_AVAILABILITY_CONFIG_KEY = "available_executive_associate_roles";

export type ApplicationType = "member" | "committee" | "executive-associate";

type DbClient = Prisma.TransactionClient | typeof prisma;

type ActiveCycle = {
  id: string;
  schoolYear: string;
  applicationStart: Date;
  interviewStart: Date;
  interviewEnd: Date;
};

export class ApplicationRuleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApplicationRuleError";
  }
}

export function getApplicationRuleResponse(error: unknown) {
  if (!(error instanceof ApplicationRuleError)) return null;

  return {
    body: { error: error.message, code: error.code },
    status: error.status,
  };
}

function getBusinessDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getStoredDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getActiveCycle(db: DbClient = prisma): Promise<ActiveCycle> {
  const cycle = await db.recruitmentCycle.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      schoolYear: true,
      applicationStart: true,
      interviewStart: true,
      interviewEnd: true,
    },
  });

  if (!cycle) {
    throw new ApplicationRuleError(
      "There is no active recruitment cycle",
      409,
      "NO_ACTIVE_CYCLE",
    );
  }

  return cycle;
}

export async function getOpenApplicationCycle(
  db: DbClient = prisma,
): Promise<ActiveCycle> {
  const cycle = await getActiveCycle(db);
  const today = getBusinessDateKey();

  if (
    today < getStoredDateKey(cycle.applicationStart) ||
    today > getStoredDateKey(cycle.interviewEnd)
  ) {
    throw new ApplicationRuleError(
      "Applications are currently closed",
      409,
      "APPLICATIONS_CLOSED",
    );
  }

  return cycle;
}

export async function lockApplicantCycle(
  tx: Prisma.TransactionClient,
  applicantEmail: string,
  recruitmentCycleId: string,
) {
  const lockKey = `application:${recruitmentCycleId}:${applicantEmail.toLowerCase()}`;
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
  `);
}

export async function assertNoOtherApplication(
  tx: Prisma.TransactionClient,
  applicantEmail: string,
  recruitmentCycleId: string,
  requestedType: ApplicationType,
) {
  const applicationOwner = { email: applicantEmail };
  const [memberCount, committeeCount, executiveAssociateCount] =
    await Promise.all([
      requestedType === "member"
        ? 0
        : tx.memberApplication.count({
            where: { recruitmentCycleId, user: applicationOwner },
          }),
      requestedType === "committee"
        ? 0
        : tx.committeeApplication.count({
            where: { recruitmentCycleId, user: applicationOwner },
          }),
      requestedType === "executive-associate"
        ? 0
        : tx.executiveAssociateApplication.count({
            where: { recruitmentCycleId, user: applicationOwner },
          }),
    ]);

  if (memberCount + committeeCount + executiveAssociateCount > 0) {
    throw new ApplicationRuleError(
      "You already have a different application for this recruitment cycle",
      409,
      "APPLICATION_TYPE_CONFLICT",
    );
  }
}

export async function assertStudentNumberOwnership(
  tx: Prisma.TransactionClient,
  studentNumber: string,
  email: string,
) {
  const owner = await tx.user.findUnique({
    where: { studentNumber },
    select: { email: true },
  });

  if (owner && owner.email !== email) {
    throw new ApplicationRuleError(
      "This student number is already registered by another user",
      409,
      "STUDENT_NUMBER_IN_USE",
    );
  }
}

export function assertValidCommitteeChoices(first: string, second: string) {
  const validIds = new Set(committeeRoles.map(({ id }) => id));

  if (!validIds.has(first) || !validIds.has(second)) {
    throw new ApplicationRuleError(
      "Select valid committee choices",
      400,
      "INVALID_COMMITTEE",
    );
  }

  if (first === second) {
    throw new ApplicationRuleError(
      "Committee choices must be different",
      400,
      "DUPLICATE_COMMITTEE_CHOICE",
    );
  }
}

export async function assertAvailableExecutiveAssociateChoices(
  db: DbClient,
  ebRole: string,
  firstOptionEb: string,
  secondOptionEb: string,
) {
  const validIds = new Set(roles.map(({ id }) => id));

  if (
    ebRole !== firstOptionEb ||
    !validIds.has(firstOptionEb) ||
    !validIds.has(secondOptionEb)
  ) {
    throw new ApplicationRuleError(
      "Select valid Executive Associate role choices",
      400,
      "INVALID_EB_ROLE",
    );
  }

  if (firstOptionEb === secondOptionEb) {
    throw new ApplicationRuleError(
      "Executive Board choices must be different",
      400,
      "DUPLICATE_EB_ROLE_CHOICE",
    );
  }

  const config = await db.systemConfig.findUnique({
    where: { key: EA_AVAILABILITY_CONFIG_KEY },
    select: { value: true },
  });

  let availability: Record<string, boolean> = {};
  if (config) {
    try {
      availability = JSON.parse(config.value) as Record<string, boolean>;
    } catch {
      throw new ApplicationRuleError(
        "Executive Associate role configuration is invalid",
        503,
        "INVALID_ROLE_CONFIGURATION",
      );
    }
  }

  if (
    availability[firstOptionEb] === false ||
    availability[secondOptionEb] === false
  ) {
    throw new ApplicationRuleError(
      "One of the selected Executive Board roles is not accepting applications",
      409,
      "EB_ROLE_UNAVAILABLE",
    );
  }
}

export function isGoogleDriveUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname === "drive.google.com";
  } catch {
    return false;
  }
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function assertValidInterviewTime(
  cycle: ActiveCycle,
  day: string,
  start: string,
  end: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new ApplicationRuleError(
      "Select a valid interview date",
      400,
      "INVALID_INTERVIEW_DATE",
    );
  }

  const selectedDate = new Date(`${day}T00:00:00+08:00`);
  if (Number.isNaN(selectedDate.getTime()) || getBusinessDateKey(selectedDate) !== day) {
    throw new ApplicationRuleError(
      "Select a valid interview date",
      400,
      "INVALID_INTERVIEW_DATE",
    );
  }

  if (
    day < getStoredDateKey(cycle.interviewStart) ||
    day > getStoredDateKey(cycle.interviewEnd)
  ) {
    throw new ApplicationRuleError(
      "The selected date is outside the interview period",
      400,
      "INTERVIEW_DATE_OUT_OF_RANGE",
    );
  }

  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);
  if (
    startMinutes === null ||
    endMinutes === null ||
    startMinutes < 7 * 60 ||
    endMinutes > 21 * 60 ||
    startMinutes % 30 !== 0 ||
    endMinutes - startMinutes !== 30
  ) {
    throw new ApplicationRuleError(
      "Select a valid 30-minute interview slot",
      400,
      "INVALID_INTERVIEW_TIME",
    );
  }

  const selectedStart = new Date(`${day}T${start}:00+08:00`);
  if (selectedStart.getTime() <= Date.now()) {
    throw new ApplicationRuleError(
      "Past interview slots cannot be selected",
      400,
      "INTERVIEW_SLOT_IN_PAST",
    );
  }

  return { startMinutes, endMinutes };
}

interface InterviewSlotInput {
  day: string;
  start: string;
  end: string;
  interviewBy: string;
  applicationType: Exclude<ApplicationType, "member">;
  applicationId: string;
  expectedEbRole?: string;
  committeeId?: string;
}

export async function validateAndLockInterviewSlot(
  tx: Prisma.TransactionClient,
  cycle: ActiveCycle,
  input: InterviewSlotInput,
) {
  const { startMinutes, endMinutes } = assertValidInterviewTime(
    cycle,
    input.day,
    input.start,
    input.end,
  );
  const requestedRoleId = getRoleId(input.interviewBy);
  const canonicalPosition = getPositionTitle(requestedRoleId);

  const profile = await tx.eBProfile.findFirst({
    where: {
      recruitmentCycleId: cycle.id,
      isActive: true,
      position: { equals: canonicalPosition, mode: "insensitive" },
    },
    select: {
      position: true,
      committees: true,
      meetingLink: true,
    },
  });

  if (!profile) {
    throw new ApplicationRuleError(
      "The selected interviewer is unavailable for this recruitment cycle",
      409,
      "INTERVIEWER_UNAVAILABLE",
    );
  }

  if (input.committeeId && !profile.committees.includes(input.committeeId)) {
    throw new ApplicationRuleError(
      "The selected interviewer is not assigned to this committee",
      400,
      "INTERVIEWER_COMMITTEE_MISMATCH",
    );
  }

  if (
    input.expectedEbRole &&
    getRoleId(profile.position) !== getRoleId(input.expectedEbRole)
  ) {
    throw new ApplicationRuleError(
      "The selected interviewer does not match the applied Executive Board role",
      400,
      "INTERVIEWER_ROLE_MISMATCH",
    );
  }

  const slotLockKey = `interview:${cycle.id}:${profile.position.toLowerCase()}:${input.day}:${input.start}:${input.end}`;
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${slotLockKey}))
  `);

  const unavailableBlocks = await tx.availableEBInterviewTime.findMany({
    where: {
      eb: { equals: profile.position, mode: "insensitive" },
      day: input.day,
      maxSlots: 0,
    },
    select: { timeStart: true, timeEnd: true },
  });
  const isUnavailable = unavailableBlocks.some((block) => {
    const unavailableStart = parseTime(block.timeStart);
    const unavailableEnd = parseTime(block.timeEnd);
    return (
      unavailableStart !== null &&
      unavailableEnd !== null &&
      startMinutes < unavailableEnd &&
      endMinutes > unavailableStart
    );
  });

  if (isUnavailable) {
    throw new ApplicationRuleError(
      "The selected interviewer is unavailable during this time slot",
      409,
      "INTERVIEW_SLOT_UNAVAILABLE",
    );
  }

  const interviewerValues = Array.from(
    new Set([profile.position, getRoleId(profile.position), input.interviewBy]),
  );
  const interviewerFilter = {
    OR: interviewerValues.map((value) => ({
      interviewBy: { equals: value, mode: Prisma.QueryMode.insensitive },
    })),
  };
  const timeFilter = {
    interviewSlotDay: input.day,
    interviewSlotTimeStart: { lt: input.end },
    interviewSlotTimeEnd: { gt: input.start },
  };

  const [committeeConflicts, executiveAssociateConflicts] = await Promise.all([
    tx.committeeApplication.count({
      where: {
        recruitmentCycleId: cycle.id,
        ...timeFilter,
        ...interviewerFilter,
        ...(input.applicationType === "committee"
          ? { id: { not: input.applicationId } }
          : {}),
      },
    }),
    tx.executiveAssociateApplication.count({
      where: {
        recruitmentCycleId: cycle.id,
        ...timeFilter,
        ...interviewerFilter,
        ...(input.applicationType === "executive-associate"
          ? { id: { not: input.applicationId } }
          : {}),
      },
    }),
  ]);

  if (committeeConflicts + executiveAssociateConflicts > 0) {
    throw new ApplicationRuleError(
      "This time slot is no longer available. Please select another time slot.",
      409,
      "INTERVIEW_SLOT_CONFLICT",
    );
  }

  return profile;
}
