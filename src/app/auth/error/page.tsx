"use client";

import { useSearchParams } from "next/navigation";
import ErrorPage from "@/components/ErrorPage";
import LoadingScreen from "@/components/LoadingScreen";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "Configuration":
        return "There is a problem with the server configuration.";
      case "AccessDenied":
        return "Access was denied. You may not have permission to sign in.";
      case "Verification":
        return "The verification token has expired or has already been used.";
      case "Default":
        return "An error occurred during authentication. Please try again.";
      default:
        return "An unexpected error occurred during sign-in. Please try again.";
    }
  };

  return (
    <ErrorPage
      title="Authentication Error"
      message={getErrorMessage(error)}
      showRetry={true}
      showGoHome={true}
    />
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading authentication details" />}>
      <AuthErrorContent />
    </Suspense>
  );
}
