import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendEmail, emailTemplates } from "@/lib/email";
import { committeeRoles } from "@/data/committeeRoles";
import { ensureCycleMemberId } from "@/lib/member-id";
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
import { applicationActionSchema } from "@/lib/schemas";

// Type definitions for raw query results
interface CountResult {
  count: bigint;
}

interface MemberApplicationRaw {
  id: string;
  studentNumber: string;
  hasAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
  paymentProof?: string;
}

// GET applications with filtering
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const committee = searchParams.get("committee");
    const isSuperAdmin = userRole === "super_admin";

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

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const activeCycleId = activeCycle?.id ?? "__no_active_cycle__";

    if (type === "member") {
      let memberApplications;
      let totalCount;

      if (status === "accepted") {
        // Get accepted applications
        totalCount = await prisma.memberApplication.count({
          where: { hasAccepted: true, recruitmentCycleId: activeCycleId },
        });

        memberApplications = await prisma.memberApplication.findMany({
          where: { hasAccepted: true, recruitmentCycleId: activeCycleId },
          orderBy: { createdAt: "desc" },
          skip: skip,
          take: limit,
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
      } else if (status === "pending") {
        // Get pending applications (hasAccepted: false AND createdAt = updatedAt)
        const [applications, countResult] = await Promise.all([
          prisma.$queryRaw<MemberApplicationRaw[]>`
              SELECT * FROM "MemberApplication" 
              WHERE "hasAccepted" = false 
              AND "createdAt" = "updatedAt"
              AND "recruitmentCycleId" = ${activeCycleId}
              ORDER BY "createdAt" DESC
              LIMIT ${limit} OFFSET ${skip}
            `,
          prisma.$queryRaw<CountResult[]>`
              SELECT COUNT(*) as count FROM "MemberApplication" 
              WHERE "hasAccepted" = false 
              AND "createdAt" = "updatedAt"
              AND "recruitmentCycleId" = ${activeCycleId}
            `,
        ]);

        totalCount = Number(countResult[0].count);

        // Batch fetch users to avoid N+1 queries
        const studentNumbers = applications.map(
          (app: MemberApplicationRaw) => app.studentNumber,
        );
        const users = await prisma.user.findMany({
          where: { studentNumber: { in: studentNumbers } },
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
        });
        const userMap = new Map(
          users.map((u: (typeof users)[number]) => [u.studentNumber, u]),
        );
        memberApplications = applications.map((app: MemberApplicationRaw) => ({
          ...app,
          user: userMap.get(app.studentNumber) ?? null,
        }));
      } else if (status === "rejected") {
        // Get rejected applications (hasAccepted: false AND createdAt != updatedAt)
        const [applications, countResult] = await Promise.all([
          prisma.$queryRaw<MemberApplicationRaw[]>`
              SELECT * FROM "MemberApplication" 
              WHERE "hasAccepted" = false 
              AND "createdAt" != "updatedAt"
              AND "recruitmentCycleId" = ${activeCycleId}
              ORDER BY "createdAt" DESC
              LIMIT ${limit} OFFSET ${skip}
            `,
          prisma.$queryRaw<CountResult[]>`
              SELECT COUNT(*) as count FROM "MemberApplication" 
              WHERE "hasAccepted" = false 
              AND "createdAt" != "updatedAt"
              AND "recruitmentCycleId" = ${activeCycleId}
            `,
        ]);

        totalCount = Number(countResult[0].count);

        // Batch fetch users to avoid N+1 queries
        const studentNumbers = applications.map(
          (app: MemberApplicationRaw) => app.studentNumber,
        );
        const users = await prisma.user.findMany({
          where: { studentNumber: { in: studentNumbers } },
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
        });
        const userMap = new Map(
          users.map((u: (typeof users)[number]) => [u.studentNumber, u]),
        );
        memberApplications = applications.map((app: MemberApplicationRaw) => ({
          ...app,
          user: userMap.get(app.studentNumber) ?? null,
        }));
      } else {
        // Get all applications
        totalCount = await prisma.memberApplication.count({
          where: { recruitmentCycleId: activeCycleId },
        });

        memberApplications = await prisma.memberApplication.findMany({
          where: { recruitmentCycleId: activeCycleId },
          orderBy: { createdAt: "desc" },
          skip: skip,
          take: limit,
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
      }

      return NextResponse.json({
        success: true,
        applications: memberApplications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount: totalCount,
          limit: limit,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPreviousPage: page > 1,
        },
      });
    }

    if (type === "executive-associate") {
      const whereClause: Record<string, unknown> = {
        recruitmentCycleId: activeCycleId,
      };

      // Filter by status if provided
      if (status === "accepted") {
        whereClause.hasAccepted = true;
        whereClause.status = { not: null }; // Exclude applications with NULL status
      } else if (status === "pending") {
        whereClause.OR = [
          { hasAccepted: false, status: null },
          { hasAccepted: false, status: "pending" },
          { hasAccepted: true, status: null }, // Include accepted applications that were reset to NULL
        ];
      } else if (status === "evaluating") {
        whereClause.status = "evaluating";
      } else if (status === "rejected") {
        whereClause.status = "failed";
      } else if (status === "redirected") {
        whereClause.OR = [
          { status: "redirected" },
          { redirection: { not: null } },
        ];
      } else if (status === "no-schedule") {
        whereClause.OR = [
          { interviewSlotDay: null },
          { interviewSlotTimeStart: null },
          { interviewSlotDay: "" },
          { interviewSlotTimeStart: "" },
        ];
      }

      // Get total count for pagination
      const totalCount = await prisma.executiveAssociateApplication.count({
        where: whereClause,
      });

      const executiveAssociateApplications =
        await prisma.executiveAssociateApplication.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip: skip,
          take: limit,
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

      // Add CV download links for EA applications (sync operation — no need for Promise.all)
      const executiveAssociateApplicationsWithCvLinks =
        executiveAssociateApplications.map(
          (app: (typeof executiveAssociateApplications)[number]) => ({
            ...app,
            cvDownloadUrl: app.supabaseFilePath
              ? `/api/admin/cv-download?applicationId=${app.id}&type=executive-associate`
              : null,
          }),
        );

      return NextResponse.json({
        success: true,
        applications: executiveAssociateApplicationsWithCvLinks,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount: totalCount,
          limit: limit,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPreviousPage: page > 1,
        },
      });
    }

    if (type === "committee") {
      const whereClause: Prisma.CommitteeApplicationWhereInput = {
        recruitmentCycleId: activeCycleId,
      };

      // To avoid OR collisions, compile conditions into an AND array if needed
      const andConditions: Prisma.CommitteeApplicationWhereInput[] = [];

      // Enforce accessible committees
      if (accessibleCommittees) {
        const accessibleList = Array.from(accessibleCommittees);

        if (committee && committee !== "all") {
          // If they selected a committee, check if they have access to it
          if (!accessibleCommittees.has(normalizeCommitteeId(committee))) {
            return NextResponse.json({
              success: true,
              applications: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalCount: 0,
                limit: limit,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            });
          }
        } else {
          // If they selected "all" committees, restrict to their accessible ones
          andConditions.push({
            OR: [
              { firstOptionCommittee: { in: accessibleList } },
              { redirection: { in: accessibleList } },
            ],
          });
        }
      }

      // Filter by committee if provided
      if (committee && committee !== "all") {
        const { committeeRolesSubmitted } =
          await import("@/data/committeeRoles");
        const committeeData = committeeRolesSubmitted.find(
          (c) => c.id === committee,
        );
        const committeeTitle = committeeData?.title;

        andConditions.push({
          OR: [
            {
              firstOptionCommittee: committee,
              redirection: null,
            },
            ...(committeeTitle
              ? [{ redirection: committee }, { redirection: committeeTitle }]
              : [{ redirection: committee }]),
          ],
        });
      }

      // Filter by status if provided
      if (status === "accepted") {
        whereClause.hasAccepted = true;
        whereClause.status = { not: null };
      } else if (status === "pending") {
        andConditions.push({
          OR: [
            { hasAccepted: false, status: null },
            { hasAccepted: false, status: "pending" },
            { hasAccepted: true, status: null },
          ],
        });
      } else if (status === "evaluating") {
        whereClause.status = "evaluating";
      } else if (status === "rejected") {
        whereClause.status = "failed";
      } else if (status === "redirected") {
        whereClause.redirection = { not: null };
      } else if (status === "no-schedule") {
        andConditions.push({
          OR: [
            { interviewSlotDay: null },
            { interviewSlotTimeStart: null },
            { interviewSlotDay: "" },
            { interviewSlotTimeStart: "" },
          ],
        });
      }

      if (andConditions.length > 0) {
        whereClause.AND = andConditions;
      }

      // Get total count for pagination
      const totalCount = await prisma.committeeApplication.count({
        where: whereClause,
      });

      const committeeApplications = await prisma.committeeApplication.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: skip,
        take: limit,
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

      // Add CV and Portfolio download links for Committee applications (sync — no need for Promise.all)
      const committeeApplicationsWithCvLinks = committeeApplications.map(
        (app: (typeof committeeApplications)[number]) => ({
          ...app,
          cvDownloadUrl: app.supabaseFilePath
            ? `/api/admin/cv-download?applicationId=${app.id}&type=committee`
            : null,
          portfolioDownloadUrl: app.portfolioLink
            ? `/api/admin/portfolio-download?applicationId=${app.id}`
            : null,
        }),
      );

      return NextResponse.json({
        success: true,
        applications: committeeApplicationsWithCvLinks,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount: totalCount,
          limit: limit,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPreviousPage: page > 1,
        },
      });
    }

    // For other application types, return empty array for now
    return NextResponse.json({
      success: true,
      applications: [],
    });
  } catch (error) {
    applicationsLogger.error("application query failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Clean up orphaned committee application records
export async function DELETE(_request: NextRequest) {
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

    // Find and delete orphaned committee application records
    // These are committee applications with status "redirected" where the corresponding EA application is "failed"
    const orphanedCommitteeApps = await prisma.committeeApplication.findMany({
      where: {
        status: "redirected",
      },
      include: {
        user: {
          include: {
            executiveAssociateApplications: true,
          },
        },
      },
    });

    let cleanedCount = 0;
    for (const committeeApp of orphanedCommitteeApps) {
      // Check if the corresponding EA application exists and is failed
      if (
        committeeApp.user.executiveAssociateApplications?.[0] &&
        committeeApp.user.executiveAssociateApplications?.[0].status ===
          "failed"
      ) {
        await prisma.committeeApplication.delete({
          where: { id: committeeApp.id },
        });
        cleanedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} orphaned committee application records`,
      cleanedCount,
    });
  } catch (error) {
    applicationsLogger.error("orphan cleanup failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// UPDATE application status (accept/reject)
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const parsed = applicationActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { applicationId, type, action, redirection } = parsed.data;

    if (!applicationId || !type || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    let updatedApplication;

    if (type === "member") {
      if (action === "accept") {
        updatedApplication = await prisma.$transaction(async (tx) => {
          const acceptedApplication = await tx.memberApplication.update({
            where: { id: applicationId },
            data: { hasAccepted: true },
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

          const memberId = await ensureCycleMemberId(
            tx,
            acceptedApplication.user.id,
            acceptedApplication.recruitmentCycleId,
          );

          await tx.memberApplication.deleteMany({
            where: {
              studentNumber: acceptedApplication.studentNumber,
              recruitmentCycleId: acceptedApplication.recruitmentCycleId,
              id: { not: acceptedApplication.id },
            },
          });

          return {
            ...acceptedApplication,
            user: {
              ...acceptedApplication.user,
              memberships: [{ memberId }],
            },
          };
        });

        // Send acceptance email
        if (
          updatedApplication?.user?.email &&
          updatedApplication?.user?.name &&
          updatedApplication?.user?.id
        ) {
          try {
            const emailTemplate = emailTemplates.memberAccepted(
              updatedApplication.user.name,
              updatedApplication.user.id,
            );
            await sendEmail(
              updatedApplication.user.email,
              emailTemplate.subject,
              emailTemplate.html,
            );
          } catch (emailError) {
            applicationsLogger.error("acceptance email failed", emailError);
            // Don't fail the request if email fails
          }
        }
      } else if (action === "reject") {
        updatedApplication = await prisma.memberApplication.update({
          where: { id: applicationId },
          data: { hasAccepted: false },
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
      }
    } else if (type === "committee") {
      const updateData: {
        hasAccepted?: boolean;
        status?: string;
        redirection?: string;
      } = {};

      if (action === "evaluate") {
        updateData.hasAccepted = false;
        updateData.status = "evaluating";
      } else if (action === "accept") {
        updateData.hasAccepted = true;
        updateData.status = "passed";
      } else if (action === "reject") {
        updateData.hasAccepted = false;
        updateData.status = "failed";
      } else if (action === "redirect" && redirection) {
        updateData.hasAccepted = false;
        updateData.status = "redirected";
        updateData.redirection = redirection;
      }

      updatedApplication = await prisma.$transaction(async (tx) => {
        const application = await tx.committeeApplication.update({
          where: { id: applicationId },
          data: updateData,
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

        if (action !== "accept") {
          return application;
        }

        const memberId = await ensureCycleMemberId(
          tx,
          application.user.id,
          application.recruitmentCycleId,
        );

        return {
          ...application,
          user: {
            ...application.user,
            memberships: [{ memberId }],
          },
        };
      });

      // Send appropriate email based on action
      if (updatedApplication?.user?.email && updatedApplication?.user?.name) {
        try {
          if (
            action === "accept" &&
            updatedApplication?.user?.id &&
            updatedApplication?.firstOptionCommittee
          ) {
            const emailTemplate = emailTemplates.committeeAccepted(
              updatedApplication.user.name,
              updatedApplication.user.id,
              updatedApplication.firstOptionCommittee,
            );
            await sendEmail(
              updatedApplication.user.email,
              emailTemplate.subject,
              emailTemplate.html,
            );
          } else if (
            action === "reject" &&
            updatedApplication?.firstOptionCommittee
          ) {
            const emailTemplate = emailTemplates.committeeRejected(
              updatedApplication.user.name,
              updatedApplication.firstOptionCommittee,
            );
            await sendEmail(
              updatedApplication.user.email,
              emailTemplate.subject,
              emailTemplate.html,
            );
          } else if (
            action === "redirect" &&
            updatedApplication?.user?.id &&
            redirection
          ) {
            // Check if redirecting to member
            if (redirection === "member") {
              const emailTemplate = emailTemplates.committeeRedirectedToMember(
                updatedApplication.user.name,
                updatedApplication.user.id,
                updatedApplication.firstOptionCommittee || "Original Committee",
              );
              await sendEmail(
                updatedApplication.user.email,
                emailTemplate.subject,
                emailTemplate.html,
              );
            } else {
              // Check if redirecting to an EA role
              const { roles } = await import("@/data/ebRoles");
              const eaRole = roles.find((r) => r.id === redirection);

              if (eaRole) {
                const emailTemplate = emailTemplates.committeeRedirected(
                  updatedApplication.user.name,
                  updatedApplication.user.id,
                  updatedApplication.firstOptionCommittee ||
                    "Original Committee",
                  eaRole.title,
                );
                await sendEmail(
                  updatedApplication.user.email,
                  emailTemplate.subject,
                  emailTemplate.html,
                );
              } else {
                // Regular committee redirection (to another committee)
                const emailTemplate = emailTemplates.committeeRedirected(
                  updatedApplication.user.name,
                  updatedApplication.user.id,
                  updatedApplication.firstOptionCommittee ||
                    "Original Committee",
                  redirection,
                );
                await sendEmail(
                  updatedApplication.user.email,
                  emailTemplate.subject,
                  emailTemplate.html,
                );
              }
            }
          }
        } catch (emailError) {
          applicationsLogger.error("application email failed", emailError);
        }
      }
    } else if (type === "executive-associate") {
      // First get the current application data to check if it was redirected
      const currentApplication =
        await prisma.executiveAssociateApplication.findUnique({
          where: { id: applicationId },
          select: { status: true, redirection: true, studentNumber: true },
        });

      const updateData: {
        hasAccepted?: boolean;
        status?: string;
        redirection?: string;
      } = {};

      if (action === "evaluate") {
        updateData.hasAccepted = false;
        updateData.status = "evaluating";
      } else if (action === "accept") {
        updateData.hasAccepted = true;
        updateData.status = "passed";

        // If this EA application was redirected to a committee, clean up the committee application record
        if (
          currentApplication?.status === "redirected" &&
          currentApplication?.redirection
        ) {
          try {
            await prisma.committeeApplication.deleteMany({
              where: {
                studentNumber: currentApplication.studentNumber,
                status: "redirected",
                redirection: currentApplication.redirection,
              },
            });
          } catch (error) {
            applicationsLogger.error(
              "redirected application cleanup failed",
              error,
            );
            // Don't fail the request if cleanup fails
          }
        }
      } else if (action === "reject") {
        updateData.hasAccepted = false;
        updateData.status = "failed";

        // If this EA application was redirected to a committee, clean up the committee application record
        if (
          currentApplication?.status === "redirected" &&
          currentApplication?.redirection
        ) {
          try {
            await prisma.committeeApplication.deleteMany({
              where: {
                studentNumber: currentApplication.studentNumber,
                status: "redirected",
                redirection: currentApplication.redirection,
              },
            });
          } catch (error) {
            applicationsLogger.error(
              "redirected application cleanup failed",
              error,
            );
            // Don't fail the request if cleanup fails
          }
        }
      } else if (action === "redirect" && redirection) {
        updateData.hasAccepted = false;
        updateData.status = "redirected";
        updateData.redirection = redirection;
      }

      updatedApplication = await prisma.$transaction(async (tx) => {
        const application = await tx.executiveAssociateApplication.update({
          where: { id: applicationId },
          data: updateData,
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

        if (action !== "accept") {
          return application;
        }

        const memberId = await ensureCycleMemberId(
          tx,
          application.user.id,
          application.recruitmentCycleId,
        );

        return {
          ...application,
          user: {
            ...application.user,
            memberships: [{ memberId }],
          },
        };
      });

      // Send appropriate email based on action
      if (updatedApplication?.user?.email && updatedApplication?.user?.name) {
        try {
          if (
            action === "accept" &&
            updatedApplication?.user?.id &&
            updatedApplication?.ebRole
          ) {
            const emailTemplate = emailTemplates.executiveAssistantAccepted(
              updatedApplication.user.name,
              updatedApplication.user.id,
              updatedApplication.ebRole,
            );
            await sendEmail(
              updatedApplication.user.email,
              emailTemplate.subject,
              emailTemplate.html,
            );
          } else if (action === "reject" && updatedApplication?.ebRole) {
            const emailTemplate = emailTemplates.executiveAssistantRejected(
              updatedApplication.user.name,
              updatedApplication.ebRole,
            );
            await sendEmail(
              updatedApplication.user.email,
              emailTemplate.subject,
              emailTemplate.html,
            );
          } else if (
            action === "redirect" &&
            updatedApplication?.user?.id &&
            redirection
          ) {
            // Check if redirecting to member
            if (redirection === "member") {
              const emailTemplate =
                emailTemplates.executiveAssistantRedirectedToMember(
                  updatedApplication.user.name,
                  updatedApplication.user.id,
                  updatedApplication.firstOptionEb || "Executive Associate",
                );
              await sendEmail(
                updatedApplication.user.email,
                emailTemplate.subject,
                emailTemplate.html,
              );
            } else if (redirection.startsWith("committee-")) {
              const committeeId = redirection.replace("committee-", "");
              const emailTemplate =
                emailTemplates.executiveAssistantRedirectedToCommittee(
                  updatedApplication.user.name,
                  updatedApplication.user.id,
                  updatedApplication.firstOptionEb || "Executive Associate",
                  committeeId,
                );
              await sendEmail(
                updatedApplication.user.email,
                emailTemplate.subject,
                emailTemplate.html,
              );
            } else {
              // Regular EA to EA redirection
              const emailTemplate = emailTemplates.executiveAssistantRedirected(
                updatedApplication.user.name,
                updatedApplication.user.id,
                updatedApplication.firstOptionEb || "Executive Associate",
                redirection,
              );
              await sendEmail(
                updatedApplication.user.email,
                emailTemplate.subject,
                emailTemplate.html,
              );
            }
          }
        } catch (emailError) {
          applicationsLogger.error("application email failed", emailError);
          // Don't fail the request if email fails
        }
      }
    } else {
      return NextResponse.json(
        { error: "Invalid application type" },
        { status: 400 },
      );
    }

    applicationsLogger.info("application action completed", {
      type,
      action,
    });

    return NextResponse.json({
      success: true,
      application: updatedApplication,
      message: `Application ${action}ed successfully`,
    });
  } catch (error) {
    applicationsLogger.error("application action failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
