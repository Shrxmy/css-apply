import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPositionTitle, getRoleId } from "@/lib/eb-mapping";

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

    // First, let's see all applications for this position
    const allCommApplications = await prisma.committeeApplication.findMany({
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

    console.log(
      `Found ${allCommApplications.length} total committee applications for position: ${position}`,
    );
    allCommApplications.forEach((app: typeof allCommApplications[number]) => {
      console.log(
        `Committee App ${app.id}: hasAccepted=${app.hasAccepted}, status=${app.status}, user=${app.user?.name}`,
      );
    });

    const commApplications = allCommApplications.filter((app: typeof allCommApplications[number]) => {
      // Include applications that are NOT truly processed
      const isAccepted = app.hasAccepted && app.status === "passed";
      const isRejected = app.status === "failed";
      const isRedirected = app.status === "redirected";

      const shouldInclude = !isAccepted && !isRejected && !isRedirected;

      if (!shouldInclude) {
        console.log(
          `Excluding committee app ${app.id}: hasAccepted=${app.hasAccepted}, status=${app.status}`,
        );
      }

      return shouldInclude;
    });

    console.log(
      `Filtered to ${commApplications.length} committee applications for All Applications tab`,
    );

    // Get all EA applications and compute whether each one is assigned to the current admin position
    const allExecutiveAssociateApplications = await prisma.executiveAssociateApplication.findMany({
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

    console.log(
      `Found ${allExecutiveAssociateApplications.length} total EA applications for position: ${position}`,
    );
    allExecutiveAssociateApplications.forEach((app: typeof allExecutiveAssociateApplications[number]) => {
      console.log(
        `EA App ${app.id}: hasAccepted=${app.hasAccepted}, status=${app.status}, user=${app.user?.name}`,
      );
    });

    const executiveAssociateApplications = allExecutiveAssociateApplications.filter((app: typeof allExecutiveAssociateApplications[number]) => {
      // Include applications that are NOT truly processed
      const isAccepted = app.hasAccepted && app.status === "passed";
      const isRejected = app.status === "failed";
      const isRedirected = app.status === "redirected";

      const shouldInclude = !isAccepted && !isRejected && !isRedirected;

      if (!shouldInclude) {
        console.log(
          `Excluding EA app ${app.id}: hasAccepted=${app.hasAccepted}, status=${app.status}`,
        );
      }

      return shouldInclude;
    });

    console.log(
      `Filtered to ${executiveAssociateApplications.length} EA applications for All Applications tab`,
    );

    // get member applications
    const memberApplications = await prisma.memberApplication.findMany({
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
      commApplications.map(async (application: typeof commApplications[number]) => {
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
      }),
    );

    // Add CV download links for EA applications
    applications.ea = await Promise.all(
      executiveAssociateApplications.map(async (application: typeof executiveAssociateApplications[number]) => {
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
      }),
    );

    applications.member = memberApplications.map((application: typeof memberApplications[number]) => ({
      ...application,
      type: "member",
      isAssigned: true,
    }));

    return NextResponse.json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
