// Mapping between EB role IDs (used in URLs and assignments) and position titles (stored in database)
export const EB_ROLE_TO_POSITION_MAP: Record<string, string> = {
  president: "President",
  "internal-vice-president": "Internal Vice President",
  "external-vice-president": "External Vice President",
  secretary: "Secretary",
  "assistant-secretary": "Assistant Secretary",
  treasurer: "Treasurer",
  auditor: "Auditor",
  "public-relations-officer": "Public Relations Officer (PRO)",
  "representative-4th-year": "4th Year Representative",
  "representative-3rd-year": "3rd Year Representative",
  "representative-2nd-year": "2nd Year Representative",
  "representative-1st-year": "1st Year Representative",
  "chief-of-staff": "Chief of Staff",
  "director-digital-productions": "Director for Digital Productions",
  "director-community-development": "Director for Community Development",
  "thomasian-wellness-advocate": "Thomasian Wellness Advocate (TWA)",
};

/**
 * Converts an EB role ID to the corresponding position title
 * @param roleId - The EB role ID (e.g., "president", "internal-vice-president")
 * @returns The position title (e.g., "President", "Internal Vice President") or the original roleId if not found
 */
export function getPositionTitle(roleId: string): string {
  return EB_ROLE_TO_POSITION_MAP[roleId] || roleId;
}

/**
 * Converts a position title to the corresponding EB role ID
 * @param positionTitle - The position title (e.g., "President", "Internal Vice President")
 * @returns The EB role ID (e.g., "president", "internal-vice-president") or the original title if not found
 */
export function getRoleId(positionTitle: string): string {
  const entry = Object.entries(EB_ROLE_TO_POSITION_MAP).find(
    ([, title]) => title === positionTitle,
  );
  return entry ? entry[0] : positionTitle;
}

/**
 * Converts a role ID to the corresponding position title (inverse of getRoleId)
 * @param roleId - The EB role ID (e.g., "president", "internal-vice-president")
 * @returns The position title (e.g., "President", "Internal Vice President") or the original roleId if not found
 */
export function getPositionFromRoleId(roleId: string): string {
  const entry = Object.entries(EB_ROLE_TO_POSITION_MAP).find(
    ([id]) => id === roleId,
  );
  return entry ? entry[1] : roleId;
}
