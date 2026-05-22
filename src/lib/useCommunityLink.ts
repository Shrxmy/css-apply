import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";

interface CommunityLinkResponse {
  enabled: boolean;
  url: string;
  label: string;
}

export function useCommunityLink() {
  const { data, error, isLoading, mutate } = useSWR<CommunityLinkResponse>(
    "/api/community-link",
    (url: string) => swrFetcher(url) as Promise<CommunityLinkResponse>,
  );

  return {
    communityEnabled: data?.enabled !== false,
    communityUrl: data?.url?.trim() || "",
    communityLabel: data?.label?.trim() || "Join Community Group",
    error,
    isLoading,
    mutate,
  };
}
