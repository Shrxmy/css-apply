import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { ensureCycleMemberId } from "@/lib/member-id";
import { committeeRoles } from "@/data/committeeRoles";
import { getPositionTitle } from "@/lib/eb-mapping";
import { isMembershipExpired } from "@/lib/membership-expiration";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [activeCycle, user] = await Promise.all([
      prisma.recruitmentCycle.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          schoolYear: true,
          membershipExpiration: true,
        },
      }),
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          studentNumber: true,
          section: true,
          role: true,
          ebProfile: {
            select: { position: true, isActive: true },
          },
          memberships: {
            where: { recruitmentCycle: { isActive: true } },
            select: { memberId: true, photoPath: true, createdAt: true },
            take: 1,
          },
          memberApplications: {
            where: { recruitmentCycle: { isActive: true } },
            select: {
              id: true,
              hasAccepted: true,
              paymentStatus: true,
              createdAt: true,
            },
            take: 1,
          },
          committeeApplications: {
            where: { recruitmentCycle: { isActive: true } },
            select: {
              id: true,
              firstOptionCommittee: true,
              paymentStatus: true,
              createdAt: true,
            },
            take: 1,
          },
          executiveAssociateApplications: {
            where: { recruitmentCycle: { isActive: true } },
            select: {
              id: true,
              ebRole: true,
              firstOptionEb: true,
              paymentStatus: true,
              createdAt: true,
            },
            take: 1,
          },
        },
      }),
    ]);

    if (!activeCycle) {
      return NextResponse.json({
        isEligible: false,
        reason: "No active recruitment cycle found.",
      });
    }

    if (!user) {
      return NextResponse.json({
        isEligible: false,
        reason: "User record not found.",
      });
    }

    if (isMembershipExpired(activeCycle.membershipExpiration)) {
      return NextResponse.json({
        isEligible: false,
        isExpired: true,
        expirationDate: activeCycle.membershipExpiration,
        reason: `This membership expired at the end of A.Y. ${activeCycle.schoolYear}.`,
      });
    }

    const memberApp = user.memberApplications?.[0];
    const committeeApp = user.committeeApplications?.[0];
    const ebProfile = user.ebProfile?.isActive ? user.ebProfile : null;
    const eaApp = user.executiveAssociateApplications?.[0];

    // Determine if any application has paymentStatus === "approved"
    let approvedAppType: "member" | "committee" | "ea" | null = null;
    let roleTitle = "Official Member";

    if (eaApp && eaApp.paymentStatus === "approved") {
      approvedAppType = "ea";
      const targetRole = eaApp.ebRole || eaApp.firstOptionEb;
      roleTitle = `Executive Associate (${getPositionTitle(targetRole)})`;
    } else if (committeeApp && committeeApp.paymentStatus === "approved") {
      approvedAppType = "committee";
      const targetComm = committeeRoles.find(
        (c) => c.id === committeeApp.firstOptionCommittee,
      );
      roleTitle = `Staff - ${targetComm?.title || committeeApp.firstOptionCommittee}`;
    } else if (memberApp && memberApp.paymentStatus === "approved") {
      approvedAppType = "member";
      roleTitle = "Official Member";
    }

    if (approvedAppType && ebProfile && (user.role === "admin" || user.role === "super_admin")) {
      roleTitle = `Executive Board - ${getPositionTitle(ebProfile.position)}`;
    }

    if (!approvedAppType) {
      // Check if they have submitted or pending
      const hasAnyPending =
        memberApp?.paymentStatus === "pending" ||
        committeeApp?.paymentStatus === "pending" ||
        eaApp?.paymentStatus === "pending";

      return NextResponse.json({
        isEligible: false,
        paymentStatus: hasAnyPending ? "pending" : "not_approved",
        reason: hasAnyPending
          ? "Your payment acknowledgement receipt is currently undergoing verification by the Executive Board. Your Digital ID will be issued once approved."
          : "Your Digital ID will be unlocked once your membership fee payment receipt is verified and approved.",
      });
    }

    // Ensure Member ID exists
    let memberId = user.memberships?.[0]?.memberId;
    const issueDate = user.memberships?.[0]?.createdAt
      ? new Date(user.memberships[0].createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

    if (!memberId) {
      try {
        memberId = await prisma.$transaction((tx) =>
          ensureCycleMemberId(tx, user.id, activeCycle.id),
        );
      } catch (error) {
        console.error("Error creating cycle member ID for digital ID:", error);
        return NextResponse.json(
          {
            isEligible: false,
            reason:
              "Your member ID could not be loaded. Please try again or contact an administrator.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      isEligible: true,
      memberId,
      schoolYear: activeCycle.schoolYear,
      expirationDate: activeCycle.membershipExpiration,
      roleTitle,
      applicationType: approvedAppType,
      issueDate,
      user: {
        id: user.id,
        name: user.name,
        studentNumber: user.studentNumber || "N/A",
        section: user.section || "N/A",
        image: user.memberships?.[0]?.photoPath
          ? `/api/user/digital-id/photo?v=${encodeURIComponent(user.memberships[0].photoPath)}`
          : user.image || null,
      },
    });
  } catch (error) {
    console.error("Error fetching digital ID data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
