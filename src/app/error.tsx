"use client";

import ErrorPage from "@/components/ErrorPage";

interface NextError extends Error {
  digest?: string;
}

interface ErrorProps {
  error: NextError;
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return <ErrorPage error={error} reset={reset} />;
}
