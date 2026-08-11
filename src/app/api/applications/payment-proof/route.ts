import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailTemplates } from "@/lib/email";
import { ensureCycleMemberId } from "@/lib/member-id";
import { paymentProofSchema } from "@/lib/schemas";
import {
  getActiveCycle,
  getApplicationRuleResponse,
  isGoogleDriveUrl,
} from "@/lib/application-rules";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = paymentProofSchema.safeParse(await request.json());
    if (!parsed.success || !isGoogleDriveUrl(parsed.data?.paymentProof ?? "")) {
      return NextResponse.json(
        { error: "A valid Google Drive receipt link is required" },
        { status: 400 },
      );
    }

    const cycle = await getActiveCycle();
    const proof = parsed.data.paymentProof.trim();
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email: session.user.email! },
        include: {
          memberApplications: {
            where: { recruitmentCycleId: cycle.id, hasAccepted: true },
            take: 2,
          },
          committeeApplications: {
            where: { recruitmentCycleId: cycle.id, hasAccepted: true },
            take: 2,
          },
          executiveAssociateApplications: {
            where: { recruitmentCycleId: cycle.id, hasAccepted: true },
            take: 2,
          },
        },
      });
      if (!user) throw new Error("PAYMENT_USER_NOT_FOUND");

      const acceptedApplications = [
        ...user.memberApplications.map((application) => ({
          id: application.id,
          type: "member" as const,
        })),
        ...user.committeeApplications.map((application) => ({
          id: application.id,
          type: "committee" as const,
        })),
        ...user.executiveAssociateApplications.map((application) => ({
          id: application.id,
          type: "executive-associate" as const,
        })),
      ];

      if (acceptedApplications.length === 0) {
        throw new Error("NO_ACCEPTED_APPLICATION");
      }
      if (acceptedApplications.length > 1) {
        throw new Error("MULTIPLE_ACCEPTED_APPLICATIONS");
      }

      const application = acceptedApplications[0];
      if (application.type === "member") {
        await tx.memberApplication.update({
          where: { id: application.id },
          data: { paymentProof: proof },
        });
      } else if (application.type === "committee") {
        await tx.committeeApplication.update({
          where: { id: application.id },
          data: { paymentProof: proof },
        });
      } else {
        await tx.executiveAssociateApplication.update({
          where: { id: application.id },
          data: { paymentProof: proof },
        });
      }

      const memberId = await ensureCycleMemberId(tx, user.id, cycle.id);
      return { memberId, user };
    });

    try {
      const template = emailTemplates.memberIdReleased(
        result.user.name || "Valued Member",
        result.memberId,
      );
      await sendEmail(result.user.email, template.subject, template.html);
    } catch (emailError) {
      console.error(
        "Member ID email failed",
        emailError instanceof Error ? emailError.name : "UnknownError",
      );
    }

    return NextResponse.json({
      success: true,
      paymentProof: proof,
      memberId: result.memberId,
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
      PAYMENT_USER_NOT_FOUND: { error: "User not found", status: 404 },
      NO_ACCEPTED_APPLICATION: {
        error: "No accepted application found",
        status: 404,
      },
      MULTIPLE_ACCEPTED_APPLICATIONS: {
        error: "Multiple accepted applications require administrator review",
        status: 409,
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
      "Payment proof submission error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
