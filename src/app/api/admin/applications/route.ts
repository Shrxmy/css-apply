import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailTemplates } from "@/lib/email";
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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    if (type === "member") {
      let memberApplications;
      let totalCount;

      if (status === "accepted") {
        // Get accepted applications
        totalCount = await prisma.memberApplication.count({
          where: { hasAccepted: true },
        });

        memberApplications = await prisma.memberApplication.findMany({
          where: { hasAccepted: true },
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
              ORDER BY "createdAt" DESC
              LIMIT ${limit} OFFSET ${skip}
            `,
          prisma.$queryRaw<CountResult[]>`
              SELECT COUNT(*) as count FROM "MemberApplication" 
              WHERE "hasAccepted" = false 
              AND "createdAt" = "updatedAt"
            `,
        ]);

        totalCount = Number(countResult[0].count);

        // Batch fetch users to avoid N+1 queries
        const studentNumbers = applications.map((app: MemberApplicationRaw) => app.studentNumber);
        const users = await prisma.user.findMany({
          where: { studentNumber: { in: studentNumbers } },
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
            section: true,
          },
        });
        const userMap = new Map(users.map((u: typeof users[number]) => [u.studentNumber, u]));
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
              ORDER BY "createdAt" DESC
              LIMIT ${limit} OFFSET ${skip}
            `,
          prisma.$queryRaw<CountResult[]>`
              SELECT COUNT(*) as count FROM "MemberApplication" 
              WHERE "hasAccepted" = false 
              AND "createdAt" != "updatedAt"
            `,
        ]);

        totalCount = Number(countResult[0].count);

        // Batch fetch users to avoid N+1 queries
        const studentNumbers = applications.map((app: MemberApplicationRaw) => app.studentNumber);
        const users = await prisma.user.findMany({
          where: { studentNumber: { in: studentNumbers } },
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
            section: true,
          },
        });
        const userMap = new Map(users.map((u: typeof users[number]) => [u.studentNumber, u]));
        memberApplications = applications.map((app: MemberApplicationRaw) => ({
          ...app,
          user: userMap.get(app.studentNumber) ?? null,
        }));
      } else {
        // Get all applications
        totalCount = await prisma.memberApplication.count();

        memberApplications = await prisma.memberApplication.findMany({
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

    if (type === "ea") {
      const whereClause: Record<string, unknown> = {};

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
      const totalCount = await prisma.eAApplication.count({
        where: whereClause,
      });

      const eaApplications = await prisma.eAApplication.findMany({
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
            },
          },
        },
      });

      // Add CV download links for EA applications (sync operation — no need for Promise.all)
      const eaApplicationsWithCvLinks = eaApplications.map((app: typeof eaApplications[number]) => ({
        ...app,
        cvDownloadUrl: app.supabaseFilePath
          ? `/api/admin/cv-download?applicationId=${app.id}&type=ea`
          : null,
      }));

      return NextResponse.json({
        success: true,
        applications: eaApplicationsWithCvLinks,
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
      const whereClause: Record<string, unknown> = {};

      // Filter by committee if provided
      if (committee && committee !== "all") {
        // For committee-specific filtering, we need to handle redirected applications
        // A redirected application should only appear in the committee they were redirected TO
        // We need to handle both committee ID and committee title since redirections store the full title

        // Get the committee title for the given committee ID
        const { committeeRolesSubmitted } =
          await import("@/data/committeeRoles");
        const committeeData = committeeRolesSubmitted.find(
          (c) => c.id === committee,
        );
        const committeeTitle = committeeData?.title;

        whereClause.OR = [
          // Direct applications to this committee (not redirected)
          {
            firstOptionCommittee: committee,
            redirection: null, // Not redirected
          },
          // Applications redirected TO this committee (by ID or title)
          ...(committeeTitle
            ? [
                { redirection: committee }, // By committee ID
                { redirection: committeeTitle }, // By committee title
              ]
            : [
                { redirection: committee }, // Fallback to just committee ID
              ]),
        ];
      }

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
        whereClause.redirection = { not: null }; // Show only applications with redirection
      } else if (status === "no-schedule") {
        whereClause.OR = [
          { interviewSlotDay: null },
          { interviewSlotTimeStart: null },
          { interviewSlotDay: "" },
          { interviewSlotTimeStart: "" },
        ];
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
            },
          },
        },
      });

      // Add CV and Portfolio download links for Committee applications (sync — no need for Promise.all)
      const committeeApplicationsWithCvLinks = committeeApplications.map(
        (app: typeof committeeApplications[number]) => ({
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
    console.error("Error fetching applications:", error);
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
            eaApplication: true,
          },
        },
      },
    });

    let cleanedCount = 0;
    for (const committeeApp of orphanedCommitteeApps) {
      // Check if the corresponding EA application exists and is failed
      if (
        committeeApp.user.eaApplication &&
        committeeApp.user.eaApplication.status === "failed"
      ) {
        await prisma.committeeApplication.delete({
          where: { id: committeeApp.id },
        });
        cleanedCount++;
        console.log(
          `Cleaned up orphaned committee application for student: ${committeeApp.studentNumber}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} orphaned committee application records`,
      cleanedCount,
    });
  } catch (error) {
    console.error("Error cleaning up orphaned records:", error);
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
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
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
        updatedApplication = await prisma.memberApplication.update({
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
            console.log(
              `Acceptance email sent to ${updatedApplication.user.email} for member application`,
            );
          } catch (emailError) {
            console.error("Failed to send acceptance email:", emailError);
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

      updatedApplication = await prisma.committeeApplication.update({
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
            console.log(
              `Acceptance email sent to ${updatedApplication.user.email} for committee application`,
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
            console.log(
              `Rejection email sent to ${updatedApplication.user.email} for committee application`,
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
              console.log(
                `Member redirection email sent to ${updatedApplication.user.email} for committee application`,
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
                console.log(
                  `EA redirection email sent to ${updatedApplication.user.email} for committee application (redirected to ${eaRole.title})`,
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
                console.log(
                  `Redirect email sent to ${updatedApplication.user.email} for committee application (redirected to ${redirection})`,
                );
              }
            }
          }
        } catch (emailError) {
          console.error("Failed to send email:", emailError);
        }
      }
    } else if (type === "ea") {
      // First get the current application data to check if it was redirected
      const currentApplication = await prisma.eAApplication.findUnique({
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
            console.log(
              `Cleaned up committee application record for accepted EA application: ${currentApplication.studentNumber}`,
            );
          } catch (error) {
            console.error(
              "Error cleaning up committee application record:",
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
            console.log(
              `Cleaned up committee application record for rejected EA application: ${currentApplication.studentNumber}`,
            );
          } catch (error) {
            console.error(
              "Error cleaning up committee application record:",
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

      updatedApplication = await prisma.eAApplication.update({
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
            console.log(
              `Acceptance email sent to ${updatedApplication.user.email} for EA application`,
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
            console.log(
              `Rejection email sent to ${updatedApplication.user.email} for EA application`,
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
                  updatedApplication.firstOptionEb || "Executive Assistant",
                );
              await sendEmail(
                updatedApplication.user.email,
                emailTemplate.subject,
                emailTemplate.html,
              );
              console.log(
                `Member redirection email sent to ${updatedApplication.user.email} for EA application`,
              );
            } else if (redirection.startsWith("committee-")) {
              const committeeId = redirection.replace("committee-", "");
              const emailTemplate =
                emailTemplates.executiveAssistantRedirectedToCommittee(
                  updatedApplication.user.name,
                  updatedApplication.user.id,
                  updatedApplication.firstOptionEb || "Executive Assistant",
                  committeeId,
                );
              await sendEmail(
                updatedApplication.user.email,
                emailTemplate.subject,
                emailTemplate.html,
              );
              console.log(
                `Committee redirection email sent to ${updatedApplication.user.email} for EA application (redirected to ${committeeId})`,
              );
            } else {
              // Regular EA to EA redirection
              const emailTemplate = emailTemplates.executiveAssistantRedirected(
                updatedApplication.user.name,
                updatedApplication.user.id,
                updatedApplication.firstOptionEb || "Executive Assistant",
                redirection,
              );
              await sendEmail(
                updatedApplication.user.email,
                emailTemplate.subject,
                emailTemplate.html,
              );
              console.log(
                `EA redirection email sent to ${updatedApplication.user.email} for EA application (redirected to ${redirection})`,
              );
            }
          }
        } catch (emailError) {
          console.error("Failed to send email:", emailError);
          // Don't fail the request if email fails
        }
      }
    } else {
      return NextResponse.json(
        { error: "Invalid application type" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      application: updatedApplication,
      message: `Application ${action}ed successfully`,
    });
  } catch (error) {
    console.error("Error updating application:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
