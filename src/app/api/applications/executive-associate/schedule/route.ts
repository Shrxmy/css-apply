import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { emailTemplates, sendEmailWithValidation } from "@/lib/email";
import { eaScheduleSchema } from "@/lib/schemas";
import {
  getActiveCycle,
  getApplicationRuleResponse,
  validateAndLockInterviewSlot,
} from "@/lib/application-rules";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = eaScheduleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid interview slot" },
        { status: 400 },
      );
    }

    const cycle = await getActiveCycle();
    const slot = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email: session.user.email! },
        include: {
          executiveAssociateApplications: {
            where: { recruitmentCycleId: cycle.id },
            take: 1,
          },
        },
      });
      if (!user?.studentNumber) throw new Error("SCHEDULE_USER_NOT_FOUND");

      const application = user.executiveAssociateApplications[0];
      if (!application) throw new Error("EA_APPLICATION_NOT_FOUND");
      if (application.hasAccepted) throw new Error("APPLICATION_ALREADY_ACCEPTED");
      if (
        slot.ebRole !== application.ebRole ||
        application.firstOptionEb !== application.ebRole
      ) {
        throw new Error("EA_ROLE_MISMATCH");
      }

      const profile = await validateAndLockInterviewSlot(tx, cycle, {
        day: slot.interviewSlotDay,
        start: slot.interviewSlotTimeStart,
        end: slot.interviewSlotTimeEnd,
        interviewBy: slot.interviewBy,
        applicationType: "executive-associate",
        applicationId: application.id,
        expectedEbRole: application.ebRole,
      });

      const updatedApplication =
        await tx.executiveAssociateApplication.update({
          where: { id: application.id },
          data: {
            interviewBy: profile.position,
            interviewSlotDay: slot.interviewSlotDay,
            interviewSlotTimeStart: slot.interviewSlotTimeStart,
            interviewSlotTimeEnd: slot.interviewSlotTimeEnd,
          },
        });

      return { user, application, updatedApplication, profile };
    });

    try {
      const applicantTemplate = emailTemplates.executiveAssistantApplication(
        result.user.name || "Applicant",
        result.application.studentNumber,
        result.application.ebRole,
        result.application.firstOptionEb,
        result.application.secondOptionEb,
        result.profile.meetingLink || undefined,
        result.profile.position,
      );
      await sendEmailWithValidation(
        result.user.email,
        applicantTemplate.subject,
        applicantTemplate.html,
        "Executive Associate applicant confirmation",
      );

      const ebName = result.profile.user.name || result.profile.position;
      const ebTemplate = emailTemplates.ebInterviewNotificationEA(
        ebName,
        result.user.name || "Applicant",
        result.application.studentNumber,
        result.application.ebRole,
        new Date(`${slot.interviewSlotDay}T00:00:00+08:00`).toLocaleDateString(
          "en-US",
          { weekday: "long", year: "numeric", month: "long", day: "numeric" },
        ),
        `${slot.interviewSlotTimeStart} - ${slot.interviewSlotTimeEnd}`,
        result.profile.meetingLink || undefined,
      );
      await sendEmailWithValidation(
        result.profile.user.email,
        ebTemplate.subject,
        ebTemplate.html,
        "Executive Associate interviewer notification",
      );
    } catch (emailError) {
      console.error(
        "Executive Associate schedule email failed",
        emailError instanceof Error ? emailError.name : "UnknownError",
      );
    }

    return NextResponse.json({
      success: true,
      application: result.updatedApplication,
      message: "Interview schedule updated successfully",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const ruleError = getApplicationRuleResponse(error);
    if (ruleError) {
      return NextResponse.json(ruleError.body, { status: ruleError.status });
    }

    const knownErrors: Record<string, { error: string; status: number }> = {
      SCHEDULE_USER_NOT_FOUND: { error: "User not found", status: 404 },
      EA_APPLICATION_NOT_FOUND: {
        error: "Executive Associate application not found",
        status: 404,
      },
      APPLICATION_ALREADY_ACCEPTED: {
        error: "Accepted applications cannot be rescheduled",
        status: 409,
      },
      EA_ROLE_MISMATCH: {
        error: "Interview role does not match the submitted application",
        status: 400,
      },
    };
    if (error instanceof Error && knownErrors[error.message]) {
      const response = knownErrors[error.message];
      return NextResponse.json(
        { error: response.error },
        { status: response.status },
      );
    }

    console.error(
      "Executive Associate schedule update error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
