import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCycleMemberId } from "@/lib/member-id";
import { emailTemplates, sendEmail } from "@/lib/email";

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!activeCycle) {
      return NextResponse.json(
        { error: "No active recruitment cycle" },
        { status: 404 },
      );
    }

    const acceptedApplications = await prisma.$transaction(async (tx) => {
      const pendingApplications = await tx.memberApplication.findMany({
        where: {
          recruitmentCycleId: activeCycle.id,
          hasAccepted: false,
        },
        select: {
          id: true,
          studentNumber: true,
          recruitmentCycleId: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      const accepted = [];
      for (const application of pendingApplications) {
        const updatedApplication = await tx.memberApplication.update({
          where: { id: application.id },
          data: { hasAccepted: true },
        });
        const memberId = await ensureCycleMemberId(
          tx,
          application.user.id,
          application.recruitmentCycleId,
        );
        await tx.memberApplication.deleteMany({
          where: {
            studentNumber: application.studentNumber,
            recruitmentCycleId: application.recruitmentCycleId,
            id: { not: application.id },
          },
        });
        accepted.push({
          ...updatedApplication,
          memberId,
          user: application.user,
        });
      }
      return accepted;
    });

    await Promise.all(
      acceptedApplications.map(async (application) => {
        if (!application.user.email || !application.user.name) return;
        try {
          const template = emailTemplates.memberAccepted(
            application.user.name,
            application.user.id,
          );
          await sendEmail(
            application.user.email,
            template.subject,
            template.html,
          );
        } catch (error) {
          console.error("Bulk member acceptance email failed", error);
        }
      }),
    );

    return NextResponse.json({
      success: true,
      acceptedCount: acceptedApplications.length,
    });
  } catch (error) {
    console.error("Bulk member acceptance failed", error);
    return NextResponse.json(
      { error: "Failed to accept pending members" },
      { status: 500 },
    );
  }
}
