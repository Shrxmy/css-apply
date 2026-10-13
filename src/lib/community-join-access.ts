import "server-only";

import { prisma } from "@/lib/prisma";

export async function getAcceptedCommunityApplicantContext(userId: string) {
  const [cycle, user] = await Promise.all([
    prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, studentNumber: true },
    }),
  ]);

  if (!cycle || !user?.studentNumber) return null;

  const applicationWhere = {
    studentNumber: user.studentNumber,
    recruitmentCycleId: cycle.id,
    hasAccepted: true,
  };
  const [members, committee, executiveAssociates] = await Promise.all([
    prisma.memberApplication.findMany({
      where: applicationWhere,
      select: { paymentStatus: true },
    }),
    prisma.committeeApplication.findMany({
      where: { ...applicationWhere, redirection: null },
      select: { paymentStatus: true },
    }),
    prisma.executiveAssociateApplication.findMany({
      where: { ...applicationWhere, redirection: null },
      select: { paymentStatus: true },
    }),
  ]);

  const activeAcceptedApplications = [
    ...members,
    ...committee,
    ...executiveAssociates,
  ];
  if (activeAcceptedApplications.length === 0) return null;

  return {
    userId: user.id,
    cycleId: cycle.id,
    paymentApproved: activeAcceptedApplications.every(
      (application) => application.paymentStatus === "approved",
    ),
  };
}
