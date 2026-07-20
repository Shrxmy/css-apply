import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getPositionTitle } from "@/lib/eb-mapping";

function normalizeStoragePath(fileRef: string | null | undefined) {
  if (!fileRef) return null;
  if (!fileRef.startsWith("http")) return fileRef;

  const urlMatch = fileRef.match(
    /\/storage\/v1\/object\/(?:public|sign)\/[^\/]+\/(.+?)(?:\?|$)/,
  );

  return urlMatch?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      studentNumber,
      firstName,
      lastName,
      section,
      age,
      dateOfBirth,
      isOldCssMember,
      ebRole,
      firstOptionEb,
      secondOptionEb,
      cv,
    } = await request.json();

    if (
      !studentNumber ||
      !section ||
      !age ||
      !dateOfBirth ||
      typeof isOldCssMember !== "boolean" ||
      !ebRole ||
      !firstOptionEb ||
      !secondOptionEb ||
      !cv
    ) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(studentNumber)) {
      return NextResponse.json(
        { error: "Student number must be 10 digits" },
        { status: 400 },
      );
    }

    const normalizedCvPath = normalizeStoragePath(cv);
    if (!normalizedCvPath) {
      return NextResponse.json(
        { error: "Invalid CV file reference" },
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

    // Check for already-accepted application BEFORE updating user data
    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    const existingApplication =
      await prisma.executiveAssociateApplication.findFirst({
        where: { studentNumber, recruitmentCycleId: activeCycle?.id ?? null },
      });

    if (existingApplication?.hasAccepted) {
      return NextResponse.json(
        { error: "You already have an accepted EA application" },
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
        name: `${firstName} ${lastName}`.trim(),
      },
    });

    if (!existingApplication) {
      await prisma.executiveAssociateApplication.create({
        data: {
          studentNumber,
          recruitmentCycleId: activeCycle?.id ?? null,
          ebRole,
          firstOptionEb,
          secondOptionEb,
          cv: normalizedCvPath,
          supabaseFilePath: normalizedCvPath,
          interviewSlotDay: "",
          interviewSlotTimeStart: "",
          interviewSlotTimeEnd: "",
          hasFinishedInterview: false,
          status: null,
          redirection: null,
          hasAccepted: false,
        },
      });

      // Application created successfully - email will be sent when schedule is selected
    } else {
      if (existingApplication.hasAccepted) {
        return NextResponse.json(
          { error: "You already have an accepted EA application" },
          { status: 400 },
        );
      }

      // Update existing non-accepted application (NO EMAIL SENT)
      await prisma.executiveAssociateApplication.update({
        where: { id: existingApplication.id },
        data: {
          ebRole,
          firstOptionEb,
          secondOptionEb,
          cv: normalizedCvPath,
          supabaseFilePath: normalizedCvPath,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message:
        "EA application submitted successfully. Please proceed to schedule your interview.",
    });
  } catch (error) {
    console.error("EA application error:", error);
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
        executiveAssociateApplications: {
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

    // Fetch meeting link from EBProfile if interviewBy is set
    let meetingLink = null;
    if (user.executiveAssociateApplications?.[0]?.interviewBy) {
      // Convert EB role ID to position title for database lookup
      const positionTitle = getPositionTitle(
        user.executiveAssociateApplications?.[0].interviewBy,
      );

      const ebProfile = await prisma.eBProfile.findFirst({
        where: {
          position: positionTitle,
        },
      });
      meetingLink = ebProfile?.meetingLink || null;
    }

    return NextResponse.json({
      hasApplication: !!user.executiveAssociateApplications?.[0],
      application: user.executiveAssociateApplications?.[0],
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
      ebRole: user.executiveAssociateApplications?.[0]?.ebRole,
      meetingLink: meetingLink,
    });
  } catch (error) {
    console.error("Get EA Application error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        executiveAssociateApplications: {
          where: {
            recruitmentCycleId:
              (
                await prisma.recruitmentCycle.findFirst({
                  where: { isActive: true },
                  select: { id: true },
                })
              )?.id ?? null,
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.executiveAssociateApplications?.[0]) {
      return NextResponse.json(
        { error: "No application found" },
        { status: 404 },
      );
    }

    // Delete files from Supabase storage if they exist
    try {
      const cvPath = normalizeStoragePath(
        user.executiveAssociateApplications?.[0].supabaseFilePath,
      );
      if (cvPath) {
        await supabase.storage
          .from("executive-associate-applications")
          .remove([cvPath]);
      }
    } catch (storageError) {
      console.error("Error deleting files from storage:", storageError);
      // Continue with application deletion even if file deletion fails
    }

    // Delete the EA application
    await prisma.executiveAssociateApplication.delete({
      where: { id: user.executiveAssociateApplications?.[0].id },
    });

    return NextResponse.json({
      success: true,
      message: "Application deleted successfully",
    });
  } catch (error) {
    console.error("Delete application error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
