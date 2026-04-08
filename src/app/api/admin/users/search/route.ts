import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// GET search users across all pages
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has super admin access
    const userRole = session.user.role;
    const hasSuperAdminAccess = userRole === "super_admin";

    if (!hasSuperAdminAccess) {
      return NextResponse.json(
        { error: "Forbidden - Super Admin access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { error: "Missing query parameter" },
        { status: 400 },
      );
    }

    // Search users by name, email, or student number
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            studentNumber: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      include: {
        ebProfile: {
          select: {
            id: true,
            position: true,
            committees: true,
            meetingLink: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        memberApplication: {
          select: {
            id: true,
            hasAccepted: true,
            paymentProof: true,
            createdAt: true,
          },
        },
        eaApplication: {
          select: {
            id: true,
            hasAccepted: true,
            status: true,
            firstOptionEb: true,
            secondOptionEb: true,
            interviewSlotDay: true,
            interviewSlotTimeStart: true,
            interviewSlotTimeEnd: true,
            interviewBy: true,
            hasFinishedInterview: true,
            cv: true,
            supabaseFilePath: true,
            createdAt: true,
          },
        },
        committeeApplication: {
          select: {
            id: true,
            hasAccepted: true,
            status: true,
            firstOptionCommittee: true,
            secondOptionCommittee: true,
            interviewSlotDay: true,
            interviewSlotTimeStart: true,
            interviewSlotTimeEnd: true,
            interviewBy: true,
            hasFinishedInterview: true,
            cv: true,
            supabaseFilePath: true,
            portfolioLink: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get overall statistics
    const [totalUsers, totalEbMembers, totalAdmins, totalApplicants] =
      await Promise.all([
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
          prisma.eAApplication.count(),
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
      searchQuery: query,
      totalResults: users.length,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
