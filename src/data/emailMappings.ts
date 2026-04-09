import { roles } from "./ebRoles";
import { getRoleId } from "@/lib/eb-mapping";

// Comprehensive email mapping for all EB members
export const EB_EMAIL_MAPPINGS = {
  // Executive Board Members
  "Genna Cervantes": "genna.cervantes.cics@ust.edu.ph",
  "Mar Vincent De Guzman": "marvincent.deguzman.cics@ust.edu.ph",
  "Christian Bhernan Buenagua": "christianbhernan.buenagua.cics@ust.edu.ph",
  "Joevanni Paulo Gumban": "joevannipaulo.gumban.cics@ust.edu.ph",
  "Marian Therese Pineza": "mariantherese.pineza.cics@ust.edu.ph",
  "Braven Rei Goodwin": "bravenrei.goodwin.cics@ust.edu.ph",
  "Kendrick Beau Calvo": "kendrickbeau.calvo.cics@ust.edu.ph",
  "Nigel Roland Anunciacion": "nigelroland.anunciacion.cics@ust.edu.ph",
  "Alexandra Antonette Palanog": "alexandraantonette.palanog.cics@ust.edu.ph",
  "Nikolas Josef Dalisay": "nikolasjosef.dalisay.cics@ust.edu.ph",
  "Chrisry Clerry Hermoso": "chrisryclerry.hermoso.cics@ust.edu.ph",
  "John Carlo Benter": "johncarlo.benter.cics@ust.edu.ph",
  "Carylle Keona Ilano": "caryllekeona.ilano.cics@ust.edu.ph",
  "Charmaine Chesca Villalobos": "charmainechesca.villalobos.cics@ust.edu.ph",
  "Zeandarra Gaile Giva": "zeandarragaile.giva.cics@ust.edu.ph",
  "Andrea Pauline Tan": "andreapauline.tan.cics@ust.edu.ph",

  // Alternative name formats (in case of variations)
  "Mar Vincent de Guzman": "marvincent.deguzman.cics@ust.edu.ph", // Alternative capitalization
} as const;

// Role ID to email mapping for direct lookup
export const ROLE_ID_TO_EMAIL_MAPPINGS = {
  president: "genna.cervantes.cics@ust.edu.ph",
  "internal-vice-president": "marvincent.deguzman.cics@ust.edu.ph",
  "external-vice-president": "christianbhernan.buenagua.cics@ust.edu.ph",
  secretary: "joevannipaulo.gumban.cics@ust.edu.ph",
  "assistant-secretary": "mariantherese.pineza.cics@ust.edu.ph",
  treasurer: "bravenrei.goodwin.cics@ust.edu.ph",
  auditor: "kendrickbeau.calvo.cics@ust.edu.ph",
  "public-relations-officer": "nigelroland.anunciacion.cics@ust.edu.ph",
  "representative-4th-year": "alexandraantonette.palanog.cics@ust.edu.ph",
  "representative-3rd-year": "nikolasjosef.dalisay.cics@ust.edu.ph",
  "representative-2nd-year": "chrisryclerry.hermoso.cics@ust.edu.ph",
  "representative-1st-year": "johncarlo.benter.cics@ust.edu.ph",
  "chief-of-staff": "caryllekeona.ilano.cics@ust.edu.ph",
  "director-digital-productions": "charmainechesca.villalobos.cics@ust.edu.ph",
  "director-community-development": "zeandarragaile.giva.cics@ust.edu.ph",
  "thomasian-wellness-advocate": "andreapauline.tan.cics@ust.edu.ph",
} as const;

// Admin and system emails
export const ADMIN_EMAILS = {
  PRESIDENT: "joevannipaulo.gumban.cics@ust.edu.ph",
  SYSTEM_ADMIN: "joevannipaulo.gumban.cics@ust.edu.ph", // Fallback for system issues
  TECHNICAL_SUPPORT: "joevannipaulo.gumban.cics@ust.edu.ph", // Technical issues
} as const;

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@ust\.edu\.ph$/;

/**
 * Validates if an email address is in the correct UST format
 */
export function isValidUSTEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Gets email address by role ID with comprehensive fallback system
 */
export function getEmailByRoleId(roleId: string): string | null {
  // First try direct role ID mapping
  if (
    ROLE_ID_TO_EMAIL_MAPPINGS[roleId as keyof typeof ROLE_ID_TO_EMAIL_MAPPINGS]
  ) {
    return ROLE_ID_TO_EMAIL_MAPPINGS[
      roleId as keyof typeof ROLE_ID_TO_EMAIL_MAPPINGS
    ];
  }

  // Try to find role and get email by name
  const role = roles.find((r) => r.id === roleId);
  if (role) {
    return getEmailByName(role.ebName);
  }

  console.warn(`No email mapping found for role ID: ${roleId}`);
  return null;
}

/**
 * Gets email address by EB member name with fuzzy matching
 */
export function getEmailByName(name: string): string | null {
  if (!name) {
    console.warn("Empty name provided to getEmailByName");
    return null;
  }

  // Direct lookup
  if (EB_EMAIL_MAPPINGS[name as keyof typeof EB_EMAIL_MAPPINGS]) {
    return EB_EMAIL_MAPPINGS[name as keyof typeof EB_EMAIL_MAPPINGS];
  }

  // Try fuzzy matching (case insensitive)
  const lowerName = name.toLowerCase().trim();
  const foundEntry = Object.entries(EB_EMAIL_MAPPINGS).find(
    ([key]) => key.toLowerCase().trim() === lowerName,
  );

  if (foundEntry) {
    return foundEntry[1];
  }

  console.warn(`No email mapping found for name: "${name}"`);
  return null;
}

/**
 * Gets email address by position title (fallback for committee staff interviews)
 */
export function getEmailByPositionTitle(positionTitle: string): string | null {
  if (!positionTitle) {
    console.warn("Empty position title provided to getEmailByPositionTitle");
    return null;
  }

  // Map position titles to role IDs, then get email
  const roleId = getRoleId(positionTitle);
  if (roleId !== positionTitle) {
    return getEmailByRoleId(roleId);
  }

  console.warn(
    `No role ID mapping found for position title: "${positionTitle}"`,
  );
  return null;
}

/**
 * Gets email address with comprehensive fallback system
 * This is the main function that should be used throughout the application
 */
export function getEBEmailWithFallback(
  roleId: string,
  context?: string,
): string {
  // Try role ID mapping first
  const roleEmail = getEmailByRoleId(roleId);
  if (roleEmail && isValidUSTEmail(roleEmail)) {
    return roleEmail;
  }

  // Try name-based mapping
  const role = roles.find((r) => r.id === roleId);
  if (role) {
    const nameEmail = getEmailByName(role.ebName);
    if (nameEmail && isValidUSTEmail(nameEmail)) {
      return nameEmail;
    }
  }

  // Try position title mapping (fallback for committee staff interviews)
  const positionEmail = getEmailByPositionTitle(roleId);
  if (positionEmail && isValidUSTEmail(positionEmail)) {
    return positionEmail;
  }

  // Log detailed failure information
  console.error(`Email lookup failed for role ID: ${roleId}`, {
    roleFound: !!role,
    roleName: role?.ebName,
    roleIdMapping:
      ROLE_ID_TO_EMAIL_MAPPINGS[
        roleId as keyof typeof ROLE_ID_TO_EMAIL_MAPPINGS
      ],
    nameMapping: role
      ? EB_EMAIL_MAPPINGS[role.ebName as keyof typeof EB_EMAIL_MAPPINGS]
      : "N/A",
    positionMapping:
      getRoleId(roleId) !== roleId ? "Position title detected" : "N/A",
    context: context || "unknown",
    timestamp: new Date().toISOString(),
  });

  // Throw error to be handled by calling code
  throw new Error(
    `No valid email found for role ID: ${roleId}. Please check email mappings.`,
  );
}

/**
 * Gets all available email mappings for debugging
 */
export function getAllEmailMappings() {
  return {
    roleIdMappings: ROLE_ID_TO_EMAIL_MAPPINGS,
    nameMappings: EB_EMAIL_MAPPINGS,
    adminEmails: ADMIN_EMAILS,
    totalMappings:
      Object.keys(EB_EMAIL_MAPPINGS).length +
      Object.keys(ROLE_ID_TO_EMAIL_MAPPINGS).length,
  };
}

/**
 * Validates all email mappings
 */
export function validateAllEmailMappings(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate role ID mappings
  Object.entries(ROLE_ID_TO_EMAIL_MAPPINGS).forEach(([roleId, email]) => {
    if (!isValidUSTEmail(email)) {
      errors.push(`Invalid email format for role ${roleId}: ${email}`);
    }
  });

  // Validate name mappings
  Object.entries(EB_EMAIL_MAPPINGS).forEach(([name, email]) => {
    if (!isValidUSTEmail(email)) {
      errors.push(`Invalid email format for name ${name}: ${email}`);
    }
  });

  // Check if all roles have email mappings
  roles.forEach((role) => {
    const email = getEmailByRoleId(role.id);
    if (!email) {
      errors.push(
        `No email mapping found for role: ${role.id} (${role.ebName})`,
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
