import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getPositionTitle } from "@/lib/eb-mapping";
import { executiveAssociateApplicationSchema } from "@/lib/schemas";
import {
  assertAvailableExecutiveAssociateChoices,
  assertNoOtherApplication,
  assertStudentNumberOwnership,
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

    const parsed = executiveAssociateApplicationSchema.safeParse(
      await request.json(),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid application" },
        { status: 400 },
      );
    }

    const cycle = await getOpenApplicationCycle();
    const data = parsed.data;
    await assertAvailableExecutiveAssociateChoices(
      prisma,
      data.ebRole,
      data.firstOptionEb,
      data.secondOptionEb,
    );

    const cvPath = normalizeStoragePath(data.cv);
    if (!cvPath) {
      return NextResponse.json(
        { error: "Invalid CV file reference" },
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
        "executive-associate",
      );
      await assertAvailableExecutiveAssociateChoices(
        tx,
        data.ebRole,
        data.firstOptionEb,
        data.secondOptionEb,
      );

      const existing = await tx.executiveAssociateApplication.findFirst({
        where: {
          recruitmentCycleId: cycle.id,
          user: { email: session.user.email! },
        },
      });
      if (existing?.hasAccepted) {
        throw new Error("ACCEPTED_EXECUTIVE_ASSOCIATE_APPLICATION");
      }

      const user = await tx.user.update({
        where: { email: session.user.email! },
        data: {
          studentNumber: data.studentNumber,
          section: data.section,
          age: data.age,
          sex: data.sex,
          dateOfBirth: new Date(`${data.dateOfBirth}T00:00:00Z`),
          isOldCssMember: data.isOldCssMember,
          name: `${data.firstName} ${data.lastName}`.trim(),
        },
      });

      const applicationData = {
        ebRole: data.ebRole,
        firstOptionEb: data.firstOptionEb,
        secondOptionEb: data.secondOptionEb,
        cv: cvPath,
        supabaseFilePath: cvPath,
      };

      if (existing) {
        await tx.executiveAssociateApplication.update({
          where: { id: existing.id },
          data: applicationData,
        });
      } else {
        await tx.executiveAssociateApplication.create({
          data: {
            studentNumber: data.studentNumber,
            recruitmentCycleId: cycle.id,
            ...applicationData,
            hasFinishedInterview: false,
            hasAccepted: false,
          },
        });
      }

      return user;
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message:
        "Executive Associate application submitted successfully. Please proceed to schedule your interview.",
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
      error.message === "ACCEPTED_EXECUTIVE_ASSOCIATE_APPLICATION"
    ) {
      return NextResponse.json(
        { error: "You already have an accepted Executive Associate application" },
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
      "Executive Associate application error",
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        executiveAssociateApplications: {
          where: { recruitmentCycle: { isActive: true } },
          take: 1,
        },
        memberships: {
          where: { recruitmentCycle: { isActive: true } },
          select: { memberId: true },
          take: 1,
        },
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const application = user.executiveAssociateApplications[0] ?? null;
    let meetingLink: string | null = null;
    if (application?.interviewBy) {
      meetingLink =
        (
          await prisma.eBProfile.findFirst({
            where: {
              recruitmentCycle: { isActive: true },
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
        sex: user.sex,
        dateOfBirth: user.dateOfBirth,
        isOldCssMember: user.isOldCssMember,
        memberships:
          application?.paymentStatus === "approved" ? user.memberships : [],
      },
      ebRole: application?.ebRole,
      meetingLink,
    });
  } catch (error) {
    console.error(
      "Get Executive Associate application error",
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
        executiveAssociateApplications: {
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

    const application = user.executiveAssociateApplications[0];
    if (!application) {
      return NextResponse.json({ error: "No application found" }, { status: 404 });
    }
    if (application.hasAccepted) {
      return NextResponse.json(
        { error: "Accepted applications cannot be deleted" },
        { status: 409 },
      );
    }

    const cvPath = normalizeStoragePath(application.supabaseFilePath);
    if (cvPath) {
      const { error: storageError } = await supabase.storage
        .from("ea-applications")
        .remove([cvPath]);
      if (storageError) {
        console.error("Executive Associate file cleanup failed", storageError.name);
      }
    }

    await prisma.executiveAssociateApplication.delete({
      where: { id: application.id },
    });
    return NextResponse.json({
      success: true,
      message: "Application deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Executive Associate application error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
