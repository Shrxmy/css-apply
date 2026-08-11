import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";

interface ActiveRecruitmentCycleResponse {
  activeCycle: {
    applicationStart: string;
    interviewEnd: string;
  } | null;
}

const toDateOnlyTimestamp = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const getTodayDateOnlyTimestamp = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

export function useApplicationsOpenState(redirectTo?: string) {
  const router = useRouter();
  const { data, error, isLoading } = useSWR<ActiveRecruitmentCycleResponse>(
    "/api/recruitment-cycle/active",
    (url: string) => swrFetcher(url) as Promise<ActiveRecruitmentCycleResponse>,
    { revalidateOnFocus: false },
  );

  const activeCycle = data?.activeCycle ?? null;
  const today = getTodayDateOnlyTimestamp();
  const isOpen =
    !isLoading &&
    !error &&
    !!activeCycle &&
    toDateOnlyTimestamp(activeCycle.applicationStart) <= today &&
    today <= toDateOnlyTimestamp(activeCycle.interviewEnd);

  useEffect(() => {
    if (!isLoading && !error && !isOpen && redirectTo) {
      router.push(redirectTo);
    }
  }, [error, isLoading, isOpen, redirectTo, router]);

  return { isOpen, isLoading, error };
}

export function useApplicationsOpen(redirectTo?: string) {
  const { isOpen, isLoading } = useApplicationsOpenState(redirectTo);
  return isLoading ? true : isOpen;
}
