/**
 * Parses a full name into first name and last name, properly handling Filipino surnames with spaces
 * Examples: "Juan De Guzman" -> firstName: "Juan", lastName: "De Guzman"
 *          "Maria Santos Cruz" -> firstName: "Maria", lastName: "Santos Cruz"
 *          "Jose Dela Cruz" -> firstName: "Jose", lastName: "Dela Cruz"
 */

interface ParsedName {
  firstName: string;
  lastName: string;
}

// Common Filipino surname prefixes that should be kept with the surname
const FILIPINO_SURNAME_PREFIXES = [
  "de",
  "del",
  "dela",
  "den",
  "der",
  "des",
  "di",
  "du",
  "van",
  "von",
  "da",
  "dos",
  "das",
  "la",
  "le",
  "los",
  "las",
];

export function parseFullName(fullName: string): ParsedName {
  if (!fullName) return { firstName: "", lastName: "" };

  const trimmedName = fullName.trim();
  if (!trimmedName) return { firstName: "", lastName: "" };

  const nameParts = trimmedName.split(/\s+/);

  if (nameParts.length === 1) {
    // Only one name provided, treat as first name
    return { firstName: nameParts[0], lastName: "" };
  }

  if (nameParts.length === 2) {
    // Simple case: "Juan Santos" -> firstName: "Juan", lastName: "Santos"
    return { firstName: nameParts[0], lastName: nameParts[1] };
  }

  // For names with 3+ parts, we need to determine where the surname starts
  // Common patterns:
  // - "Juan De Guzman" -> firstName: "Juan", lastName: "De Guzman"
  // - "Maria Santos Cruz" -> firstName: "Maria Santos", lastName: "Cruz"
  // - "Jose Dela Cruz" -> firstName: "Jose", lastName: "Dela Cruz"
  // - "Juan Carlos De La Torre" -> firstName: "Juan Carlos", lastName: "De La Torre"
  // - "Ana De Los Santos" -> firstName: "Ana", lastName: "De Los Santos"

  // Look for surname prefixes starting from the second word
  for (let i = 1; i < nameParts.length; i++) {
    const word = nameParts[i].toLowerCase();
    if (FILIPINO_SURNAME_PREFIXES.includes(word)) {
      // Found a surname prefix, everything from this point is the surname
      const firstName = nameParts.slice(0, i).join(" ");
      const lastName = nameParts.slice(i).join(" ");
      return { firstName, lastName };
    }
  }

  // No surname prefixes found, assume last word is surname
  // This handles cases like "Joevanni Paulo Gumban" where "Gumban" is the surname
  if (nameParts.length >= 3) {
    const firstName = nameParts.slice(0, -1).join(" ");
    const lastName = nameParts[nameParts.length - 1];
    return { firstName, lastName };
  }

  // Fallback: first word as first name, rest as last name
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  return { firstName, lastName };
}
