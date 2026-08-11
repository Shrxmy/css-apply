import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { sendEmail, emailTemplates } from "@/lib/email";
import { memberApplicationSchema } from "@/lib/schemas";
import {
  assertNoOtherApplication,
  assertStudentNumberOwnership,
  getApplicationRuleResponse,
  getOpenApplicationCycle,
  lockApplicantCycle,
} from "@/lib/application-rules";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = memberApplicationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid application" },
        { status: 400 },
      );
    }

    const cycle = await getOpenApplicationCycle();
    const { studentNumber, section, age, dateOfBirth, isOldCssMember } =
      parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      await lockApplicantCycle(tx, session.user.email!, cycle.id);
      await assertStudentNumberOwnership(tx, studentNumber, session.user.email!);
      await assertNoOtherApplication(tx, session.user.email!, cycle.id, "member");

      const existingApplication = await tx.memberApplication.findFirst({
        where: {
          recruitmentCycleId: cycle.id,
          user: { email: session.user.email! },
        },
      });

      if (existingApplication?.hasAccepted) {
        throw new Error("ACCEPTED_MEMBER_APPLICATION");
      }

      const updatedUser = await tx.user.update({
        where: { email: session.user.email! },
        data: {
          studentNumber,
          section,
          age,
          dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`),
          isOldCssMember,
        },
      });

      const application = existingApplication
        ? existingApplication
        : await tx.memberApplication.create({
            data: {
              studentNumber,
              recruitmentCycleId: cycle.id,
              paymentProof: "",
              hasAccepted: false,
            },
          });

      return { updatedUser, application };
    });

    try {
      const template = emailTemplates.memberApplication(
        result.updatedUser.name,
        studentNumber,
      );
      await sendEmail(result.updatedUser.email, template.subject, template.html);
    } catch (emailError) {
      console.error(
        "Failed to send member application confirmation",
        emailError instanceof Error ? emailError.name : "UnknownError",
      );
    }

    return NextResponse.json({
      success: true,
      user: result.updatedUser,
      application: result.application,
      message: "Application info saved. Please proceed to payment.",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const ruleError = getApplicationRuleResponse(error);
    if (ruleError) {
      return NextResponse.json(ruleError.body, { status: ruleError.status });
    }

    if (error instanceof Error && error.message === "ACCEPTED_MEMBER_APPLICATION") {
      return NextResponse.json(
        { error: "You already have an accepted member application" },
        { status: 409 },
      );
    }

    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "This student number already has an application" },
        { status: 409 },
      );
    }

    console.error(
      "Member application error",
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberApplications: {
          where: { recruitmentCycleId: activeCycle?.id ?? "__no_active_cycle__" },
          take: 1,
        },
        memberships: {
          where: { recruitmentCycleId: activeCycle?.id ?? "__no_active_cycle__" },
          select: { memberId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasApplication: Boolean(user.memberApplications[0]),
      application: user.memberApplications[0] ?? null,
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
    });
  } catch (error) {
    console.error(
      "Get member application error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
