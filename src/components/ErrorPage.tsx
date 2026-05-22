"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Dynamically import ErrorDetails to prevent hydration issues
const ErrorDetails = dynamic(() => import("./ErrorDetails"), {
  ssr: false,
  loading: () => null,
});

interface NextError extends Error {
  digest?: string;
}

interface ErrorPageProps {
  title?: string;
  message?: string;
  showRetry?: boolean;
  showGoHome?: boolean;
  customActions?: React.ReactNode;
  error?: NextError;
  reset?: () => void;
}

export default function ErrorPage({
  title = "Oops! Something went wrong",
  message = "We encountered an unexpected error. Don't worry, our team has been notified and we're working to fix it.",
  showRetry = true,
  showGoHome = true,
  customActions,
  error,
  reset,
}: ErrorPageProps) {
  const router = useRouter();

  const handleRetry = () => {
    if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[rgb(243,243,253)] bg-[url('https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/pictures/background.png')] bg-cover bg-no-repeat">
      <Header />

      <section className="flex flex-col items-center justify-center py-8 sm:py-12 lg:py-20 px-4 sm:px-6 lg:px-8 grow">
        <div className="text-center max-w-2xl mx-auto">
          {/* Error Icon/Image */}
          <div className="mb-8">
            <Image
              src="https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/pictures/CSAR_Sad.png"
              alt="Error"
              width={150}
              height={150}
              className="object-contain drop-shadow-lg sm:w-50 sm:h-50 mx-auto"
            />
          </div>

          {/* Error Message */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-raleway font-bold text-black mb-4">
            {title}
          </h1>

          <p className="text-sm sm:text-md font-inter text-gray-700 mb-8">
            {message}
          </p>

          {/* Error Details (only in development) */}
          <ErrorDetails error={error} />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {customActions ? (
              customActions
            ) : (
              <>
                {showRetry && (
                  <button
                    onClick={handleRetry}
                    className="cursor-pointer bg-[#044FAF] text-white px-6 sm:px-8 py-3 rounded-lg font-inter font-semibold text-sm hover:bg-[#04387B] transition-all duration-150 active:scale-95"
                  >
                    Try Again
                  </button>
                )}

                {showGoHome && (
                  <button
                    onClick={handleGoHome}
                    className="cursor-pointer bg-white text-[#044FAF] border-2 border-[#044FAF] px-6 sm:px-8 py-3 rounded-lg font-inter font-semibold text-sm hover:bg-[#044FAF] hover:text-white transition-all duration-150 active:scale-95"
                  >
                    Go Home
                  </button>
                )}
              </>
            )}
          </div>

          {/* Additional Help */}
          <div className="mt-8 text-xs text-gray-500 font-inter">
            <p>
              If this problem persists, please contact us through our{" "}
              <a
                href="https://facebook.com/cssapply"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#044FAF] hover:text-[#04387B] underline cursor-pointer transition-colors duration-150"
              >
                Facebook page
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
