"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import LoadingScreen from "@/components/LoadingScreen";
import { useApplicationStatus } from "@/lib/useApplicationStatus";

interface ApplicationGuardProps {
  children: React.ReactNode;
  applicationType: "member" | "committee" | "executive-associate";
  redirectPath?: string;
}

const DEFAULT_REDIRECTS: Record<string, string> = {
  member: "/user/apply/member",
  committee: "/user/apply/committee-staff",
  ea: "/user/apply/executive-associate",
};

/**
 * ApplicationGuard
 *
 * Enforces two rules:
 *  1. The user must be authenticated (redirect to "/" if not).
 *  2. On non-transition pages, the user must have the required application type.
 *
 * "Transition pages" (schedule, success) skip the application-type check entirely.
 * These pages are reached immediately after submission, so SWR might still hold
 * stale data. Checking on those pages causes race-condition redirects back to apply.
 * Security for those pages is enforced at the API level, not the guard.
 */
export default function ApplicationGuard({
  children,
  applicationType,
  redirectPath,
}: ApplicationGuardProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const {
    data: appStatus,
    isLoading,
    error,
  } = useApplicationStatus(status !== "unauthenticated");

  // Schedule and success pages are reached right after submission.
  // SWR may still hold stale "no application" data — skip the application check.
  const isTransitionPage =
    pathname?.includes("/schedule") || pathname?.includes("/success");

  const hasRequired = appStatus
    ? applicationType === "member"
      ? appStatus.hasMemberApplication
      : applicationType === "committee"
        ? appStatus.hasCommitteeApplication
        : appStatus.hasExecutiveAssociateApplication
    : false;

  useEffect(() => {
    // Rule 1: must be authenticated
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status !== "authenticated") return;

    // Rule 2 is skipped on transition pages
    if (isTransitionPage) return;

    // Wait until SWR has settled before potentially redirecting
    if (isLoading || !appStatus) return;

    if (!hasRequired) {
      const target =
        redirectPath || DEFAULT_REDIRECTS[applicationType] || "/user";
      router.push(target);
    }
  }, [
    status,
    appStatus,
    isLoading,
    hasRequired,
    applicationType,
    redirectPath,
    router,
    isTransitionPage,
  ]);

  // ── Render decisions ────────────────────────────────────────────────────────

  // Session still loading
  if (status === "loading") return <LoadingScreen />;

  // Not logged in — render nothing while redirect fires
  if (status === "unauthenticated") return null;

  // Transition pages (schedule / success): only require auth, skip application check
  if (isTransitionPage) return <>{children}</>;

  // SWR is still fetching on a guarded page — show spinner, don't redirect yet
  if (isLoading || !appStatus) return <LoadingScreen />;

  // SWR errored — let the page render and handle the failure itself
  if (error) return <>{children}</>;

  // No application found — show spinner while the redirect useEffect fires
  // (avoids a jarring blank flash before navigation happens)
  if (!hasRequired) return <LoadingScreen />;

  return <>{children}</>;
}
