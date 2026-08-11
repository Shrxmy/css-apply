"use client";

import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useEbRoles } from "@/lib/useEbRoles";

export default function SuccessPageContent() {
  const router = useRouter();
  const { "eb-role": ebRole } = useParams<{ "eb-role": string }>();
  const [scheduledTime] = useState(
    () => localStorage.getItem("scheduledTime") || "",
  );

  const { roles } = useEbRoles();
  const selectedEB = roles.find((role) => role.id === ebRole);

  if (!selectedEB) {
    return (
      <div>
        <Header />
        <section className="min-h-screen bg-[rgb(243,243,253)] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-no-repeat">
          <div className="flex flex-col justify-center items-center px-4 sm:px-8 lg:px-50 py-20">
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-inter font-bold text-black mb-4">
                Executive Board role not found
              </h1>
              <button
                onClick={() => router.push("/user/apply/executive-associate")}
                className="bg-[#044FAF] text-white px-6 py-3 rounded-md font-inter font-normal text-sm hover:bg-[#04387B] transition-all duration-150 active:scale-95"
              >
                Back to Role Selection
              </button>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(243,243,253)] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-no-repeat">
      <Header />
      <section>
        <div className="flex flex-col items-center py-8 sm:py-12 lg:py-20 gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8">
          <div>
            <Image
              src="/assets/css-apply-static-images/assets/pictures/CSAR_Excited.webp"
              alt="CSAR Excited"
              width={150}
              height={150}
              className="object-contain drop-shadow-lg sm:w-50-[200px]"
            />
          </div>

          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-raleway font-bold text-black mb-4 flex flex-col items-center leading-tight">
              Thank you for applying as
              <span className="text-[#134687] mt-2 wrap-break-word">
                Executive Associate to the {selectedEB.title}
              </span>
            </h1>
            <p className="text-sm sm:text-md font-inter text-gray-700 px-2 sm:px-4">
              Your application to the Computer Science Society has been
              successfully submitted. <br className="hidden sm:block" />
              We&apos;re excited to have you take this step toward becoming part
              of our mission to inspire, innovate, and lead.
            </p>
          </div>

          <p className="text-sm sm:text-md font-bold font-inter text-black">
            You are now FOR INTERVIEW
          </p>

          <div className="bg-white border rounded-2xl border-[#BFBFBF] px-4 py-12 max-w-xl w-full mx-auto">
            <div className="w-full flex flex-col items-center justify-center">
              <div className="flex items-center">
                <div className="flex items-center justify-center rounded-full bg-[#2F7EE3] w-7 h-7 lg:w-10 lg:h-10">
                  <span className="text-white text-xs font-bold font-inter">
                    1
                  </span>
                </div>
                <div className="w-20 lg:w-28 h-0.5 lg:h-0.75 bg-[#D9D9D9]" />
                <div className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-7 h-7 lg:w-10 lg:h-10">
                  <span className="text-[#696767] text-xs font-bold font-inter">
                    2
                  </span>
                </div>
                <div className="w-20 lg:w-28 h-0.5 lg:h-0.75 bg-[#D9D9D9]" />
                <div className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-7 h-7 lg:w-10 lg:h-10">
                  <span className="text-[#696767] text-xs font-bold font-inter">
                    3
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 w-80 lg:w-114 mt-3 gap-x-0 place-items-center font-inter font-medium">
                <span className="text-[11px] leading-none whitespace-nowrap text-center">
                  For Interview
                </span>
                <span className="text-[11px] leading-none whitespace-nowrap text-center">
                  Evaluation
                </span>
                <span className="text-[11px] leading-none whitespace-nowrap text-center">
                  Application Results
                </span>
              </div>
              {scheduledTime && (
                <p className="text-xs font-inter mt-6 text-gray-600">
                  Interview scheduled for: <br className="lg:hidden" />
                  <span className="font-semibold">{scheduledTime}</span>
                </p>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#BFBFBF] rounded-2xl px-6 sm:px-10 lg:px-14 py-6 sm:py-8 lg:py-10 max-w-4xl w-full">
            <h3 className="text-sm sm:text-md font-inter font-semibold text-black text-center">
              Reminders before the Interview:
            </h3>
            <hr className="my-3 border-t border-black" />
            <ul className="space-y-2 text-xs sm:text-sm font-inter text-black">
              <li className="flex items-start">
                <span className="mr-2 shrink-0">•</span>
                <span>
                  You will receive a confirmation email with your interview
                  details
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 shrink-0">•</span>
                <span>
                  Please arrive 10 minutes before your scheduled interview time
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 shrink-0">•</span>
                <span>Results will be announced on the end of the application period.</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4 justify-center mt-4">
            <button
              onClick={() =>
                router.push(
                  `/user/apply/executive-associate/${ebRole}/progress`,
                )
              }
              className="bg-[#044FAF] text-white px-6 sm:px-8 py-3 rounded-lg font-inter font-semibold text-sm hover:bg-[#04387B] transition-all duration-150 active:scale-95"
            >
              View Application Progress
            </button>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
