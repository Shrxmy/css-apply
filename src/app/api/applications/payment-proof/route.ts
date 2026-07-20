import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailTemplates } from "@/lib/email";
import { ensureCycleMemberId } from "@/lib/member-id";

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { paymentProof } = await request.json();
    if (
      !paymentProof ||
      typeof paymentProof !== "string" ||
      !isValidUrl(paymentProof)
    ) {
      return NextResponse.json(
        { error: "A valid Google Drive receipt link is required" },
        { status: 400 },
      );
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberApplications: {
          where: { recruitmentCycleId: activeCycle?.id ?? null },
          take: 1,
        },
        committeeApplications: {
          where: { recruitmentCycleId: activeCycle?.id ?? null },
          take: 1,
        },
        executiveAssociateApplications: {
          where: { recruitmentCycleId: activeCycle?.id ?? null },
          take: 1,
        },
      },
    });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const proof = paymentProof.trim();
    if (user.memberApplications?.[0]?.hasAccepted) {
      await prisma.memberApplication.update({
        where: { id: user.memberApplications?.[0].id },
        data: { paymentProof: proof },
      });
    } else if (user.committeeApplications?.[0]?.hasAccepted) {
      await prisma.committeeApplication.update({
        where: { id: user.committeeApplications?.[0].id },
        data: { paymentProof: proof },
      });
    } else if (user.executiveAssociateApplications?.[0]?.hasAccepted) {
      await prisma.executiveAssociateApplication.update({
        where: { id: user.executiveAssociateApplications?.[0].id },
        data: { paymentProof: proof },
      });
    } else {
      return NextResponse.json(
        { error: "No accepted application found" },
        { status: 404 },
      );
    }

    const memberId = await prisma.$transaction((tx) =>
      ensureCycleMemberId(tx, user.id, activeCycle?.id),
    );
    try {
      const template = emailTemplates.memberIdReleased(
        user.name || "Valued Member",
        memberId,
      );
      await sendEmail(user.email, template.subject, template.html);
    } catch (emailError) {
      console.error("Failed to send member ID email:", emailError);
    }

    return NextResponse.json({ success: true, paymentProof: proof, memberId });
  } catch (error) {
    console.error("Payment proof submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
