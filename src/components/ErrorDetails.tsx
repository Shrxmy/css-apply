"use client";

interface NextError extends Error {
  digest?: string;
}

interface ErrorDetailsProps {
  error?: NextError;
}

export default function ErrorDetails({ error }: ErrorDetailsProps) {
  if (process.env.NODE_ENV !== "development" || !error) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-left">
      <h3 className="text-sm font-semibold text-red-800 mb-2">
        Error Details:
      </h3>
      <p className="text-xs text-red-700 font-mono break-all">
        {error.message}
      </p>
      {error.digest && (
        <p className="text-xs text-red-600 mt-2">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
