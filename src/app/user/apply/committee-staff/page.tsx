"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingScreen from "@/components/LoadingScreen";
import { committeeRolesRequirements } from "@/data/committeeRoles";
import { useApplicationStatus } from "@/lib/useApplicationStatus";
import { useApplicationsOpen } from "@/lib/useApplicationsOpen";

export default function StaffApplication() {
  const [selectedRole, setSelectedRole] = useState<string | null>("academics");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { status } = useSession();
  const router = useRouter();

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

  // Show loading while session or app check is pending
  if (status === "loading" || isAppLoading) {
    return <LoadingScreen />;
  }

  // Block access when applications are closed
  if (!applicationsOpen) return <LoadingScreen />;

  // If user has any application, show loading while redirect fires
  if (
    appStatus &&
    (appStatus.hasMemberApplication ||
      appStatus.hasCommitteeApplication ||
      appStatus.hasExecutiveAssociateApplication)
  ) {
    return <LoadingScreen />;
  }

  const getCommitteeImage = (committeeId: string) => {
    const imageMap: { [key: string]: string } = {
      academics:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_ACADEMICS.webp",
      community:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_COMMDEV.webp",
      creatives:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_CREATIVES.webp",
      documentation:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_DOCU.webp",
      external:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_EXTERNALS.webp",
      finance:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_FINANCE.webp",
      logistics:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_LOGISTICS.webp",
      publicity:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_PUBLICITY.webp",
      sports:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_SPOTA.webp",
      technology:
        "/assets/css-apply-static-images/assets/committee_test/CSAR_TECHDEV.webp",
    };
    return (
      imageMap[committeeId] ||
      "/assets/css-apply-static-images/assets/committee_test/Questions%20CSAR.webp"
    );
  };

  return (
    <div className="min-h-screen bg-white sm:bg-[rgb(243,243,253)] sm:bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] sm:bg-cover  sm:bg-no-repeat  flex flex-col justify-between">
      <Header />

      <section className="flex flex-col items-center justify-center sm:my-12 lg:my-28">
        <div className="w-[80%] flex flex-col justify-center items-center">
          <div className="rounded-3xl sm:bg-white sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-10 md:p-16 lg:py-20 lg:px-24">
            <div className="text-3xl lg:text-4xl font-raleway font-semibold mb-2 lg:mb-4">
              <span className="text-black">Apply as </span>
              <span className="text-[#134687]">Committee Staff</span>
            </div>

            <div className="text-black text-xs lg:text-[16px] font-Inter font-light text-justify">
              As a Committee Staff of the Computer Science Society, you will
              play a vital role in bringing our initiatives to life. From
              supporting events and managing logistics to collaborating with
              fellow members and leaders, your efforts ensure that every project
              runs smoothly and every idea has the chance to shine.
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
            <div className="flex flex-col justify-center lg:mt-8 lg:flex-row lg:gap-8">
              {/* Left Column - Scrollable Role List / Mobile Dropdown */}
              <div className="">
                {/* Mobile Dropdown (below lg) */}
                <div className="relative z-[60] mt-6 lg:hidden">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full px-5 border h-9 border-gray-300 rounded-lg bg-white flex items-center justify-between"
                  >
                    <span className="font-inter text-xs text-[#7a7a7a]">
                      {selectedRole
                        ? committeeRolesRequirements.find(
                            (role) => role.id === selectedRole,
                          )?.title
                        : "Select an EB role"}
                    </span>
                    <span className="text-[#7a7a7a] text-xs font-extralight">
                      ▼
                    </span>
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute z-[70] mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
                      {committeeRolesRequirements.map((role) => (
                        <div
                          key={role.id}
                          onClick={() => {
                            setSelectedRole(role.id);
                            setIsDropdownOpen(false);
                          }}
                          className="p-2 border-b cursor-pointer hover:bg-gray-50 flex items-center gap-1 last:border-b-0"
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center relative">
                            <Image
                              src={getCommitteeImage(role.id)}
                              alt={role.title}
                              fill
                              sizes="24px"
                              className="object-cover"
                            />
                          </div>
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
                  {committeeRolesRequirements.map((role) => (
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
              <div className="relative z-0 mt-5 flex w-full flex-col items-center justify-center lg:mt-0 lg:w-[80%]">
                {selectedRole ? (
                  <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <div className="flex flex-col lg:flex-row lg:items-center">
                      {/* Left side - Text content */}
                      <div className="order-2 w-full p-4 lg:order-1 lg:w-[64%]">
                        {(() => {
                          const role = committeeRolesRequirements.find(
                            (r) => r.id === selectedRole,
                          );
                          return role ? (
                            <>
                              <h4 className="text-xl font-inter font-bold text-black mb-4">
                                {role.title}
                              </h4>
                              <p className="max-h-36 overflow-y-auto pr-4 text-justify text-[10px] font-normal leading-relaxed text-black font-inter lg:mb-6 lg:text-[13px]">
                                {role.description}
                              </p>
                            </>
                          ) : null;
                        })()}
                      </div>
                      {/* Right side - Committee picture */}
                      <div className="relative order-1 h-64 w-full overflow-hidden border-b border-gray-200 bg-[#134687] lg:order-2 lg:h-80 lg:w-[36%] lg:border-b-0 lg:border-l">
                        <Image
                          src={getCommitteeImage(selectedRole)}
                          alt={
                            committeeRolesRequirements.find(
                              (r) => r.id === selectedRole,
                            )?.title || "Committee"
                          }
                          fill
                          sizes="(max-width: 1024px) 100vw, 40vw"
                          className="object-contain p-5"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="flex flex-col lg:flex-row">
                      <div className="w-full lg:w-3/5 p-6 flex items-center justify-center h-80">
                        <p className="text-gray-500 font-inter">
                          Select a role to view details
                        </p>
                      </div>
                      <div className="w-full lg:w-2/5 h-80 overflow-hidden relative">
                        <Image
                          src="/assets/css-apply-static-images/assets/committee_test/Questions%20CSAR.webp"
                          alt="Select a committee"
                          fill
                          sizes="(max-width: 1024px) 100vw, 40vw"
                          className="object-cover"
                        />
                      </div>
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
              {/* REF: lagyan ng guard pag walang selected role, naka disable  */}
              {selectedRole && (
                <button
                  onClick={() =>
                    router.push(
                      `/user/apply/committee-staff/${selectedRole}/application`,
                    )
                  }
                  className="cursor-pointer whitespace-nowrap font-inter text-sm font-semibold text-[#134687] px-15 py-3 rounded-lg border-2 border-[#134687] bg-white hover:bg-[#B1CDF0] transition-all duration-150 active:scale-95"
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
