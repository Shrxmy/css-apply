import useSWR from "swr";

interface ApplicationStatusData {
  hasMemberApplication: boolean;
  hasCommitteeApplication: boolean;
  hasExecutiveAssociateApplication: boolean;
  applications: {
    member: { id: string } | null;
    committee: { id: string; firstOptionCommittee: string } | null;
    ea: { id: string; firstOptionEb: string } | null;
  };
  ebRole?: string;
  committeeId?: string;
}

/**
 * SWR hook for checking application status.
 * Automatically deduplicates requests across components and pages.
 * Cache key: "/api/applications/check-existing"
 */
export function useApplicationStatus(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<ApplicationStatusData>(
    enabled ? "/api/applications/check-existing" : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000, // 10s dedup
      errorRetryCount: 2,
    },
  );

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
    // Derived helpers
    hasAnyApplication: data
      ? data.hasMemberApplication ||
        data.hasCommitteeApplication ||
        data.hasExecutiveAssociateApplication
      : false,
  };
}
