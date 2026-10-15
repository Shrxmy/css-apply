import "server-only";

import { z } from "zod";
import { committeeRoles, committeeRolesSubmitted } from "@/data/committeeRoles";
import { EB_ROLE_TO_POSITION_MAP, getPositionTitle } from "@/lib/eb-mapping";
import { prisma } from "@/lib/prisma";
import type {
  EmailCampaignAudience,
  EmailCampaignAudienceRecipient,
  EmailCampaignGroup,
} from "@/lib/email-campaign-contract";

type AudienceDb = Pick<
  typeof prisma,
  | "recruitmentCycle"
  | "memberApplication"
  | "committeeApplication"
  | "executiveAssociateApplication"
>;
type Destination = { group: EmailCampaignGroup; position: string };
type Candidate = Destination & { userId: string; name: string; email: string };
type AudienceUser = { id: string; name: string; email: string };

const groupOrder: EmailCampaignGroup[] = ["ea", "staff", "member"];
const userSelect = { select: { id: true, name: true, email: true } } as const;
const emailSchema = z.string().max(254).email();
const memberDestination: Destination = {
  group: "member",
  position: "Official Member",
};
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function staffDestination(committeeId: string): Destination {
  const committee = committeeRoles.find((item) => item.id === committeeId);
  return {
    group: "staff",
    position: `Staff - ${committee?.title || committeeId}`,
  };
}

function eaDestination(role: string): Destination {
  return {
    group: "ea",
    position: `Executive Associate (${getPositionTitle(role)})`,
  };
}

/** Same canonical destination rules as digital IDs, deliberately WITHOUT payment gating. */
function acceptedDestination(redirection: string | null): Destination | null {
  const target = redirection?.trim().toLowerCase();
  if (!target) return null;
  if (target === "member") return memberDestination;

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
  if (committee) return staffDestination(committee.id);

  const ea = Object.entries(EB_ROLE_TO_POSITION_MAP).find(
    ([id, title]) => id === target || title.toLowerCase() === target,
  );
  return ea ? eaDestination(ea[0]) : null;
}

function addCandidate(
  candidates: Candidate[],
  user: AudienceUser,
  destination: Destination,
): void {
  // Do not let trimming hide an email-header control character in stored data.
  if (
    Array.from(user.email).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159);
    })
  )
    return;
  const email = user.email.trim().toLowerCase();
  if (!user.id || !emailSchema.safeParse(email).success) return;
  candidates.push({
    userId: user.id,
    name: user.name.trim() || email,
    email,
    ...destination,
  });
}

function deduplicate(
  candidates: Candidate[],
): EmailCampaignAudienceRecipient[] {
  // Connected components, not independent email/id maps: a case-duplicate
  // account may bridge two rows already seen under different user IDs/emails.
  const parents = candidates.map((_, index) => index);
  const root = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const byUser = new Map<string, number>();
  const byEmail = new Map<string, number>();
  candidates.forEach((candidate, index) => {
    for (const [map, key] of [
      [byUser, candidate.userId],
      [byEmail, candidate.email],
    ] as const) {
      const existing = map.get(key);
      if (existing !== undefined) parents[root(index)] = root(existing);
      else map.set(key, index);
    }
  });

  const components = new Map<number, Candidate[]>();
  candidates.forEach((candidate, index) => {
    const key = root(index);
    const component = components.get(key);
    if (component) component.push(candidate);
    else components.set(key, [candidate]);
  });

  return Array.from(components.values())
    .map((component) => {
      // Always retain a real accepted user's ID/email pair. Lexical ordering makes
      // the representative stable even when the database returns a different order.
      component.sort(
        (a, b) =>
          compare(a.userId, b.userId) ||
          compare(a.email, b.email) ||
          compare(a.name, b.name),
      );
      const representative = component[0];
      const groups = new Set(component.map((candidate) => candidate.group));
      return {
        userId: representative.userId,
        name: representative.name,
        email: representative.email,
        groups: groupOrder.filter((group) => groups.has(group)),
        positions: Array.from(
          new Set(component.map((candidate) => candidate.position)),
        ).sort(compare),
      };
    })
    .sort((a, b) => compare(a.email, b.email) || compare(a.userId, b.userId));
}

/** Read-only eligibility snapshot. Callers must enforce Super Admin authorization. */
export async function getEmailCampaignAudience(
  db: AudienceDb = prisma,
): Promise<EmailCampaignAudience> {
  const cycle = await db.recruitmentCycle.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, schoolYear: true },
  });
  if (!cycle)
    return {
      cycle: null,
      counts: { ea: 0, staff: 0, member: 0 },
      recipients: [],
    };

  const where = { hasAccepted: true, recruitmentCycleId: cycle.id };
  const [members, staff, eas] = await Promise.all([
    db.memberApplication.findMany({
      where,
      select: { user: userSelect },
    }),
    db.committeeApplication.findMany({
      where,
      select: {
        user: userSelect,
        redirection: true,
        firstOptionCommittee: true,
      },
    }),
    db.executiveAssociateApplication.findMany({
      where,
      select: {
        user: userSelect,
        redirection: true,
        ebRole: true,
        firstOptionEb: true,
      },
    }),
  ]);

  const candidates: Candidate[] = [];
  for (const application of members)
    addCandidate(candidates, application.user, memberDestination);
  for (const application of staff) {
    addCandidate(
      candidates,
      application.user,
      acceptedDestination(application.redirection) ??
        staffDestination(application.firstOptionCommittee),
    );
  }
  for (const application of eas) {
    addCandidate(
      candidates,
      application.user,
      acceptedDestination(application.redirection) ??
        eaDestination(application.ebRole || application.firstOptionEb),
    );
  }

  const recipients = deduplicate(candidates);
  const counts: EmailCampaignAudience["counts"] = {
    ea: 0,
    staff: 0,
    member: 0,
  };
  for (const recipient of recipients) {
    for (const group of recipient.groups) counts[group] += 1;
  }
  return { cycle, counts, recipients };
}
