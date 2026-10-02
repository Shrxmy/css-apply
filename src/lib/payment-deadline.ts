import { prisma } from "@/lib/prisma";

export const PAYMENT_REMINDER_RECIPIENT_LIMIT = 250;

export type PaymentPolicy = {
  deadline: string | null;
  closed: boolean;
};

export type PaymentApplicantStatus =
  "no_receipt" | "pending" | "approved" | "needs_revision" | "rejected";

export type PaymentApplicant = {
  id: string;
  studentNumber: string;
  name: string;
  email: string;
  applicationType: "member" | "committee" | "executive-associate";
  position: string;
  redirection: string | null;
  paymentProof: string | null;
  paymentStatus: PaymentApplicantStatus;
  hasSubmittedReceipt: boolean;
  updatedAt: string;
  isLate: boolean;
};

export const paymentPolicyKey = (cycleId: string) =>
  `payment_policy:${cycleId}`;

export function parsePaymentPolicy(value?: string | null): PaymentPolicy {
  if (!value) return { deadline: null, closed: false };

  try {
    const parsed = JSON.parse(value) as {
      deadline?: unknown;
      closed?: unknown;
    };
    const deadline =
      typeof parsed.deadline === "string" &&
      Number.isFinite(Date.parse(parsed.deadline))
        ? new Date(parsed.deadline).toISOString()
        : null;
    return { deadline, closed: parsed.closed === true };
  } catch {
    return { deadline: null, closed: false };
  }
}

export async function getPaymentPolicy(cycleId: string) {
  const config = await prisma.systemConfig.findUnique({
    where: { key: paymentPolicyKey(cycleId) },
    select: { value: true },
  });
  return parsePaymentPolicy(config?.value);
}

function getStatus(
  status: string,
  proof: string | null,
): PaymentApplicantStatus {
  if (status === "approved") return "approved";
  if (status === "pending") return "pending";
  if (status === "needs_revision") return "needs_revision";
  if (status === "rejected") return "rejected";
  if (!proof?.trim() || status === "not_submitted") return "no_receipt";
  return "no_receipt";
}

function statusPriority(status: PaymentApplicantStatus) {
  switch (status) {
    case "approved":
      return 5;
    case "pending":
      return 4;
    case "needs_revision":
    case "rejected":
      return 3;
    case "no_receipt":
      return 1;
  }
}

export async function getAcceptedPaymentApplicants(
  cycleId: string,
  policy: PaymentPolicy,
  now = new Date(),
): Promise<PaymentApplicant[]> {
  const where = { recruitmentCycleId: cycleId, hasAccepted: true };
  const user = {
    select: { studentNumber: true, name: true, email: true },
  } as const;
  const [members, committees, executiveAssociates] = await Promise.all([
    prisma.memberApplication.findMany({
      where,
      select: {
        id: true,
        paymentStatus: true,
        paymentProof: true,
        updatedAt: true,
        user,
      },
    }),
    prisma.committeeApplication.findMany({
      where,
      select: {
        id: true,
        firstOptionCommittee: true,
        redirection: true,
        paymentStatus: true,
        paymentProof: true,
        updatedAt: true,
        user,
      },
    }),
    prisma.executiveAssociateApplication.findMany({
      where,
      select: {
        id: true,
        firstOptionEb: true,
        redirection: true,
        paymentStatus: true,
        paymentProof: true,
        updatedAt: true,
        user,
      },
    }),
  ]);

  const deadlinePassed = Boolean(
    policy.deadline && now.getTime() >= new Date(policy.deadline).getTime(),
  );
  const byStudentNumber = new Map<string, PaymentApplicant>();
  const addApplicant = (record: Omit<PaymentApplicant, "isLate">) => {
    const submittedAfterDeadline = Boolean(
      policy.deadline &&
      Date.parse(record.updatedAt) >= new Date(policy.deadline).getTime(),
    );
    const applicant: PaymentApplicant = {
      ...record,
      isLate:
        deadlinePassed &&
        (record.paymentStatus === "no_receipt" ||
          record.paymentStatus === "needs_revision" ||
          record.paymentStatus === "rejected" ||
          (record.paymentStatus === "pending" && submittedAfterDeadline)),
    };
    const uniqueKey = applicant.studentNumber.trim()
      ? `student:${applicant.studentNumber.trim().toLowerCase()}`
      : `email:${applicant.email.trim().toLowerCase()}`;
    const current = byStudentNumber.get(uniqueKey);
    if (
      !current ||
      statusPriority(applicant.paymentStatus) >
        statusPriority(current.paymentStatus) ||
      (statusPriority(applicant.paymentStatus) ===
        statusPriority(current.paymentStatus) &&
        Date.parse(applicant.updatedAt) > Date.parse(current.updatedAt))
    ) {
      byStudentNumber.set(uniqueKey, applicant);
    }
  };

  for (const application of members) {
    const paymentStatus = getStatus(
      application.paymentStatus,
      application.paymentProof,
    );
    addApplicant({
      id: application.id,
      name: application.user.name,
      email: application.user.email,
      studentNumber: application.user.studentNumber ?? "",
      applicationType: "member",
      position: "Member",
      redirection: null,
      paymentProof: application.paymentProof,
      paymentStatus,
      hasSubmittedReceipt:
        Boolean(application.paymentProof?.trim()) &&
        application.paymentStatus !== "not_submitted",
      updatedAt: application.updatedAt.toISOString(),
    });
  }

  for (const application of committees) {
    const paymentStatus = getStatus(
      application.paymentStatus,
      application.paymentProof,
    );
    addApplicant({
      id: application.id,
      name: application.user.name,
      email: application.user.email,
      studentNumber: application.user.studentNumber ?? "",
      applicationType: "committee",
      position: application.firstOptionCommittee,
      redirection: application.redirection,
      paymentProof: application.paymentProof,
      paymentStatus,
      hasSubmittedReceipt:
        Boolean(application.paymentProof?.trim()) &&
        application.paymentStatus !== "not_submitted",
      updatedAt: application.updatedAt.toISOString(),
    });
  }

  for (const application of executiveAssociates) {
    const paymentStatus = getStatus(
      application.paymentStatus,
      application.paymentProof,
    );
    addApplicant({
      id: application.id,
      name: application.user.name,
      email: application.user.email,
      studentNumber: application.user.studentNumber ?? "",
      applicationType: "executive-associate",
      position: application.firstOptionEb,
      redirection: application.redirection,
      paymentProof: application.paymentProof,
      paymentStatus,
      hasSubmittedReceipt:
        Boolean(application.paymentProof?.trim()) &&
        application.paymentStatus !== "not_submitted",
      updatedAt: application.updatedAt.toISOString(),
    });
  }

  return [...byStudentNumber.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
