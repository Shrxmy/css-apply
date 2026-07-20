import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { sendEmail, emailTemplates } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentNumber, section, age, dateOfBirth, isOldCssMember } =
      await request.json();

    if (
      !studentNumber ||
      !section ||
      !age ||
      !dateOfBirth ||
      typeof isOldCssMember !== "boolean"
    ) {
      return NextResponse.json(
        {
          error:
            "Student number, section, age, date of birth, and CSS membership history are required",
        },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(studentNumber)) {
      return NextResponse.json(
        { error: "Student number must be 10 digits" },
        { status: 400 },
      );
    }

    const existingUserWithSN = await prisma.user.findUnique({
      where: { studentNumber },
    });

    if (existingUserWithSN && existingUserWithSN.email !== session.user.email) {
      return NextResponse.json(
        { error: "This student number is already registered by another user" },
        { status: 400 },
      );
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    // Check for already-accepted application in the active cycle BEFORE updating user data
    const existingApplication = await prisma.memberApplication.findFirst({
      where: { studentNumber, recruitmentCycleId: activeCycle?.id ?? null },
    });

    if (existingApplication?.hasAccepted) {
      return NextResponse.json(
        { error: "You already have an accepted member application" },
        { status: 400 },
      );
    }

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        studentNumber,
        section,
        age: Number(age),
        dateOfBirth: new Date(dateOfBirth),
        isOldCssMember,
      },
    });

    const application = existingApplication
      ? await prisma.memberApplication.update({
          where: { id: existingApplication.id },
          data: {},
        })
      : await prisma.memberApplication.create({
          data: {
            studentNumber,
            recruitmentCycleId: activeCycle?.id ?? null,
            paymentProof: "",
            hasAccepted: false,
          },
        });

    // Send confirmation email
    try {
      const emailTemplate = emailTemplates.memberApplication(
        updatedUser.name,
        studentNumber,
      );
      await sendEmail(
        updatedUser.email,
        emailTemplate.subject,
        emailTemplate.html,
      );
      console.log(
        "Member application confirmation email sent to:",
        updatedUser.email,
      );
    } catch (emailError) {
      console.error(
        "Failed to send member application confirmation email:",
        emailError,
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      application,
      message: "Application info saved. Please proceed to payment.",
    });
  } catch (error) {
    console.error("Member application error:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "This student number already has an application" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberApplications: {
          where: {
            recruitmentCycleId: activeCycle?.id ?? null,
          },
          take: 1,
        },
        memberships: {
          where: {
            recruitmentCycleId: activeCycle?.id ?? "__no_active_cycle__",
          },
          select: { memberId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasApplication: !!user.memberApplications?.[0],
      application: user.memberApplications?.[0],
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
    console.error("Get Member Application error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
