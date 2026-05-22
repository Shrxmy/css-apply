import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { committeeRolesSubmitted } from "@/data/committeeRoles";
import { roles } from "@/data/ebRoles";

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const decision = body?.decision;

    if (decision !== "accept" && decision !== "reject") {
      return NextResponse.json(
        { error: "Invalid decision" },
        { status: 400 },
      );
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({ where: { isActive: true }, select: { id: true } });
    const cycleId = activeCycle?.id ?? null;
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        committeeApplications: { where: { recruitmentCycleId: cycleId }, take: 1 },
        executiveAssociateApplications: { where: { recruitmentCycleId: cycleId }, take: 1 },
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

    const sourceType = committeeApp ? "committee" : eaApp ? "executive-associate" : null;
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
        const existingMember = await prisma.memberApplication.findFirst({ where: { studentNumber: user.studentNumber, recruitmentCycleId: cycleId } });
        if (existingMember) await prisma.memberApplication.update({ where: { id: existingMember.id }, data: { hasAccepted: true } });
        else await prisma.memberApplication.create({ data: { studentNumber: user.studentNumber, recruitmentCycleId: cycleId, hasAccepted: true, paymentProof: "" } });
      } else if (sourceType === "committee" && eaRoleId) {
        const existingEa = await prisma.executiveAssociateApplication.findFirst({ where: { studentNumber: user.studentNumber, recruitmentCycleId: cycleId } });
        if (existingEa) await prisma.executiveAssociateApplication.update({
          where: { id: existingEa.id },
          data: {
            ebRole: eaRoleId,
            firstOptionEb: eaRoleId,
            secondOptionEb: "",
            status: "passed",
            hasAccepted: true,
            redirection: null,
            cv: sourceApp.cv || "",
            supabaseFilePath: sourceApp.supabaseFilePath || "",
          },
        });
        else await prisma.executiveAssociateApplication.create({
          data: {
            studentNumber: user.studentNumber,
            recruitmentCycleId: cycleId,
            ebRole: eaRoleId,
            firstOptionEb: eaRoleId,
            secondOptionEb: "",
            cv: sourceApp.cv || "",
            supabaseFilePath: sourceApp.supabaseFilePath || "",
            hasFinishedInterview: false,
            status: "passed",
            hasAccepted: true,
            redirection: null,
          },
        });
      } else if (sourceType === "executive-associate" && committeeId) {
        const existingCommittee = await prisma.committeeApplication.findFirst({ where: { studentNumber: user.studentNumber, recruitmentCycleId: cycleId } });
        if (existingCommittee) await prisma.committeeApplication.update({
          where: { id: existingCommittee.id },
          data: {
            firstOptionCommittee: committeeId,
            secondOptionCommittee: "",
            status: "passed",
            hasAccepted: true,
            redirection: null,
            cv: sourceApp.cv || "",
            supabaseFilePath: sourceApp.supabaseFilePath || "",
            interviewSlotDay: sourceApp.interviewSlotDay,
            interviewSlotTimeStart: sourceApp.interviewSlotTimeStart,
            interviewSlotTimeEnd: sourceApp.interviewSlotTimeEnd,
            interviewBy: sourceApp.interviewBy,
          },
        });
        else await prisma.committeeApplication.create({
          data: {
            studentNumber: user.studentNumber,
            recruitmentCycleId: cycleId,
            firstOptionCommittee: committeeId,
            secondOptionCommittee: "",
            cv: sourceApp.cv || "",
            supabaseFilePath: sourceApp.supabaseFilePath || "",
            portfolioLink: null,
            interviewSlotDay: sourceApp.interviewSlotDay,
            interviewSlotTimeStart: sourceApp.interviewSlotTimeStart,
            interviewSlotTimeEnd: sourceApp.interviewSlotTimeEnd,
            interviewBy: sourceApp.interviewBy,
            hasFinishedInterview: false,
            status: "passed",
            hasAccepted: true,
            redirection: null,
          },
        });
      }

      if (sourceType === "committee") {
        await prisma.committeeApplication.update({
          where: { id: sourceApp.id },
          data: {
            hasAccepted: true,
            status: "passed",
          },
        });
      } else {
        await prisma.executiveAssociateApplication.update({
          where: { id: sourceApp.id },
          data: {
            hasAccepted: true,
            status: "passed",
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Redirection accepted successfully",
      });
    }

    const existingMember = await prisma.memberApplication.findFirst({ where: { studentNumber: user.studentNumber, recruitmentCycleId: cycleId } });
    if (existingMember) await prisma.memberApplication.update({ where: { id: existingMember.id }, data: { hasAccepted: true } });
    else await prisma.memberApplication.create({ data: { studentNumber: user.studentNumber, recruitmentCycleId: cycleId, hasAccepted: true, paymentProof: "" } });

    if (sourceType === "committee") {
      await prisma.committeeApplication.update({
        where: { id: sourceApp.id },
        data: {
          hasAccepted: true,
          status: "passed",
          redirection: "member",
        },
      });
    } else {
      await prisma.executiveAssociateApplication.update({
        where: { id: sourceApp.id },
        data: {
          hasAccepted: true,
          status: "passed",
          redirection: "member",
        },
      });

      await prisma.committeeApplication.deleteMany({
        where: {
          studentNumber: user.studentNumber,
          status: "redirected",
        },
      });
    }

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
