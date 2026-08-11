import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getPositionTitle } from "@/lib/eb-mapping";
import { committeeApplicationSchema } from "@/lib/schemas";
import {
  assertNoOtherApplication,
  assertStudentNumberOwnership,
  assertValidCommitteeChoices,
  getApplicationRuleResponse,
  getOpenApplicationCycle,
  lockApplicantCycle,
} from "@/lib/application-rules";

function normalizeStoragePath(fileRef: string | null | undefined) {
  if (!fileRef) return null;
  if (!fileRef.startsWith("http")) return fileRef;

  const match = fileRef.match(
    /\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/,
  );
  return match?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = committeeApplicationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid application" },
        { status: 400 },
      );
    }

    const cycle = await getOpenApplicationCycle();
    const data = parsed.data;
    assertValidCommitteeChoices(
      data.firstOptionCommittee,
      data.secondOptionCommittee,
    );

    const cvPath = normalizeStoragePath(data.cv);
    const portfolioPath = data.portfolio
      ? normalizeStoragePath(data.portfolio)
      : null;
    if (!cvPath || (data.portfolio && !portfolioPath)) {
      return NextResponse.json(
        { error: "Invalid uploaded file reference" },
        { status: 400 },
      );
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      await lockApplicantCycle(tx, session.user.email!, cycle.id);
      await assertStudentNumberOwnership(
        tx,
        data.studentNumber,
        session.user.email!,
      );
      await assertNoOtherApplication(
        tx,
        session.user.email!,
        cycle.id,
        "committee",
      );

      const existing = await tx.committeeApplication.findFirst({
        where: {
          recruitmentCycleId: cycle.id,
          user: { email: session.user.email! },
        },
      });
      if (existing?.hasAccepted) {
        throw new Error("ACCEPTED_COMMITTEE_APPLICATION");
      }

      const user = await tx.user.update({
        where: { email: session.user.email! },
        data: {
          studentNumber: data.studentNumber,
          section: data.section,
          age: data.age,
          dateOfBirth: new Date(`${data.dateOfBirth}T00:00:00Z`),
          isOldCssMember: data.isOldCssMember,
          name: `${data.firstName} ${data.lastName}`.trim(),
        },
      });

      const applicationData = {
        firstOptionCommittee: data.firstOptionCommittee,
        secondOptionCommittee: data.secondOptionCommittee,
        cv: cvPath,
        portfolioLink: portfolioPath,
        supabaseFilePath: cvPath,
      };

      if (existing) {
        await tx.committeeApplication.update({
          where: { id: existing.id },
          data: applicationData,
        });
      } else {
        await tx.committeeApplication.create({
          data: {
            studentNumber: data.studentNumber,
            recruitmentCycleId: cycle.id,
            ...applicationData,
            hasAccepted: false,
            hasFinishedInterview: false,
          },
        });
      }

      return user;
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message:
        "Committee application submitted successfully. Please proceed to schedule your interview.",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const ruleError = getApplicationRuleResponse(error);
    if (ruleError) {
      return NextResponse.json(ruleError.body, { status: ruleError.status });
    }
    if (
      error instanceof Error &&
      error.message === "ACCEPTED_COMMITTEE_APPLICATION"
    ) {
      return NextResponse.json(
        { error: "You already have an accepted committee application" },
        { status: 409 },
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This student number already has an application" },
        { status: 409 },
      );
    }

    console.error(
      "Committee application error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const activeCycleId = activeCycle?.id ?? "__no_active_cycle__";

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        committeeApplications: {
          where: { recruitmentCycleId: activeCycleId },
          take: 1,
        },
        memberships: {
          where: { recruitmentCycleId: activeCycleId },
          select: { memberId: true },
          take: 1,
        },
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const application = user.committeeApplications[0] ?? null;
    let meetingLink: string | null = null;
    if (application?.interviewBy && activeCycle) {
      meetingLink =
        (
          await prisma.eBProfile.findFirst({
            where: {
              recruitmentCycleId: activeCycle.id,
              isActive: true,
              position: {
                equals: getPositionTitle(application.interviewBy),
                mode: "insensitive",
              },
            },
            select: { meetingLink: true },
          })
        )?.meetingLink ?? null;
    }

    return NextResponse.json({
      hasApplication: Boolean(application),
      application,
      user: {
        id: user.id,
        studentNumber: user.studentNumber,
        name: user.name,
        section: user.section,
        age: user.age,
        dateOfBirth: user.dateOfBirth,
        isOldCssMember: user.isOldCssMember,
        memberships: user.memberships,
      },
      meetingLink,
    });
  } catch (error) {
    console.error(
      "Get committee application error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        committeeApplications: {
          where: {
            recruitmentCycleId: activeCycle?.id ?? "__no_active_cycle__",
          },
          take: 1,
        },
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const application = user.committeeApplications[0];
    if (!application) {
      return NextResponse.json({ error: "No application found" }, { status: 404 });
    }
    if (application.hasAccepted) {
      return NextResponse.json(
        { error: "Accepted applications cannot be deleted" },
        { status: 409 },
      );
    }

    const paths = [
      normalizeStoragePath(application.supabaseFilePath),
      normalizeStoragePath(application.portfolioLink),
    ].filter((path): path is string => Boolean(path));
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("committee-applications")
        .remove(paths);
      if (storageError) {
        console.error("Committee file cleanup failed", storageError.name);
      }
    }

    await prisma.committeeApplication.delete({ where: { id: application.id } });
    return NextResponse.json({
      success: true,
      message: "Application deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete committee application error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
