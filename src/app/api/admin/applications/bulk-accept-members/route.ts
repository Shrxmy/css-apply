import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCycleMemberId } from "@/lib/member-id";
import { emailTemplates, sendEmail } from "@/lib/email";

type AcceptedApplication = {
  user: { id: string; name: string; email: string };
};

const BATCH_SIZE = 20;

async function sendAcceptanceEmails(applications: AcceptedApplication[]) {
  await Promise.all(
    applications.map(async (application) => {
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
}

export async function POST() {
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

    const pendingApplications = await prisma.memberApplication.findMany({
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
      orderBy: { createdAt: "asc" },
    });

    let acceptedCount = 0;
    for (let index = 0; index < pendingApplications.length; index += BATCH_SIZE) {
      const batch = pendingApplications.slice(index, index + BATCH_SIZE);
      const acceptedApplications = await prisma.$transaction(async (tx) => {
        const accepted: AcceptedApplication[] = [];

        for (const application of batch) {
          const result = await tx.memberApplication.updateMany({
            where: { id: application.id, hasAccepted: false },
            data: { hasAccepted: true },
          });
          if (result.count === 0) continue;
          await ensureCycleMemberId(
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
          accepted.push({ user: application.user });
        }

        return accepted;
      }, { maxWait: 10_000, timeout: 15_000 });

      await sendAcceptanceEmails(acceptedApplications);
      acceptedCount += acceptedApplications.length;
    }

    return NextResponse.json({
      success: true,
      acceptedCount,
    });
  } catch (error) {
    console.error("Bulk member acceptance failed", error);
    return NextResponse.json(
      { error: "Failed to accept pending members" },
      { status: 500 },
    );
  }
}
