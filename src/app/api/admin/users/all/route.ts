export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    const isSuperAdmin =
      userRole === "super_admin" || userRole === "super-admin";

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Super admin access required" },
        { status: 403 },
      );
    }

    // Get pagination parameters from URL
    const { searchParams } = new URL(request.url);
    const page = Math.min(
      Math.max(parseInt(searchParams.get("page") || "1") || 1, 1),
      100_000,
    );
    // Super-admin overview requests up to 1000 rows at once.
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "10") || 10, 1),
      1000,
    );
    const skip = (page - 1) * limit;
    const role = searchParams.get("role") || "";
    const memberStatus = searchParams.get("memberStatus") || "";
    const position = searchParams.get("position") || "";
    const committee = searchParams.get("committee") || "";
    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const activeCycleId = activeCycle?.id ?? "__no_active_cycle__";

    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (memberStatus === "issued") {
      where.memberships = { some: { recruitmentCycleId: activeCycleId } };
    } else if (memberStatus === "not-issued") {
      where.memberships = { none: { recruitmentCycleId: activeCycleId } };
    }
    if (position || committee) {
      where.ebProfile = {
        is: {
          ...(position ? { position } : {}),
          ...(committee ? { committees: { has: committee } } : {}),
        },
      };
    }

    // Fetch users with their EB profiles (paginated)
    const usersPromise = prisma.user.findMany({
      select: {
        id: true,
        email: true,
        image: true,
        name: true,
        role: true,
        studentNumber: true,
        section: true,
        createdAt: true,
        ebProfile: {
          select: {
            position: true,
            committees: true,
            isActive: true,
            meetingLink: true,
          },
        },
        memberships: {
          where: { recruitmentCycleId: activeCycleId },
          select: { memberId: true },
          take: 1,
        },
      },
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: skip,
      take: limit,
    });

    // Run the page query, its count and the dashboard stats in parallel.
    const [
      users,
      totalCount,
      totalUsers,
      totalEbMembers,
      totalAdmins,
      totalApplicants,
    ] = await Promise.all([
      usersPromise,
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({
        where: {
          ebProfile: {
            isNot: null,
          },
        },
      }),
      prisma.user.count({
        where: {
          role: {
            in: ["admin", "super_admin"],
          },
        },
      }),
      // Count total applicants across all application types
      Promise.all([
        prisma.memberApplication.count(),
        prisma.executiveAssociateApplication.count(),
        prisma.committeeApplication.count(),
      ]).then(
        ([memberCount, eaCount, committeeCount]) =>
          memberCount + eaCount + committeeCount,
      ),
    ]);

    return NextResponse.json({
      success: true,
      users: users,
      stats: {
        totalUsers,
        totalEbMembers,
        totalAdmins,
        totalApplicants,
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount: totalCount,
        limit: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
