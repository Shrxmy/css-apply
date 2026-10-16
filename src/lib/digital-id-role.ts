import { committeeRoles, committeeRolesSubmitted } from "@/data/committeeRoles";
import { EB_ROLE_TO_POSITION_MAP, getPositionTitle } from "@/lib/eb-mapping";

type DigitalIdRole = {
  applicationType: "member" | "committee" | "ea";
  roleTitle: string;
};

type RedirectableApplication = {
  paymentStatus: string;
  hasAccepted: boolean;
  redirection: string | null;
};

type DigitalIdApplications = {
  memberApplications: Array<{ paymentStatus: string }>;
  committeeApplications: Array<
    RedirectableApplication & { firstOptionCommittee: string }
  >;
  executiveAssociateApplications: Array<
    RedirectableApplication & { ebRole: string; firstOptionEb: string }
  >;
};

const MEMBER_ROLE: DigitalIdRole = {
  applicationType: "member",
  roleTitle: "Official Member",
};

function committeeRole(committeeId: string): DigitalIdRole {
  const committee = committeeRoles.find((item) => item.id === committeeId);
  return {
    applicationType: "committee",
    roleTitle: `Staff - ${committee?.title || committeeId}`,
  };
}

function eaRole(roleId: string): DigitalIdRole {
  return {
    applicationType: "ea",
    roleTitle: `Executive Associate (${getPositionTitle(roleId)})`,
  };
}

export function acceptedDestination(
  application: RedirectableApplication,
): DigitalIdRole | null {
  // The source stays canonical after acceptance; its original choice is history,
  // not the member's final role. Pending offers must not change their role.
  if (!application.hasAccepted || !application.redirection) return null;
  const target = application.redirection.trim().toLowerCase();
  if (target === "member") return MEMBER_ROLE;

  const committeeTarget = target.startsWith("committee-")
    ? target.slice("committee-".length)
    : target;
  const committee = committeeRoles.find(
    (item) =>
      item.id === committeeTarget ||
      item.title.toLowerCase() === committeeTarget ||
      committeeRolesSubmitted.some(
        (submitted) =>
          submitted.id === item.id &&
          submitted.title.toLowerCase() === committeeTarget,
      ),
  );
  if (committee) return committeeRole(committee.id);

  const ea = Object.entries(EB_ROLE_TO_POSITION_MAP).find(
    ([id, title]) => id === target || title.toLowerCase() === target,
  );
  return ea ? eaRole(ea[0]) : null;
}

/** Preserve existing payment gating and precedence, but use the accepted destination. */
export function getApprovedDigitalIdRole(
  user: DigitalIdApplications,
): DigitalIdRole | null {
  const ea = user.executiveAssociateApplications[0];
  if (ea?.paymentStatus === "approved") {
    return acceptedDestination(ea) ?? eaRole(ea.ebRole || ea.firstOptionEb);
  }

  const committee = user.committeeApplications[0];
  if (committee?.paymentStatus === "approved") {
    return (
      acceptedDestination(committee) ??
      committeeRole(committee.firstOptionCommittee)
    );
  }

  return user.memberApplications[0]?.paymentStatus === "approved"
    ? MEMBER_ROLE
    : null;
}
