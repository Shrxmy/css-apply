import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPositionTitle, getRoleId } from "@/lib/eb-mapping";
import { committeeRoles } from "@/data/committeeRoles";

const normalizeCommitteeId = (value: string) => {
  const normalizedValue = value.toLowerCase().replace(/&/g, "and");
  const committee = committeeRoles.find(
    ({ id, title }) =>
      id.toLowerCase() === normalizedValue ||
      title.toLowerCase().replace(/&/g, "and") === normalizedValue,
  );

  return committee?.id ?? value;
};

// GET search applications across all pages
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin access
    const userRole = session.user.role;
    const hasAdminAccess = userRole === "admin" || userRole === "super_admin";
    const isSuperAdmin = userRole === "super_admin";

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const position = searchParams.get("position");

    if (!query || !position) {
      return NextResponse.json(
        { error: "Missing query or position parameter" },
        { status: 400 },
      );
    }

    const applications: {
      committee: Array<{
        id: string;
        studentNumber: string;
        createdAt: Date;
        hasAccepted: boolean;
        firstOptionCommittee: string;
        secondOptionCommittee: string;
        portfolioLink: string | null;
        cv: string;
        supabaseFilePath: string | null;
        hasFinishedInterview: boolean;
        status: string | null;
        user: {
          id: string;
          name: string;
          email: string;
          studentNumber: string | null;
          section: string | null;
        };
        type: string;
        cvDownloadUrl: string | null;
        portfolioDownloadUrl: string | null;
        isAssigned: boolean;
      }>;
      ea: Array<{
        id: string;
        studentNumber: string;
        createdAt: Date;
        firstOptionEb: string;
        secondOptionEb: string;
        hasFinishedInterview: boolean;
        cv: string;
        supabaseFilePath: string | null;
        hasAccepted: boolean;
        status: string | null;
        user: {
          id: string;
          name: string;
          email: string;
          studentNumber: string | null;
          section: string | null;
        };
        type: string;
        cvDownloadUrl: string | null;
        isAssigned: boolean;
      }>;
      member: Array<{
        id: string;
        studentNumber: string;
        createdAt: Date;
        hasAccepted: boolean;
        paymentProof: string;
        user: {
          id: string;
          name: string;
          email: string;
          studentNumber: string | null;
          section: string | null;
        };
        type: string;
        isAssigned: boolean;
      }>;
    } = {
      committee: [],
      ea: [],
      member: [],
    };

    const positionTitle = getPositionTitle(position);
    const roleId = getRoleId(position);
    const assignmentValues = [position, positionTitle, roleId]
      .filter(Boolean)
      .map((value) => value.toLowerCase());

    const ebProfile = await prisma.eBProfile.findFirst({
      where: {
        OR: [
          { position: { equals: position, mode: "insensitive" } },
          { position: { equals: positionTitle, mode: "insensitive" } },
          { position: { equals: roleId, mode: "insensitive" } },
        ],
      },
      select: { committees: true },
    });
    const accessibleCommittees = new Set(
      ebProfile?.committees.map(normalizeCommitteeId) ?? [],
    );

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const activeCycleId = activeCycle?.id ?? "__no_active_cycle__";

    // Search committee applications
    const allCommApplications = await prisma.committeeApplication.findMany({
      where: {
        recruitmentCycleId: activeCycleId,
        OR: [
          {
            user: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            user: {
              studentNumber: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            user: {
              email: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
            section: true,
            memberships: {
              where: { recruitmentCycleId: activeCycleId },
              select: { memberId: true },
              take: 1,
            },
          },
        },
      },
    });
    // Filter committee applications (exclude truly processed ones)
    const commApplications = allCommApplications.filter(
      (app: (typeof allCommApplications)[number]) => {
        const isAccepted = app.hasAccepted && app.status === "passed";
        const isRejected = app.status === "failed";
        const isRedirected = app.status === "redirected";

        const hasCommitteeAccess =
          isSuperAdmin ||
          accessibleCommittees.has(
            normalizeCommitteeId(app.firstOptionCommittee),
          ) ||
          accessibleCommittees.has(
            normalizeCommitteeId(app.secondOptionCommittee),
          );

        return (
          hasCommitteeAccess && !isAccepted && !isRejected && !isRedirected
        );
      },
    );

    // Search EA applications
    const allExecutiveAssociateApplications =
      await prisma.executiveAssociateApplication.findMany({
        where: {
          recruitmentCycleId: activeCycleId,
          OR: [
            {
              user: {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
            {
              user: {
                studentNumber: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
            {
              user: {
                email: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              studentNumber: true,
              section: true,
              memberships: {
                where: { recruitmentCycleId: activeCycleId },
                select: { memberId: true },
                take: 1,
              },
            },
          },
        },
      });

    // Filter EA applications (exclude truly processed ones)
    const executiveAssociateApplications =
      allExecutiveAssociateApplications.filter(
        (app: (typeof allExecutiveAssociateApplications)[number]) => {
          const isAccepted = app.hasAccepted && app.status === "passed";
          const isRejected = app.status === "failed";
          const isRedirected = app.status === "redirected";

          return !isAccepted && !isRejected && !isRedirected;
        },
      );

    // Search member applications
    const memberApplications = await prisma.memberApplication.findMany({
      where: {
        recruitmentCycleId: activeCycleId,
        OR: [
          {
            user: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            user: {
              studentNumber: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            user: {
              email: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
            section: true,
            memberships: {
              where: { recruitmentCycleId: activeCycleId },
              select: { memberId: true },
              take: 1,
            },
          },
        },
      },
    });

    // Add CV and Portfolio download links for Committee applications
    applications.committee = await Promise.all(
      commApplications.map(
        async (application: (typeof commApplications)[number]) => {
          const cvDownloadUrl = application.supabaseFilePath
            ? `/api/admin/cv-download?applicationId=${application.id}&type=committee`
            : null;

          const portfolioDownloadUrl = application.portfolioLink
            ? `/api/admin/portfolio-download?applicationId=${application.id}`
            : null;

          return {
            ...application,
            type: "committee",
            isAssigned: Boolean(
              application.interviewBy &&
              assignmentValues.includes(application.interviewBy.toLowerCase()),
            ),
            cvDownloadUrl,
            portfolioDownloadUrl,
          };
        },
      ),
    );

    // Add CV download links for EA applications
    applications.ea = await Promise.all(
      executiveAssociateApplications.map(
        async (
          application: (typeof executiveAssociateApplications)[number],
        ) => {
          const cvDownloadUrl = application.supabaseFilePath
            ? `/api/admin/cv-download?applicationId=${application.id}&type=executive-associate`
            : null;

          return {
            ...application,
            type: "executive-associate",
            isAssigned: Boolean(
              application.interviewBy &&
              assignmentValues.includes(application.interviewBy.toLowerCase()),
            ),
            cvDownloadUrl,
          };
        },
      ),
    );

    applications.member = memberApplications.map(
      (application: (typeof memberApplications)[number]) => ({
        ...application,
        type: "member",
        isAssigned: true,
      }),
    );

    return NextResponse.json({
      success: true,
      applications,
      searchQuery: query,
      totalResults:
        applications.committee.length +
        applications.ea.length +
        applications.member.length,
    });
  } catch (error) {
    console.error("Error searching applications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
