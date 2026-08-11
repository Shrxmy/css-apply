"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

interface EnterButtonProps {
  isVisible: boolean;
}

export default function EnterButton({ isVisible }: EnterButtonProps) {
  const searchParams = useSearchParams();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/user";

  // Google Auth with Loading State
  const handleEnterClick = async () => {
    setIsLoggingIn(true); // Show loading state

    try {
      await signIn("google", {
        callbackUrl: callbackUrl,
        redirect: true,
      });
    } catch (error) {
      console.error("Sign-in error:", error);
      setIsLoggingIn(false);
    }
  };

  // If the button is not supposed to be visible, render nothing.
  if (!isVisible) {
    return null;
  }

  return (
    <div>
      <button
        onClick={handleEnterClick}
        disabled={isLoggingIn}
        className="bg-[#0077FF] font-family-inter text-white py-2 px-16 font-medium text-xl shadow-[inset_0_4px_15px_rgba(255,255,255,0.8)] absolute top-[70%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 animate-fade-in hover:bg-[#0056CC] transition-colors duration-200 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoggingIn ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Logging in...
          </div>
        ) : (
          "ENTER"
        )}
      </button>
    </div>
  );
}
