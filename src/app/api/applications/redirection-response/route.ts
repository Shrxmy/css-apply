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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        committeeApplication: true,
        eaApplication: true,
      },
    });

    if (!user?.studentNumber) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const committeeApp =
      user.committeeApplication?.status === "redirected" &&
      user.committeeApplication?.redirection
        ? user.committeeApplication
        : null;

    const eaApp =
      user.eaApplication?.status === "redirected" &&
      user.eaApplication?.redirection
        ? user.eaApplication
        : null;

    const sourceType = committeeApp ? "committee" : eaApp ? "ea" : null;
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
        await prisma.memberApplication.upsert({
          where: { studentNumber: user.studentNumber },
          update: { hasAccepted: true },
          create: {
            studentNumber: user.studentNumber,
            hasAccepted: true,
            paymentProof: "",
          },
        });
      } else if (sourceType === "committee" && eaRoleId) {
        await prisma.eAApplication.upsert({
          where: { studentNumber: user.studentNumber },
          update: {
            ebRole: eaRoleId,
            firstOptionEb: eaRoleId,
            secondOptionEb: "",
            status: "passed",
            hasAccepted: true,
            redirection: null,
            cv: sourceApp.cv || "",
            supabaseFilePath: sourceApp.supabaseFilePath || "",
          },
          create: {
            studentNumber: user.studentNumber,
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
      } else if (sourceType === "ea" && committeeId) {
        await prisma.committeeApplication.upsert({
          where: { studentNumber: user.studentNumber },
          update: {
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
          create: {
            studentNumber: user.studentNumber,
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
        await prisma.eAApplication.update({
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

    await prisma.memberApplication.upsert({
      where: { studentNumber: user.studentNumber },
      update: { hasAccepted: true },
      create: {
        studentNumber: user.studentNumber,
        hasAccepted: true,
        paymentProof: "",
      },
    });

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
      await prisma.eAApplication.update({
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
