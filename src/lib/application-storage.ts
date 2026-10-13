export const APPLICATION_STORAGE_BUCKETS = {
  executiveAssociate: "ea-applications",
  committee: "committee-applications",
} as const;

// Applicant uploads live under applications/<studentNumber>/; anything else belongs to someone else.
export function isOwnApplicationFile(path: string, studentNumber: string) {
  return (
    path.startsWith(`applications/${studentNumber}/`) && !path.includes("..")
  );
}
