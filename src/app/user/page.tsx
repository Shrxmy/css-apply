"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import LoadingScreen from "@/components/LoadingScreen";
import Header from "@/components/Header";
import { useApplicationStatus } from "@/lib/useApplicationStatus";
import { useApplicationsOpen } from "@/lib/useApplicationsOpen";
import {
  Users,
  ClipboardEdit,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function UserDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  // SWR hook — deduplicates across all pages, caches result
  const {
    data: appStatus,
    isLoading: isAppLoading,
    hasAnyApplication,
  } = useApplicationStatus(status === "authenticated");

  const applicationsOpen = useApplicationsOpen();

  // Redirect authenticated users with existing applications to their progress page
  useEffect(() => {
    if (status !== "authenticated" || !session || !appStatus) return;

    if (!hasAnyApplication) return;

    if (appStatus.hasMemberApplication) {
      router.push("/user/apply/member/progress");
    } else if (appStatus.hasCommitteeApplication && appStatus.committeeId) {
      router.push(
        `/user/apply/committee-staff/${appStatus.committeeId}/progress`,
      );
    } else if (appStatus.hasExecutiveAssociateApplication && appStatus.ebRole) {
      router.push(
        `/user/apply/executive-associate/${appStatus.ebRole}/progress`,
      );
    }
  }, [status, session, appStatus, hasAnyApplication, router]);

  // Show loading while session, app check, or redirect is pending
  if (status === "loading" || isAppLoading) {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    router.push("/");
    return null;
  }

  if (!session) return null;

  // User has an application — redirect is in progress from the useEffect above.
  // Keep showing spinner to avoid flashing the dashboard content.
  if (hasAnyApplication) {
    return <LoadingScreen />;
  }

  // Get user name from session
  const rawFirstName = session.user.name?.split(" ")[0];
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase()
    : "User";

  return (
    <div>
      <section className="min-h-screen bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] flex flex-col justify-between relative bg-cover bg-repeat">
        <Header />

        <div className="flex flex-col justify-center items-center mt-14 lg:mt-20 w-full mb-10 lg:mb-16">
          <div className="flex flex-col justify-center items-center gap-7">
            <div className="flex flex-col justify-center items-center gap-2 lg:gap-5">
              <div className="rounded-[45px] text-white text-lg lg:text-4xl font-poppins font-medium px-0 py-2 lg:py-4 text-center [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] w-fit lg:px-12">
                Welcome, {firstName} 👋
              </div>
            </div>

            {!applicationsOpen ? (
              <div className="bg-white rounded-2xl border border-[#005FD9]/10 p-8 lg:p-12 max-w-md text-center shadow-sm">
                <div className="text-2xl lg:text-3xl font-poppins font-semibold text-[#134687] mb-3">
                  Applications Closed
                </div>
                <p className="text-sm lg:text-base font-inter text-[#134687]/60 leading-relaxed">
                  Applications for the Computer Science Society are currently
                  closed. Please check back during the next recruitment period.
                  You may visit the facebook page for more information.
                </p>
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center gap-2 lg:gap-5">
                <div className="text-black text-xs lg:text-lg font-Inter font-light text-center px-3 w-[85%] lg:w-full leading-5">
                  Ready to start your journey with the Computer Science Society?
                  Choose how you&apos;d like to be part of CSS this year.
                </div>
                {/* Mobile carousel */}
                <div className="relative w-full max-w-85 sm:max-w-md lg:hidden">
                  <button
                    aria-label="Previous"
                    onClick={() =>
                      setCurrentSlide((s) => (s === 0 ? 2 : s - 1))
                    }
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 grid place-items-center h-9 w-9 rounded-full text-shadow-md text-[#A8A8A8] hover:bg-gray-50 active:scale-95"
                  >
                    <ChevronLeft size={30} className="text-[#6B7280]" />
                  </button>
                  <button
                    aria-label="Next"
                    onClick={() =>
                      setCurrentSlide((s) => (s === 2 ? 0 : s + 1))
                    }
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 grid place-items-center h-9 w-9 rounded-full text-shadow-md text-[#A8A8A8] hover:bg-gray-50 active:scale-95"
                  >
                    <ChevronRight size={30} className="text-[#6B7280]" />
                  </button>

                  <div className="overflow-hidden rounded-[28px]">
                    <div
                      className="flex transition-transform duration-300"
                      style={{
                        transform: `translateX(-${currentSlide * 100}%)`,
                      }}
                    >
                      {/* lagyan ng validation if nag apply na ba toh and idisable lahat ng buttons show instead ung application niya */}
                      {/* Slide 1 - Member */}
                      <div className="min-w-full flex justify-center">
                        <div className="relative flex flex-col w-64 h-110 md:w-80 md:h-120 rounded-[28px] border-2 border-[#005FD9] bg-white shadow-md lg:shadow-[0_8px_13px_0_rgba(0,0,0,0.25)] items-center justify-center">
                          <Users
                            size={88}
                            strokeWidth={2}
                            className="pt-5 text-[#044FAF]"
                          />
                          <div className="text-base md:text-lg text-[#134687] flex flex-col font-poppins items-center text-center w-full">
                            Member
                            <div className="text-black text-[10px] sm:text-[10px] md:text-[13px] text-justify font-inter font-light border-2 border-[#D1D1D1] bg-[#ECECEC] rounded-lg mt-4 h-60 w-50 md:mt-5 md:h-67.5 md:w-70 p-4 flex flex-col justify-between overflow-hidden">
                              <ul className="list-disc list-outside space-y-1 flex-1 overflow-y-auto pl-4">
                                <li>
                                  Gain access to exclusive events and activities
                                </li>
                                <li>
                                  Build your network with fellow students and
                                  professionals
                                </li>
                                <li>
                                  Receive updates and opportunities directly
                                  from the organization
                                </li>
                                <li className="font-semibold">
                                  One-time membership fee of ₱250
                                </li>
                              </ul>
                              <a
                                href="/user/apply/member"
                                className="whitespace-nowrap bg-[#044FAF] font-inter text-[11px] md:text-sm text-white px-3 py-2 md:px-4 md:py-3 rounded-md hover:bg-[#04387B] transition-all duration-300 ease-in-out text-center mt-2 shrink-0 shadow-md hover:shadow-lg"
                              >
                                Apply as Member
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Slide 2 - Committee Staff */}
                      <div className="min-w-full flex justify-center">
                        <div className="relative flex flex-col w-64 h-110 md:w-80 md:h-120 rounded-[28px] border-2 border-[#005FD9] bg-white shadow-[0_8px_13px_0_rgba(0,0,0,0.25)] items-center justify-center">
                          <ClipboardEdit
                            size={88}
                            strokeWidth={1.7}
                            className="pt-5 text-[#044FAF]"
                          />

                          <div className="text-base md:text-lg text-[#134687] flex flex-col font-poppins items-center text-center w-full">
                            Committee Staff
                            <div className="text-black text-[10px] sm:text-[10px] md:text-[13px] text-justify font-inter font-light border-2 border-[#D1D1D1] bg-[#ECECEC] rounded-lg mt-4 h-60 w-50 md:mt-5 md:h-67.5 md:w-70 p-4 flex flex-col justify-between overflow-hidden">
                              <ul className="list-disc list-outside space-y-1 flex-1 overflow-y-auto pl-4">
                                <li>
                                  Aid in the preparation and needs of events
                                </li>
                                <li>
                                  Be part of the behind-the-scenes work of
                                  events
                                </li>
                                <li>
                                  Upskill through exposure to new projects and
                                  tasks
                                </li>
                                <li className="font-semibold">
                                  One-time membership fee of ₱250
                                </li>
                              </ul>
                              <a
                                href="/user/apply/committee-staff"
                                className="whitespace-nowrap bg-[#044FAF] font-inter text-[11px] md:text-sm text-white px-3 py-2 md:px-4 md:py-3 rounded-md hover:bg-[#04387B] transition-all duration-300 ease-in-out text-center mt-2 shrink-0 shadow-md hover:shadow-lg"
                              >
                                Apply as Committee Staff
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Slide 3 - Executive Associate */}
                      <div className="min-w-full flex justify-center">
                        <div className="relative flex flex-col w-64 h-110 md:w-80 md:h-120 rounded-[28px] border-2 border-[#005FD9] bg-white shadow-[0_8px_13px_0_rgba(0,0,0,0.25)] items-center justify-center">
                          <Briefcase
                            size={100}
                            strokeWidth={1.5}
                            className="pt-5 text-[#044FAF]"
                          />

                          <div className="text-base md:text-lg text-[#134687] flex flex-col font-poppins items-center text-center w-full">
                            Executive Associate
                            <div className="text-black text-[10px] sm:text-[10px] md:text-[13px] text-justify font-inter font-light border-2 border-[#D1D1D1] bg-[#ECECEC] rounded-lg mt-4 h-60 w-50 md:mt-5 md:h-67.5 md:w-70 p-4 flex flex-col justify-between overflow-hidden">
                              <ul className="list-disc list-outside space-y-1 flex-1 overflow-y-auto pl-4">
                                <li>
                                  Work closely with the Executive Board in daily
                                  operations
                                </li>
                                <li>
                                  Assist in planning and organizing events
                                </li>
                                <li>
                                  Handle paperworks and tasks assigned by the
                                  Executive Board
                                </li>
                                <li className="font-semibold">
                                  One-time membership fee of ₱250
                                </li>
                              </ul>
                              <a
                                href="/user/apply/executive-associate"
                                className="whitespace-nowrap bg-[#044FAF] font-inter text-[10px] md:text-sm text-white px-3 py-2 md:px-4 md:py-3 rounded-md hover:bg-[#04387B] transition-all duration-300 ease-in-out text-center mt-2 shrink-0 shadow-md hover:shadow-lg"
                              >
                                Apply as Executive Associate
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* dots */}
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {[0, 1, 2].map((i) => (
                      <button
                        key={i}
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => setCurrentSlide(i)}
                        className={`h-2.5 w-2.5 rounded-full ${
                          currentSlide === i ? "bg-[#044FAF]" : "bg-[#D1D1D1]"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden lg:flex gap-7 xl:gap-11 mt-10">
                  <div className="relative flex flex-col w-64 xl:w-80 h-100 xl:h-120 rounded-[20px] xl:rounded-[28px] border-2 border-[#005FD9] bg-white shadow-[0_8px_13px_0_rgba(0,0,0,0.25)] items-center justify-center">
                    <Users
                      size={100}
                      strokeWidth={1.7}
                      className="pt-3 xl:pt-5 xl:w-30 xl:h-30 text-[#044FAF]"
                    />
                    <div className="text-base xl:text-lg text-[#134687] flex flex-col font-poppins items-center text-center w-full">
                      Member
                      <div className="text-black lg:text-[10px] xl:text-[12px] text-justify  font-inter font-light border-2 border-[#D1D1D1] bg-[#ECECEC] rounded-lg mt-4 xl:mt-5 h-55 xl:h-67.5 w-55 xl:w-70 p-4 flex flex-col justify-between overflow-hidden">
                        <ul className="list-disc list-outside space-y-2 flex-1 overflow-y-auto pl-4">
                          <li>
                            Gain access to exclusive events and activities
                          </li>
                          <li>
                            Build your network with fellow students and
                            professionals
                          </li>
                          <li>
                            Receive updates and opportunities directly from the
                            organization
                          </li>
                          <li className="font-semibold">
                            One-time membership fee of ₱250
                          </li>
                        </ul>
                        <a
                          href="/user/apply/member"
                          className="whitespace-nowrap bg-[#044FAF] font-inter text-xs xl:text-sm text-white px-4 xl:px-6 py-2.5 xl:py-3 rounded-md hover:bg-[#04387B] transition-all duration-300 ease-in-out text-center mt-2 shrink-0 shadow-md hover:shadow-lg"
                        >
                          Apply as Member
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="relative flex flex-col w-64 xl:w-80 h-100 xl:h-120 rounded-[20px] xl:rounded-[28px] border-2 border-[#005FD9] bg-white shadow-[0_8px_13px_0_rgba(0,0,0,0.25)] items-center justify-center">
                    <ClipboardEdit
                      size={100}
                      strokeWidth={1.7}
                      className="pt-3 xl:pt-5 xl:w-30 xl:h-30 text-[#044FAF]"
                    />

                    <div className="text-base xl:text-lg text-[#134687] flex flex-col font-poppins items-center text-center w-full">
                      Committee Staff
                      <div className="text-black lg:text-[10px] xl:text-[12px] text-justify font-inter font-light border-2 border-[#D1D1D1] bg-[#ECECEC] rounded-lg mt-4 xl:mt-5 h-55 xl:h-67.5 w-55 xl:w-70 p-4 flex flex-col justify-between overflow-hidden">
                        <ul className="list-disc list-outside space-y-2 flex-1 overflow-y-auto pl-4">
                          <li>Aid in the preparation and needs of events</li>
                          <li>
                            Be part of the behind-the-scenes work of events
                          </li>
                          <li>
                            Upskill through exposure to new projects and tasks
                          </li>
                          <li className="font-semibold">
                            One-time membership fee of ₱250
                          </li>
                        </ul>
                        <a
                          href="/user/apply/committee-staff"
                          className="whitespace-nowrap bg-[#044FAF] font-inter text-xs xl:text-sm text-white px-4 xl:px-6 py-2.5 xl:py-3 rounded-md hover:bg-[#04387B] transition-all duration-300 ease-in-out text-center mt-2 shrink-0 shadow-md hover:shadow-lg"
                        >
                          Apply as Committee Staff
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="relative flex flex-col w-64 xl:w-80 h-100 xl:h-120 rounded-[20px] xl:rounded-[28px] border-2 border-[#005FD9] bg-white shadow-[0_8px_13px_0_rgba(0,0,0,0.25)] items-center justify-center">
                    <Briefcase
                      size={120}
                      strokeWidth={1.5}
                      className="pt-3 xl:pt-5 xl:w-30 xl:h-30 text-[#044FAF]"
                    />

                    <div className="text-base xl:text-lg text-[#134687] flex flex-col font-poppins items-center text-center w-full">
                      Executive Associate
                      <div className="text-black lg:text-[10px] xl:text-[12px] text-justify font-inter font-light border-2 border-[#D1D1D1] bg-[#ECECEC] rounded-lg mt-4 xl:mt-5 h-55 xl:h-67.5 w-55 xl:w-70 p-4 flex flex-col justify-between overflow-hidden">
                        <ul className="list-disc list-outside space-y-2 flex-1 overflow-y-auto pl-4">
                          <li>
                            Work closely with the Executive Board in daily
                            operations
                          </li>
                          <li>Assist in planning and organizing events</li>
                          <li>
                            Handle paperworks and tasks assigned by the
                            Executive Board
                          </li>
                          <li className="font-semibold">
                            One-time membership fee of ₱250
                          </li>
                        </ul>
                        <a
                          href="/user/apply/executive-associate"
                          className="whitespace-nowrap bg-[#044FAF] font-inter text-xs xl:text-sm text-white px-4 xl:px-6 py-2.5 xl:py-3 rounded-md hover:bg-[#04387B] transition-all duration-300 ease-in-out text-center mt-2 shrink-0 shadow-md hover:shadow-lg"
                        >
                          Apply as Executive Associate
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </section>
    </div>
  );
}
