"use client";

import LoadingSpinner from "@/components/LoadingSpinner";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({
  message = "Loading CSSApply",
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F6F6FE] px-6 text-center">
      <LoadingSpinner label={message} size="lg" />
      <div>
        <p className="font-poppins text-base font-semibold text-[#134687]">
          {message}
        </p>
        <p className="mt-1 font-inter text-sm text-[#134687]/70">
          Please wait a moment.
        </p>
      </div>
    </div>
  );
}
