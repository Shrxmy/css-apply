import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // These queries are independent. Running them together avoids paying two
    // sequential Neon network round-trips during every initial page load.
    const [activeCycle, user] = await Promise.all([
      prisma.recruitmentCycle.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          applicationStart: true,
          interviewEnd: true,
        },
      }),
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          memberApplications: {
            where: { recruitmentCycle: { isActive: true } },
            select: { id: true },
            take: 1,
          },
          committeeApplications: {
            where: { recruitmentCycle: { isActive: true } },
            select: {
              id: true,
              firstOptionCommittee: true,
            },
            take: 1,
          },
          executiveAssociateApplications: {
            where: { recruitmentCycle: { isActive: true } },
            select: {
              id: true,
              firstOptionEb: true,
            },
            take: 1,
          },
        },
      }),
    ]);

    if (!user) {
      // For new users, create a basic user record if it doesn't exist
      try {
        await prisma.user.create({
          data: {
            email: session.user.email,
            name: session.user.name || "",
            role: "user",
          },
        });

        const existingApplications = {
          hasMemberApplication: false,
          hasCommitteeApplication: false,
          hasExecutiveAssociateApplication: false,
          applications: {
            member: null,
            committee: null,
            ea: null,
          },
          ebRole: null,
          committeeId: null,
          activeCycle,
        };

        return NextResponse.json(existingApplications);
      } catch (createError) {
        console.error("Check-existing API: Error creating user:", createError);
        return NextResponse.json(
          { error: "Failed to create user record" },
          { status: 500 },
        );
      }
    }

    const existingApplications = {
      hasMemberApplication: !!user.memberApplications?.[0],
      hasCommitteeApplication: !!user.committeeApplications?.[0],
      hasExecutiveAssociateApplication: !!user.executiveAssociateApplications?.[0],
      applications: {
        member: user.memberApplications?.[0],
        committee: user.committeeApplications?.[0],
        ea: user.executiveAssociateApplications?.[0],
      },
      // ADD these for proper redirects
      ebRole: user.executiveAssociateApplications?.[0]?.firstOptionEb,
      committeeId: user.committeeApplications?.[0]?.firstOptionCommittee,
      activeCycle,
    };

    return NextResponse.json(existingApplications);
  } catch (error) {
    console.error(
      "Check-existing API: Error checking existing applications:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
