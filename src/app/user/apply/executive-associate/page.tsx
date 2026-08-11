"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LoadingScreen from "@/components/LoadingScreen";
import { useApplicationStatus } from "@/lib/useApplicationStatus";
import { useApplicationsOpen } from "@/lib/useApplicationsOpen";
import { useEbRoles } from "@/lib/useEbRoles";

export default function AssistantApplication() {
  const [selectedRole, setSelectedRole] = useState<string | null>("president");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { status } = useSession();
  const router = useRouter();
  const { roles, isLoading: isRolesLoading } = useEbRoles();

  // SWR hook — shared with user dashboard, no duplicate fetch
  const { data: appStatus, isLoading: isAppLoading } = useApplicationStatus(
    status === "authenticated",
  );

  // Gate: redirect to /user when applications are closed
  const applicationsOpen = useApplicationsOpen("/user");

  // Redirect if user already has an application
  useEffect(() => {
    if (!appStatus || status !== "authenticated") return;

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
  }, [appStatus, status, router]);

  if (status === "loading" || isAppLoading || isRolesLoading) {
    return <LoadingScreen />;
  }

  // If user has any application, show loading while redirect fires
  if (
    appStatus &&
    (appStatus.hasMemberApplication ||
      appStatus.hasCommitteeApplication ||
      appStatus.hasExecutiveAssociateApplication)
  ) {
    return <LoadingScreen />;
  }

  // Block access when applications are closed
  if (!applicationsOpen) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white sm:bg-[rgb(243,243,253)] sm:bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] sm:bg-cover  sm:bg-no-repeat flex flex-col justify-between">
      <Header />

      <section className="flex flex-col items-center justify-center sm:my-12 lg:my-28">
        <div className="w-[80%] flex flex-col justify-center items-center">
          <div className="rounded-3xl sm:bg-white sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-10 md:p-16 lg:py-20 lg:px-24">
            <div className="text-3xl lg:text-4xl font-raleway font-semibold mb-2 lg:mb-4">
              <span className="text-black">Apply as </span>
              <span className="text-[#134687]">Executive Associate</span>
            </div>

            <div className="text-black text-xs lg:text-[16px] font-Inter font-light text-justify">
              Executive Associates work closely with the CSS Executive Boards to
              help them with their tasks in events and committees. This role
              requires responsibility, attention to detail, and strong
              communication skills.
            </div>

            <hr className="my-5 lg:my-8 border-t border-[#717171]" />

            {/* Stepper */}
            <div className="w-full flex flex-col items-center justify-center">
              <div className="flex items-center">
                <div className="flex items-center justify-center rounded-full bg-[#2F7EE3] w-5 h-5 lg:w-10 lg:h-10">
                  <span className="text-white text-[9px] lg:text-xs lg:font-bold font-inter">
                    1
                  </span>
                </div>

                <div className="w-20 lg:w-24 h-0.5 lg:h-0.75 bg-[#D9D9D9]" />

                <div className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-5 h-5 lg:w-10 lg:h-10">
                  <span className="text-[#696767] text-[9px] lg:text-xs lg:font-bold font-inter">
                    2
                  </span>
                </div>

                <div className="w-20 lg:w-24 h-0.5 lg:h-0.75 bg-[#D9D9D9]" />

                <div className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-5 h-5 lg:w-10 lg:h-10">
                  <span className="text-[#696767] text-[9px] lg:text-xs lg:font-bold font-inter">
                    3
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 w-72 lg:w-100 mt-3 gap-x-0 place-items-center font-inter font-medium">
                <span className="text-[9px] lg:text-[11px] leading-none whitespace-nowrap text-center">
                  Select a Role
                </span>
                <span className="text-[9px] lg:text-[11px] leading-none whitespace-nowrap text-center">
                  Enter Information
                </span>
                <span className="text-[9px] lg:text-[11px] leading-none whitespace-nowrap text-center">
                  Schedule Interview
                </span>
              </div>
            </div>

            {/* Application Form */}
            <div className="flex flex-col lg:flex-row justify-center lg:gap-8 lg:mt-8">
              {/* Left Column - Scrollable Role List / Mobile Dropdown */}
              <div className="">
                {/* Mobile Dropdown (below lg) */}
                <div className="lg:hidden relative mt-6">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full px-5 border h-9 border-gray-300 rounded-lg bg-white flex items-center justify-between"
                  >
                    <span className="font-inter text-xs text-[#7a7a7a]">
                      {selectedRole
                        ? roles.find((role) => role.id === selectedRole)?.title
                        : "Select an EB role"}
                    </span>
                    <span className="text-[#7a7a7a] text-xs font-extralight">
                      ▼
                    </span>
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                      {roles.map((role) => (
                        <div
                          key={role.id}
                          onClick={() => {
                            setSelectedRole(role.id);
                            setIsDropdownOpen(false);
                          }}
                          className="p-5 border-b cursor-pointer hover:bg-gray-50 flex items-center gap-3 last:border-b-0"
                        >
                          <h4 className="font-inter font-semibold text-xs text-black">
                            {role.title}
                          </h4>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Scrollable List (lg and above) */}
                <div className="hidden lg:block max-h-80 overflow-y-auto">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`p-7 border-t border-b cursor-pointer transition-all duration-200 flex items-center gap-3 ${
                        selectedRole === role.id
                          ? "border-[#2F7EE3] bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <h4 className="font-inter font-semibold text-xs text-black">
                        {role.title}
                      </h4>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - Role Information */}
              <div className="lg:w-[80%] flex flex-col items-center justify-center">
                {selectedRole ? (
                  <div className="overflow-hidden rounded-lg bg-white lg:border lg:border-gray-200">
                    <div className="flex flex-col lg:flex-row lg:items-center">
                      {/* Left side - Text content */}
                      <div className="order-2 w-full p-4 lg:order-1 lg:w-[64%]">
                        {(() => {
                          const role = roles.find((r) => r.id === selectedRole);
                          return role ? (
                            <>
                              <div className="flex items-center gap-5 mt-5 lg:mt-0">
                                <div>
                                  <div className="text-[10px] lg:text-xs font-inter text-[#7a7a7a] lg:mb-1">
                                    <p>Be an Executive Associate of</p>
                                  </div>
                                  <h4 className="flex text-md lg:text-xl font-inter font-bold text-black">
                                    {role.title}
                                  </h4>
                                  {role.ebName && (
                                    <p className="text-xs lg:text-sm italic font-inter text-[#134687] mb-3">
                                      {role.ebName}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <p className="text-[10px] lg:text-[13px] pr-4 font-normal font-inter text-black lg:mb-6 leading-relaxed text-justify max-h-36 overflow-y-auto">
                                {role.description}
                              </p>
                            </>
                          ) : null;
                        })()}
                      </div>

                      {/* Right side - EB picture */}
                      {(() => {
                        const role = roles.find((r) => r.id === selectedRole);
                        return (
                          <div className="relative order-1 flex h-64 w-full items-center justify-center overflow-hidden border-b border-gray-200 bg-[#102E57] lg:order-2 lg:h-80 lg:w-[36%] lg:border-b-0 lg:border-l">
                            {role?.imageUrl ? (
                              <>
                                <Image
                                  src={role.imageUrl}
                                  alt=""
                                  aria-hidden="true"
                                  fill
                                  sizes="(max-width: 1024px) 80vw, 32vw"
                                  className="scale-110 object-cover object-center opacity-35 blur-xl"
                                />
                                <div className="absolute inset-0 bg-[#102E57]/20" />
                                <Image
                                  src={role.imageUrl}
                                  alt={`${role.ebName || role.title} — ${role.title}`}
                                  fill
                                  sizes="(max-width: 1024px) 80vw, 32vw"
                                  className="z-10 object-contain object-center"
                                />
                              </>
                            ) : (
                              <span className="px-4 text-center font-poppins text-lg font-semibold text-white">
                                {role?.title || "EB Role"}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-1 hidden lg:block">
                    <div className="flex">
                      <div className="lg:w-3/5 p-4 lg:p-6 flex items-center justify-center lg:h-80">
                        <p className="text-gray-500 font-inter text-center text-sm lg:text-base">
                          Select an EB role to be their Executive Associate
                        </p>
                      </div>
                      <div className="lg:w-2/5 bg-gray-200 lg:h-80"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <hr className="my-8 border-t border-[#717171]" />

            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => router.push("/user")}
                className="cursor-pointer hidden lg:block bg-[#E7E3E3] text-gray-700 px-15 py-3 rounded-lg font-inter font-semibold text-sm hover:bg-[#CDCCCC] transition-all duration-150 active:scale-95"
              >
                Back
              </button>
              {selectedRole && (
                <button
                  onClick={() =>
                    router.push(
                      `/user/apply/executive-associate/${selectedRole}/application`,
                    )
                  }
                  className="cursor-pointer bg-[#044FAF] text-white px-15 py-3 rounded-lg font-inter font-normal text-sm hover:bg-[#04387B] transition-colors"
                >
                  Apply
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
