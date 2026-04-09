import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

const swrFetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Returns whether applications are currently open based on the active recruitment cycle.
 * Applications are open if there's an active cycle AND the interview end date hasn't passed.
 * Returns `true` while loading (don't block during fetch).
 *
 * If `redirectTo` is provided, automatically redirects to that route when applications are closed.
 */
export function useApplicationsOpen(redirectTo?: string) {
  const router = useRouter();
  const { data, isLoading } = useSWR<{
    activeCycle: { interviewEnd: string } | null;
  }>("/api/admin/recruitment-cycle", swrFetcher, { revalidateOnFocus: false });

  const activeCycle = data?.activeCycle ?? null;
  const isOpen =
    !isLoading &&
    !!activeCycle &&
    new Date(activeCycle.interviewEnd) >= new Date();

  useEffect(() => {
    if (!isLoading && !isOpen && redirectTo) {
      router.push(redirectTo);
    }
  }, [isLoading, isOpen, redirectTo, router]);

  if (isLoading) return true; // Don't block while loading

  return isOpen;
}
