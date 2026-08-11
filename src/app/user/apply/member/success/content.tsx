"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SuccessPageContent() {
  const router = useRouter();

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
              className="object-contain drop-shadow-lg sm:w-[200px] sm:h-[200px]"
            />
          </div>

          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-raleway font-bold text-black mb-4 flex flex-col items-center leading-tight">
              Thank you for applying as
              <span className="text-[#134687] mt-2 break-words">
                CSS Member
              </span>
            </h1>
            <p className="text-sm sm:text-md font-inter text-gray-700 px-2 sm:px-4">
              Your membership application to the Computer Science Society has
              been successfully submitted. <br className="hidden sm:block" />
              We&apos;re excited to have you take this step toward becoming part
              of our mission to inspire, innovate, and lead.
            </p>
          </div>

          <p className="text-sm sm:text-md font-bold font-inter text-black">
            Your membership is now being processed
          </p>

          <div className="bg-white border-1 rounded-2xl border-[#BFBFBF] px-4 py-12 max-w-xl w-full mx-auto">
            <div className="w-full flex flex-col items-center justify-center">
              <div className="flex items-center">
                <div className="flex items-center justify-center rounded-full bg-[#2F7EE3] w-7 h-7 lg:w-10 lg:h-10">
                  <span className="text-white text-xs font-bold font-inter">
                    1
                  </span>
                </div>
                <div className="w-20 lg:w-28 h-[2px] lg:h-[3px] bg-[#D9D9D9]" />
                <div className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-7 h-7 lg:w-10 lg:h-10">
                  <span className="text-[#696767] text-xs font-bold font-inter">
                    2
                  </span>
                </div>
                <div className="w-20 lg:w-28 h-[2px] lg:h-[3px] bg-[#D9D9D9]" />
                <div className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-7 h-7 lg:w-10 lg:h-10">
                  <span className="text-[#696767] text-xs font-bold font-inter">
                    3
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 w-80 lg:w-114 mt-3 gap-x-0 place-items-center font-inter font-medium">
                <span className="text-[11px] leading-none whitespace-nowrap text-center">
                  Application Submitted
                </span>
                <span className="text-[11px] leading-none whitespace-nowrap text-center">
                  Payment Verification
                </span>
                <span className="text-[11px] leading-none whitespace-nowrap text-center">
                  Membership Confirmed
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#BFBFBF] rounded-2xl px-6 sm:px-10 lg:px-14 py-6 sm:py-8 lg:py-10 max-w-4xl w-full">
            <h3 className="text-sm sm:text-md font-inter font-semibold text-black text-center">
              Next Steps:
            </h3>
            <hr className="my-3 border-t border-black" />
            <ul className="space-y-2 text-xs sm:text-sm font-inter text-black">
              <li className="flex items-start">
                <span className="mr-2 flex-shrink-0">•</span>
                <span>
                  You will receive a confirmation email with your membership
                  details
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 flex-shrink-0">•</span>
                <span>
                  Your payment proof will be verified within 3-5 business days
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 flex-shrink-0">•</span>
                <span>
                  Once approved, you will gain access to all member benefits and
                  activities
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 flex-shrink-0">•</span>
                <span>
                  Check your dashboard regularly for updates on your membership
                  status
                </span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4 justify-center mt-4">
            <button
              onClick={() => router.push("/user/apply/member/progress")}
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
