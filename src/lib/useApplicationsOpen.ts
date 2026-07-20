import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

const swrFetcher = (url: string) => fetch(url).then((r) => r.json());

const toDateOnlyTimestamp = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const getTodayDateOnlyTimestamp = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Applications are open if there's an active cycle and today's date is within
 * the application start and interview end window, inclusive.
 * Returns `true` while loading (don't block during fetch).
 *
 * If `redirectTo` is provided, automatically redirects to that route when applications are closed.
 */
export function useApplicationsOpen(redirectTo?: string) {
  const router = useRouter();
  const { data, isLoading } = useSWR<{
    activeCycle: { applicationStart: string; interviewEnd: string } | null;
  }>("/api/admin/recruitment-cycle", swrFetcher, { revalidateOnFocus: false });

  const activeCycle = data?.activeCycle ?? null;
  const today = getTodayDateOnlyTimestamp();
  const isOpen =
    !isLoading &&
    !!activeCycle &&
    toDateOnlyTimestamp(activeCycle.applicationStart) <= today &&
    today <= toDateOnlyTimestamp(activeCycle.interviewEnd);

  useEffect(() => {
    if (!isLoading && !isOpen && redirectTo) {
      router.push(redirectTo);
    }
  }, [isLoading, isOpen, redirectTo, router]);

  if (isLoading) return true; // Don't block while loading

  return isOpen;
}
