import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { committeeRoles } from "@/data/committeeRoles";

const normalizeCommitteeId = (value: string): string => {
  const normalizedValue = value.toLowerCase().replace(/&/g, "and");
  const committee = committeeRoles.find(
    ({ id, title }) =>
      id.toLowerCase() === normalizedValue ||
      title.toLowerCase().replace(/&/g, "and") === normalizedValue,
  );

  return committee?.id ?? value;
};

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin access
    const userRole = session.user.role;
    const hasAdminAccess = userRole === "admin" || userRole === "super_admin";

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const isSuperAdmin = userRole === "super_admin";

    // Get active cycle
    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const activeCycleId = activeCycle?.id ?? "__no_active_cycle__";

    // Get EB profile of the logged in user to find their accessible committees
    let accessibleCommittees: Set<string> | null = null;
    if (!isSuperAdmin && session.user.dbId) {
      const ebProfile = await prisma.eBProfile.findFirst({
        where: { userId: session.user.dbId },
        select: { committees: true },
      });
      if (ebProfile) {
        accessibleCommittees = new Set(
          ebProfile.committees.map(normalizeCommitteeId),
        );
      }
    }

    // 1. Pending Members (hasAccepted: false)
    const memberCount = await prisma.memberApplication.count({
      where: {
        recruitmentCycleId: activeCycleId,
        hasAccepted: false,
      },
    });

    // 2. Pending EAs (hasAccepted: false, status: null/pending/evaluating)
    const eaCount = await prisma.executiveAssociateApplication.count({
      where: {
        recruitmentCycleId: activeCycleId,
        hasAccepted: false,
        OR: [{ status: null }, { status: "pending" }, { status: "evaluating" }],
      },
    });

    // 3. Pending Committees (hasAccepted: false, status: null/pending/evaluating, and filtered by EB access)
    const committeeConditions: Prisma.CommitteeApplicationWhereInput = {
      recruitmentCycleId: activeCycleId,
      hasAccepted: false,
    };

    if (accessibleCommittees) {
      const accessibleList = Array.from(accessibleCommittees);
      committeeConditions.AND = [
        {
          OR: [
            { status: null },
            { status: "pending" },
            { status: "evaluating" },
          ],
        },
        {
          OR: [
            { firstOptionCommittee: { in: accessibleList } },
            { redirection: { in: accessibleList } },
          ],
        },
      ];
    } else {
      committeeConditions.OR = [
        { status: null },
        { status: "pending" },
        { status: "evaluating" },
      ];
    }

    const committeeCount = await prisma.committeeApplication.count({
      where: committeeConditions,
    });

    return NextResponse.json({
      success: true,
      counts: {
        member: memberCount,
        ea: eaCount,
        committee: committeeCount,
        total: memberCount + eaCount + committeeCount,
      },
    });
  } catch (error) {
    console.error("Error getting application counts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
