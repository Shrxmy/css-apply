// components/modals/ConfirmationModal.tsx
"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import FormProcessingOverlay from "@/components/FormProcessingOverlay";

import { useEffect } from "react";
import Image from "next/image";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: React.ReactNode;
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  message,
  isLoading = false,
}: ConfirmationModalProps) {
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden"; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 sm:p-6"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        aria-busy={isLoading}
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border-2 border-[#FFBC2B] bg-white p-4 shadow-2xl sm:border-4 sm:p-6 lg:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <FormProcessingOverlay
          active={isLoading}
          label="Submitting interview schedule..."
        />
        <div
          className={`text-center transition duration-200 ${isLoading ? "opacity-45 grayscale" : "opacity-100"}`}
        >
          {/* Header section with icon and title */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-4 sm:mb-6">
            <div className="p-2 sm:p-3 flex items-center justify-center h-12 w-12 sm:h-15 sm:w-15 rounded-full bg-[#FFE7B4] shrink-0">
              <Image
                src="/icons/warning.svg"
                alt="Warning"
                width={34}
                height={35}
                className="w-6 h-6 sm:w-8 sm:h-8"
              />
            </div>
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-inter font-bold text-[#CE9823] mb-2">
                Confirm Interview Schedule
              </h3>
              <div className="font-inter text-xs sm:text-sm text-black">
                {message}
              </div>
            </div>
          </div>

          {/* Note section */}
          <div className="bg-[#ECECEC] border-[#C8C5C5] border rounded-lg px-4 sm:px-8 lg:px-14 py-4 sm:py-6 lg:py-9 mb-4 sm:mb-6 text-left">
            <p className="font-inter text-xs sm:text-sm text-[#CE9823] font-bold mb-2">
              Note:
            </p>
            <ul className="list-disc pl-4 sm:pl-5 space-y-1 text-xs sm:text-sm text-black font-inter">
              <li>
                Once confirmed, this schedule will be final and cannot be
                changed.
              </li>
              <li>Failure to attend may affect your application status.</li>
              <li>
                Please ensure you are available and prepared at the scheduled
                time.
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-6 sm:px-9 py-2 sm:py-2.5 bg-[#E7E3E3] text-black rounded-2xl font-inter font-semibold text-xs sm:text-sm hover:bg-gray-400 transition-colors disabled:opacity-50 order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="px-6 sm:px-9 py-2 sm:py-2.5 bg-[#FFBC2B] text-[#5B4515] rounded-full font-inter font-semibold text-xs sm:text-sm hover:bg-[#D9A129] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner label="Submitting interview schedule" size="sm" className="border-[#5B4515] border-t-transparent" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Confirm</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
