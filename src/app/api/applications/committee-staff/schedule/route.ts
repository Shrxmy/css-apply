import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  emailTemplates,
  sendEmailWithValidation,
  getEBEmail,
} from "@/lib/email";
import { getPositionTitle, getRoleId } from "@/lib/eb-mapping";
import { roles } from "@/data/ebRoles";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      interviewSlotDay,
      interviewSlotTimeStart,
      interviewSlotTimeEnd,
      interviewBy,
    } = await request.json();

    if (
      !interviewSlotDay ||
      !interviewSlotTimeStart ||
      !interviewSlotTimeEnd ||
      !interviewBy
    ) {
      return NextResponse.json(
        { error: "All schedule fields are required" },
        { status: 400 },
      );
    }

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
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
      },
    });

    if (!user || !user.studentNumber) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.committeeApplications?.[0]) {
      return NextResponse.json(
        { error: "Committee application not found" },
        { status: 400 },
      );
    }

    // Use the student number from the DB (session), not from the request body
    const studentNumber = user.studentNumber;

    // Check for slot conflicts before updating - check BOTH EA and Committee applications
    const existingEABookings =
      await prisma.executiveAssociateApplication.findMany({
        where: {
          AND: [
            { recruitmentCycleId: activeCycleId },
            { interviewSlotDay },
            { interviewSlotTimeStart },
            { interviewSlotTimeEnd },
            { interviewBy },
          ],
        },
      });

    const existingCommitteeBookings =
      await prisma.committeeApplication.findMany({
        where: {
          AND: [
            { recruitmentCycleId: activeCycleId },
            { interviewSlotDay },
            { interviewSlotTimeStart },
            { interviewSlotTimeEnd },
            { interviewBy },
            { studentNumber: { not: studentNumber } }, // Exclude current user
          ],
        },
      });

    const totalConflicts =
      existingEABookings.length + existingCommitteeBookings.length;

    if (totalConflicts > 0) {
      return NextResponse.json(
        {
          error:
            "This time slot is no longer available. Please select another time slot.",
          conflict: true,
        },
        { status: 409 },
      );
    }

    const updatedApplication = await prisma.committeeApplication.update({
      where: { id: user.committeeApplications?.[0].id },
      data: {
        interviewBy,
        interviewSlotDay,
        interviewSlotTimeStart,
        interviewSlotTimeEnd,
      },
    });

    // Send email notification with meeting link when schedule is selected
    try {
      // Get the EB profile for the interviewer to get their meeting link
      // Convert EB role ID to position title for the query
      const positionTitle = getPositionTitle(interviewBy);
      const ebProfile = await prisma.eBProfile.findFirst({
        where: {
          position: positionTitle,
        },
      });

      const meetingLink = ebProfile?.meetingLink || null;

      // Send email to applicant
      const emailTemplate = emailTemplates.committeeApplication(
        user.name ?? "Applicant",
        user.committeeApplications?.[0].studentNumber,
        user.committeeApplications?.[0].firstOptionCommittee,
        user.committeeApplications?.[0].secondOptionCommittee,
        meetingLink || undefined,
        interviewBy,
      );
      await sendEmailWithValidation(
        user.email,
        emailTemplate.subject,
        emailTemplate.html,
        "Committee Staff applicant confirmation",
      );

      // Send email notification to EB interviewer with enhanced error handling
      try {
        // Convert position title to role ID if needed
        const roleId = getRoleId(interviewBy);

        const ebRole = roles.find((r) => r.id === roleId);
        const ebName = ebRole?.ebName || interviewBy;
        const ebEmail = getEBEmail(
          roleId,
          `Committee Staff interview notification for ${user.name}`,
        );

        // Format interview date and time
        const interviewDate = new Date(interviewSlotDay).toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          },
        );
        const interviewTime = `${interviewSlotTimeStart} - ${interviewSlotTimeEnd}`;

        const ebEmailTemplate = emailTemplates.ebInterviewNotificationCommittee(
          ebName,
          user.name ?? "Applicant",
          user.committeeApplications?.[0].studentNumber,
          user.committeeApplications?.[0].firstOptionCommittee,
          interviewDate,
          interviewTime,
          meetingLink || undefined,
        );

        await sendEmailWithValidation(
          ebEmail,
          ebEmailTemplate.subject,
          ebEmailTemplate.html,
          `Committee Staff interview notification to ${ebName}`,
        );
      } catch (ebEmailError) {
        console.error(
          "CRITICAL: Failed to send EB interview notification email:",
          ebEmailError,
        );
        // Don't fail the entire request, but log this as a critical error
        // The admin should be notified about this failure
      }
    } catch (emailError) {
      console.error(
        "Failed to send committee staff schedule confirmation email:",
        emailError,
      );
    }

    return NextResponse.json({
      success: true,
      application: updatedApplication,
      message: "Interview schedule updated successfully",
    });
  } catch (error) {
    console.error("Schedule update error:", error);

    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return NextResponse.json(
        { error: "Committee application not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
