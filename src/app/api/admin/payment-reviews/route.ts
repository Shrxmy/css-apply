import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCycle, getApplicationRuleResponse } from "@/lib/application-rules";
import { paymentReviewActionSchema } from "@/lib/schemas";
import { ensureCycleMemberId } from "@/lib/member-id";
import { emailTemplates, sendEmail } from "@/lib/email";
import { committeeRoles } from "@/data/committeeRoles";
import { roles } from "@/data/ebRoles";

const REVIEW_STATUSES = new Set(["pending", "approved", "rejected"]);
const PAYMENT_REVIEW_POSITIONS = new Set([
  "president",
  "treasurer",
  "auditor",
]);

function committeeName(id: string) {
  return committeeRoles.find((committee) => committee.id === id)?.title ?? id;
}

function executiveBoardRoleName(id: string) {
  return roles.find((role) => role.id === id)?.title ?? id;
}

async function authorizePaymentReviewer(
  email: string,
  recruitmentCycleId: string,
) {
  const reviewer = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      ebProfile: {
        select: {
          position: true,
          isActive: true,
          recruitmentCycleId: true,
        },
      },
    },
  });

  const isSuperAdmin =
    reviewer?.role === "super_admin" || reviewer?.role === "super-admin";
  const isAuthorizedActiveEb =
    reviewer?.role === "admin" &&
    reviewer.ebProfile?.isActive === true &&
    reviewer.ebProfile.recruitmentCycleId === recruitmentCycleId &&
    PAYMENT_REVIEW_POSITIONS.has(
      reviewer.ebProfile.position.trim().toLowerCase(),
    );

  return reviewer && (isSuperAdmin || isAuthorizedActiveEb) ? reviewer : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cycle = await getActiveCycle();
    const reviewer = await authorizePaymentReviewer(
      session.user.email,
      cycle.id,
    );
    if (!reviewer) {
      return NextResponse.json(
        {
          error:
            "Only the active President, Treasurer, Auditor, or Super Admin can review receipts",
        },
        { status: 403 },
      );
    }

    const requestedStatus =
      request.nextUrl.searchParams.get("status")?.toLowerCase() ?? "pending";
    if (!REVIEW_STATUSES.has(requestedStatus)) {
      return NextResponse.json({ error: "Invalid review status" }, { status: 400 });
    }

    const applicationWhere = {
      recruitmentCycleId: cycle.id,
      hasAccepted: true,
      paymentStatus: requestedStatus,
    };
    const userSelect = {
      id: true,
      name: true,
      email: true,
      studentNumber: true,
      section: true,
      memberships: {
        where: { recruitmentCycleId: cycle.id },
        select: { memberId: true },
        take: 1,
      },
    } satisfies Prisma.UserSelect;

    const [members, committees, executiveAssociates] = await Promise.all([
      prisma.memberApplication.findMany({
        where: applicationWhere,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          paymentProof: true,
          paymentStatus: true,
          paymentReviewedAt: true,
          paymentReviewedBy: true,
          paymentRejectionReason: true,
          updatedAt: true,
          user: { select: userSelect },
        },
      }),
      prisma.committeeApplication.findMany({
        where: applicationWhere,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          paymentProof: true,
          paymentStatus: true,
          paymentReviewedAt: true,
          paymentReviewedBy: true,
          paymentRejectionReason: true,
          updatedAt: true,
          firstOptionCommittee: true,
          user: { select: userSelect },
        },
      }),
      prisma.executiveAssociateApplication.findMany({
        where: applicationWhere,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          paymentProof: true,
          paymentStatus: true,
          paymentReviewedAt: true,
          paymentReviewedBy: true,
          paymentRejectionReason: true,
          updatedAt: true,
          firstOptionEb: true,
          user: { select: userSelect },
        },
      }),
    ]);

    const reviews = [
      ...members.map((application) => ({
        ...application,
        applicationType: "member" as const,
        acceptedAs: "Member",
      })),
      ...committees.map((application) => ({
        ...application,
        applicationType: "committee" as const,
        acceptedAs: committeeName(application.firstOptionCommittee),
        firstOptionCommittee: undefined,
      })),
      ...executiveAssociates.map((application) => ({
        ...application,
        applicationType: "executive-associate" as const,
        acceptedAs: executiveBoardRoleName(application.firstOptionEb),
        firstOptionEb: undefined,
      })),
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const reviewerIds = [...new Set(reviews.flatMap((review) =>
      review.paymentReviewedBy ? [review.paymentReviewedBy] : [],
    ))];
    const reviewerNames = reviewerIds.length
      ? Object.fromEntries(
          (
            await prisma.user.findMany({
              where: { id: { in: reviewerIds } },
              select: { id: true, name: true },
            })
          ).map((user) => [user.id, user.name]),
        )
      : {};

    return NextResponse.json({
      schoolYear: cycle.schoolYear,
      reviews: reviews.map((review) => ({
        ...review,
        reviewedByName: review.paymentReviewedBy
          ? reviewerNames[review.paymentReviewedBy] ?? "Administrator"
          : null,
      })),
    });
  } catch (error) {
    const ruleError = getApplicationRuleResponse(error);
    if (ruleError) {
      return NextResponse.json(ruleError.body, { status: ruleError.status });
    }
    console.error(
      "Get payment reviews failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cycle = await getActiveCycle();
    const reviewer = await authorizePaymentReviewer(
      session.user.email,
      cycle.id,
    );
    if (!reviewer) {
      return NextResponse.json(
        {
          error:
            "Only the active President, Treasurer, Auditor, or Super Admin can review receipts",
        },
        { status: 403 },
      );
    }

    const parsed = paymentReviewActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid review action" },
        { status: 400 },
      );
    }

    const { applicationId, applicationType, action, rejectionReason } = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const lockKey = `payment-review:${cycle.id}:${applicationType}:${applicationId}`;
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `);

      const baseWhere = {
        id: applicationId,
        recruitmentCycleId: cycle.id,
        hasAccepted: true,
      };
      let application: {
        paymentStatus: string;
        paymentProof: string | null;
        user: { id: string; name: string; email: string };
      } | null = null;

      if (applicationType === "member") {
        application = await tx.memberApplication.findFirst({
          where: baseWhere,
          select: {
            paymentStatus: true,
            paymentProof: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });
      } else if (applicationType === "committee") {
        application = await tx.committeeApplication.findFirst({
          where: baseWhere,
          select: {
            paymentStatus: true,
            paymentProof: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });
      } else {
        application = await tx.executiveAssociateApplication.findFirst({
          where: baseWhere,
          select: {
            paymentStatus: true,
            paymentProof: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });
      }

      if (!application) throw new Error("REVIEW_APPLICATION_NOT_FOUND");
      if (!application.paymentProof?.trim()) throw new Error("RECEIPT_NOT_SUBMITTED");
      if (application.paymentStatus !== "pending") {
        throw new Error("RECEIPT_ALREADY_REVIEWED");
      }

      const reviewData = {
        paymentStatus: action === "approve" ? "approved" : "rejected",
        paymentReviewedAt: new Date(),
        paymentReviewedBy: reviewer.id,
        paymentRejectionReason:
          action === "reject" ? rejectionReason!.trim() : null,
      };
      if (applicationType === "member") {
        await tx.memberApplication.update({ where: { id: applicationId }, data: reviewData });
      } else if (applicationType === "committee") {
        await tx.committeeApplication.update({ where: { id: applicationId }, data: reviewData });
      } else {
        await tx.executiveAssociateApplication.update({
          where: { id: applicationId },
          data: reviewData,
        });
      }

      const memberId =
        action === "approve"
          ? await ensureCycleMemberId(tx, application.user.id, cycle.id)
          : null;
      return { action, memberId, user: application.user };
    });

    if (result.action === "approve" && result.memberId) {
      try {
        const template = emailTemplates.memberIdReleased(
          result.user.name || "Valued Member",
          result.memberId,
        );
        await sendEmail(result.user.email, template.subject, template.html);
      } catch (emailError) {
        console.error(
          "Member ID approval email failed",
          emailError instanceof Error ? emailError.name : "UnknownError",
        );
      }
    }

    return NextResponse.json({
      success: true,
      paymentStatus: result.action === "approve" ? "approved" : "rejected",
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
      REVIEW_APPLICATION_NOT_FOUND: {
        error: "Accepted application not found in the active cycle",
        status: 404,
      },
      RECEIPT_NOT_SUBMITTED: {
        error: "No acknowledgement receipt was submitted",
        status: 409,
      },
      RECEIPT_ALREADY_REVIEWED: {
        error: "This acknowledgement receipt is no longer pending",
        status: 409,
      },
    };
    if (error instanceof Error && knownErrors[error.message]) {
      const response = knownErrors[error.message];
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    console.error(
      "Review payment receipt failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
