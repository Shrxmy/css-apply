import useSWR from "swr";
import { roles as fallbackRoles } from "@/data/ebRoles";
import { swrFetcher } from "@/lib/swr-fetcher";

type EbRole = (typeof fallbackRoles)[number] & {
  meetingLink?: string | null;
  imageUrl?: string | null;
  schoolYear?: string | null;
};

interface EbRolesResponse {
  roles: EbRole[];
  activeCycle: { id: string; schoolYear: string } | null;
}

export function useEbRoles() {
  const { data, error, isLoading } = useSWR<EbRolesResponse>(
    "/api/eb-roles",
    (url: string) => swrFetcher(url) as Promise<EbRolesResponse>,
  );
  const roles: EbRole[] = data?.roles ?? fallbackRoles;

  return {
    roles,
    activeCycle: data?.activeCycle ?? null,
    error,
    isLoading,
  };
}
