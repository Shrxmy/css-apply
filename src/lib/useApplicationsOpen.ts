import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";

interface ApplicationBootstrapResponse {
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
  // Share the same bootstrap request used by useApplicationStatus. This avoids
  // a second authenticated API call and duplicate active-cycle query whenever
  // an application page opens.
  const { data, error, isLoading } = useSWR<ApplicationBootstrapResponse>(
    "/api/applications/check-existing",
    (url: string) => swrFetcher(url) as Promise<ApplicationBootstrapResponse>,
    { revalidateOnFocus: false, dedupingInterval: 10000 },
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
