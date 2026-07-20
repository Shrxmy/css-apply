"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [showText, setShowText] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const committeeImages = [
    "/assets/css-apply-static-images/assets/committee_test/CSAR_ACADEMICS.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_COMMDEV.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_CREATIVES.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_DOCU.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_EXTERNALS.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_FINANCE.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_LOGISTICS.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_PUBLICITY.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_SPOTA.webp",
    "/assets/css-apply-static-images/assets/committee_test/CSAR_TECHDEV.webp",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 500);

    // Cycle through committee images
    const imageInterval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % committeeImages.length);
    }, 800);

    return () => {
      clearInterval(interval);
      clearTimeout(textTimer);
      clearInterval(imageInterval);
    };
  }, [committeeImages.length]);

  return (
    <>
      <style jsx>{`
        @keyframes popOut {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(5deg);
            opacity: 0.8;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
      `}</style>
      <div className="fixed inset-0 bg-[#F6F6FE] bg-[url('/assets/css-apply-static-images/assets/pictures/loadingscreen_background.webp')] bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center z-50">
        {/* Committee Image Animation */}
        <div className="mb-8 flex items-center justify-center transition-all duration-500 ease-in-out">
          <div className="relative w-37.5 h-37.5 flex items-center justify-center group">
            <Image
              key={currentImageIndex}
              src={committeeImages[currentImageIndex]}
              alt={`Committee ${currentImageIndex + 1}`}
              width={150}
              height={150}
              className="transform transition-all duration-500 ease-in-out hover:scale-110 drop-shadow-lg group-hover:drop-shadow-xl"
              style={{
                animation: "popOut 0.6s ease-in-out",
              }}
            />
            {/* Subtle glow effect */}
            <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-80 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[#134687] text-sm font-medium drop-shadow-md">
              Processing...
            </span>
            <span className="text-[#134687] text-sm font-semibold drop-shadow-md">
              {progress}%
            </span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full h-4 border border-white/30 shadow-inner">
            <div
              className="bg-[#134687]  h-4 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-blue-600/60 to-transparent animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Loading Text */}
        <div
          className={`text-center mb-6 font-poppins transition-all duration-700 ease-in-out ${
            showText ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-[#134687] text-lg font-semibold mb-1 drop-shadow-lg">
            Compiling your journey...
          </p>
          <p className="text-[#134687]/80 text-sm drop-shadow-md">
            Initializing CSSApply system
          </p>
        </div>

        {/* Loading Dots */}
        <div className="flex space-x-3 transition-all duration-500 ease-in-out">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-white rounded-full shadow-lg transition-all duration-300 ease-in-out hover:scale-125"
              style={{
                animation: `bounce 1.4s ease-in-out infinite ${i * 0.2}s`,
                animationFillMode: "both",
              }}
            ></div>
          ))}
        </div>
      </div>
    </>
  );
}
