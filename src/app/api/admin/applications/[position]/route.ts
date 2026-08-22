import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPositionTitle, getRoleId } from "@/lib/eb-mapping";
import { committeeRoles } from "@/data/committeeRoles";
import { createLogger } from "@/lib/logger";

const applicationsLogger = createLogger("api/admin/applications");

const normalizeCommitteeId = (value: string) => {
  const normalizedValue = value.toLowerCase().replace(/&/g, "and");
  const committee = committeeRoles.find(
    ({ id, title }) =>
      id.toLowerCase() === normalizedValue ||
      title.toLowerCase().replace(/&/g, "and") === normalizedValue,
  );

  return committee?.id ?? value;
};

// GET all applications with filtering
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ position: string }> },
) {
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

    const { position } = await params;

    const applications: {
      committee: {
        status: string | null;
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
        isAssigned: boolean;
      }[];
      ea: {
        status: string | null;
        id: string;
        studentNumber: string;
        createdAt: Date;
        firstOptionEb: string;
        secondOptionEb: string;
        hasFinishedInterview: boolean;
        cv: string;
        supabaseFilePath: string | null;
        isAssigned: boolean;
      }[];
      member: {
        id: string;
        studentNumber: string;
        createdAt: Date;
        hasAccepted: boolean;
        paymentProof: string;
        isAssigned: boolean;
      }[];
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

    const allCommApplications = await prisma.committeeApplication.findMany({
      where: { recruitmentCycleId: activeCycleId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
            section: true,
          },
        },
      },
    });

    const commApplications = allCommApplications.filter(
      (app: (typeof allCommApplications)[number]) => {
        // Include applications that are NOT truly processed
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

    // Get all EA applications and compute whether each one is assigned to the current admin position
    const allExecutiveAssociateApplications =
      await prisma.executiveAssociateApplication.findMany({
        where: { recruitmentCycleId: activeCycleId },
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              studentNumber: true,
              section: true,
            },
          },
        },
      });

    const executiveAssociateApplications =
      allExecutiveAssociateApplications.filter(
        (app: (typeof allExecutiveAssociateApplications)[number]) => {
          // Include applications that are NOT truly processed
          const isAccepted = app.hasAccepted && app.status === "passed";
          const isRejected = app.status === "failed";
          const isRedirected = app.status === "redirected";

          return !isAccepted && !isRejected && !isRedirected;
        },
      );

    // get member applications
    const memberApplications = await prisma.memberApplication.findMany({
      where: { recruitmentCycleId: activeCycleId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
            section: true,
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

    applicationsLogger.info("application list prepared", {
      position,
      members: applications.member.length,
      committees: applications.committee.length,
      executiveAssociates: applications.ea.length,
    });

    return NextResponse.json({
      success: true,
      applications,
    });
  } catch (error) {
    applicationsLogger.error("application list failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
