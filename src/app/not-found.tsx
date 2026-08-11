"use client";

import ErrorPage from "@/components/ErrorPage";

export default function NotFound() {
  return (
    <ErrorPage
      title="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved."
      showRetry={false}
      customActions={
        <button
          onClick={() => (window.location.href = "/")}
          className="cursor-pointer bg-[#044FAF] text-white px-6 sm:px-8 py-3 rounded-lg font-inter font-semibold text-sm hover:bg-[#04387B] transition-all duration-150 active:scale-95"
        >
          Go Home
        </button>
      }
    />
  );
}
