import { Prisma } from "@prisma/client";

const MEMBER_ID_PREFIX = "CSS";
const MEMBER_ID_SEQUENCE_WIDTH = 4;

function getSchoolYearCode(schoolYear: string) {
  const years = schoolYear.match(/\d{4}/g);

  if (years && years.length >= 2) {
    return `${years[0].slice(-2)}${years[1].slice(-2)}`;
  }

  return schoolYear.replace(/\D/g, "").slice(-4).padStart(4, "0");
}

function formatMemberId(schoolYear: string, sequence: number) {
  const sequenceCode = sequence
    .toString()
    .padStart(MEMBER_ID_SEQUENCE_WIDTH, "0");

  return `${MEMBER_ID_PREFIX}-${getSchoolYearCode(schoolYear)}-${sequenceCode}`;
}

export async function ensureCycleMemberId(
  tx: Prisma.TransactionClient,
  userId: string,
  recruitmentCycleId: string | null | undefined,
) {
  const cycle = recruitmentCycleId
    ? await tx.recruitmentCycle.findUnique({
        where: { id: recruitmentCycleId },
        select: { id: true, schoolYear: true },
      })
    : await tx.recruitmentCycle.findFirst({
        where: { isActive: true },
        select: { id: true, schoolYear: true },
      });

  if (!cycle) {
    throw new Error("Cannot generate member ID without a recruitment cycle");
  }

  const existingMembership = await tx.membership.findUnique({
    where: {
      userId_recruitmentCycleId: {
        userId,
        recruitmentCycleId: cycle.id,
      },
    },
    select: { memberId: true },
  });

  if (existingMembership) {
    return existingMembership.memberId;
  }

  await tx.membershipCounter.upsert({
    where: { recruitmentCycleId: cycle.id },
    update: { updatedAt: new Date() },
    create: { recruitmentCycleId: cycle.id },
  });

  const counter = await tx.membershipCounter.update({
    where: { recruitmentCycleId: cycle.id },
    data: { nextSequence: { increment: 1 } },
    select: { nextSequence: true },
  });

  const memberId = formatMemberId(cycle.schoolYear, counter.nextSequence);
  const membership = await tx.membership.create({
    data: {
      userId,
      recruitmentCycleId: cycle.id,
      memberId,
      memberSequence: counter.nextSequence,
    },
    select: { memberId: true },
  });

  return membership.memberId;
}

export function getDisplayMemberId(user: {
  id: string;
  memberships?: Array<{ memberId: string }> | null;
}) {
  return user.memberships?.[0]?.memberId ?? user.id.slice(-7).toUpperCase();
}
