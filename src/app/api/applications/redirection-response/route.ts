import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { committeeRolesSubmitted } from "@/data/committeeRoles";
import { roles } from "@/data/ebRoles";
import { ensureCycleMemberId } from "@/lib/member-id";

const isMemberRedirection = (value?: string | null) =>
  value?.toLowerCase() === "member";

const getCommitteeIdFromRedirection = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("committee-")) {
    return value.replace("committee-", "");
  }

  const byId = committeeRolesSubmitted.find((c) => c.id === value);
  if (byId) return byId.id;

  const byTitle = committeeRolesSubmitted.find((c) => c.title === value);
  if (byTitle) return byTitle.id;

  return null;
};

const getEaRoleIdFromRedirection = (value?: string | null) => {
  if (!value) return null;
  const role = roles.find((r) => r.id === value);
  return role ? role.id : null;
};

const acceptMemberApplication = async (
  studentNumber: string,
  userId: string,
  cycleId: string | null,
) =>
  prisma.$transaction(async (tx) => {
    const existingMember = await tx.memberApplication.findFirst({
      where: { studentNumber, recruitmentCycleId: cycleId },
      orderBy: { createdAt: "desc" },
    });

    const acceptedMember = existingMember
      ? await tx.memberApplication.update({
          where: { id: existingMember.id },
          data: { hasAccepted: true },
        })
      : await tx.memberApplication.create({
          data: {
            studentNumber,
            recruitmentCycleId: cycleId,
            hasAccepted: true,
            paymentProof: "",
          },
        });

    await ensureCycleMemberId(tx, userId, acceptedMember.recruitmentCycleId);

    await tx.memberApplication.deleteMany({
      where: {
        studentNumber,
        recruitmentCycleId: cycleId,
        id: { not: acceptedMember.id },
      },
    });

    return acceptedMember;
  });

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const decision = body?.decision;

    if (decision !== "accept" && decision !== "reject") {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const cycleId = activeCycle?.id ?? null;
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        committeeApplications: {
          where: { recruitmentCycleId: cycleId },
          take: 1,
        },
        executiveAssociateApplications: {
          where: { recruitmentCycleId: cycleId },
          take: 1,
        },
      },
    });

    if (!user?.studentNumber) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const committeeApp =
      user.committeeApplications?.[0]?.status === "redirected" &&
      user.committeeApplications?.[0]?.redirection
        ? user.committeeApplications?.[0]
        : null;

    const eaApp =
      user.executiveAssociateApplications?.[0]?.status === "redirected" &&
      user.executiveAssociateApplications?.[0]?.redirection
        ? user.executiveAssociateApplications?.[0]
        : null;

    const sourceType = committeeApp
      ? "committee"
      : eaApp
        ? "executive-associate"
        : null;
    const sourceApp = committeeApp ?? eaApp;

    if (!sourceType || !sourceApp) {
      return NextResponse.json(
        { error: "No pending redirection found" },
        { status: 404 },
      );
    }

    const redirection = sourceApp.redirection;
    const committeeId = getCommitteeIdFromRedirection(redirection);
    const eaRoleId = getEaRoleIdFromRedirection(redirection);

    if (decision === "accept") {
      if (isMemberRedirection(redirection)) {
        const memberApplication = await acceptMemberApplication(
          user.studentNumber,
          user.id,
          cycleId,
        );
        if (sourceType === "committee") {
          await prisma.committeeApplication.update({
            where: { id: sourceApp.id },
            data: {
              hasAccepted: true,
              status: "passed",
              paymentProof: memberApplication.paymentProof,
              paymentStatus: memberApplication.paymentStatus,
              paymentReviewedAt: memberApplication.paymentReviewedAt,
              paymentReviewedBy: memberApplication.paymentReviewedBy,
              paymentRejectionReason: memberApplication.paymentRejectionReason,
            },
          });
        } else {
          await prisma.executiveAssociateApplication.update({
            where: { id: sourceApp.id },
            data: {
              hasAccepted: true,
              status: "passed",
              paymentProof: memberApplication.paymentProof,
              paymentStatus: memberApplication.paymentStatus,
              paymentReviewedAt: memberApplication.paymentReviewedAt,
              paymentReviewedBy: memberApplication.paymentReviewedBy,
              paymentRejectionReason: memberApplication.paymentRejectionReason,
            },
          });
        }
        await prisma.memberApplication.delete({
          where: { id: memberApplication.id },
        });
      } else if (sourceType === "committee" && eaRoleId) {
        const existingEa = await prisma.executiveAssociateApplication.findFirst(
          {
            where: {
              studentNumber: user.studentNumber,
              recruitmentCycleId: cycleId,
            },
          },
        );
        if (existingEa) {
          await prisma.committeeApplication.update({
            where: { id: sourceApp.id },
            data: {
              status: "passed",
              hasAccepted: true,
              paymentProof: existingEa.paymentProof,
              paymentStatus: existingEa.paymentStatus,
              paymentReviewedAt: existingEa.paymentReviewedAt,
              paymentReviewedBy: existingEa.paymentReviewedBy,
              paymentRejectionReason: existingEa.paymentRejectionReason,
            },
          });
          await prisma.executiveAssociateApplication.delete({
            where: { id: existingEa.id },
          });
        } else {
          await prisma.committeeApplication.update({
            where: { id: sourceApp.id },
            data: { status: "passed", hasAccepted: true },
          });
        }
      } else if (sourceType === "committee" && committeeId) {
        await prisma.committeeApplication.update({
          where: { id: sourceApp.id },
          data: { status: "passed", hasAccepted: true },
        });
      } else if (sourceType === "executive-associate" && committeeId) {
        const existingCommittee = await prisma.committeeApplication.findFirst({
          where: {
            studentNumber: user.studentNumber,
            recruitmentCycleId: cycleId,
          },
        });
        if (existingCommittee) {
          await prisma.executiveAssociateApplication.update({
            where: { id: sourceApp.id },
            data: {
              status: "passed",
              hasAccepted: true,
              paymentProof: existingCommittee.paymentProof,
              paymentStatus: existingCommittee.paymentStatus,
              paymentReviewedAt: existingCommittee.paymentReviewedAt,
              paymentReviewedBy: existingCommittee.paymentReviewedBy,
              paymentRejectionReason: existingCommittee.paymentRejectionReason,
            },
          });
          await prisma.committeeApplication.delete({
            where: { id: existingCommittee.id },
          });
        } else {
          await prisma.executiveAssociateApplication.update({
            where: { id: sourceApp.id },
            data: { status: "passed", hasAccepted: true },
          });
        }
      }

      await prisma.$transaction((tx) =>
        ensureCycleMemberId(tx, user.id, cycleId),
      );

      return NextResponse.json({
        success: true,
        message: "Redirection accepted successfully",
      });
    }

    const memberApplication = await acceptMemberApplication(
      user.studentNumber,
      user.id,
      cycleId,
    );
    const memberReviewData = {
      hasAccepted: true,
      status: "passed",
      redirection: "member",
      paymentProof: memberApplication.paymentProof,
      paymentStatus: memberApplication.paymentStatus,
      paymentReviewedAt: memberApplication.paymentReviewedAt,
      paymentReviewedBy: memberApplication.paymentReviewedBy,
      paymentRejectionReason: memberApplication.paymentRejectionReason,
    };

    if (sourceType === "committee") {
      await prisma.committeeApplication.update({
        where: { id: sourceApp.id },
        data: memberReviewData,
      });
    } else {
      await prisma.executiveAssociateApplication.update({
        where: { id: sourceApp.id },
        data: memberReviewData,
      });
    }
    await prisma.memberApplication.delete({
      where: { id: memberApplication.id },
    });

    return NextResponse.json({
      success: true,
      message: "Redirection rejected. You are now a regular member.",
    });
  } catch (error) {
    console.error("Redirection response error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
