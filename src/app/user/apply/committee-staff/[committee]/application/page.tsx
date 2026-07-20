"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { committeeRoles } from "@/data/committeeRoles";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingScreen from "@/components/LoadingScreen";
import { parseFullName } from "@/lib/name-parsing";
import { useFormPersistence } from "@/lib/useFormPersistence";
import { useApplicationStatus } from "@/lib/useApplicationStatus";
import { useApplicationsOpen } from "@/lib/useApplicationsOpen";

export default function CommitteeApplication() {
  const router = useRouter();
  const { committee: committeeId } = useParams<{ committee: string }>();
  const { data: session, status } = useSession();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // SWR hook — shared cache with user dashboard, no duplicate fetch
  const {
    data: appStatus,
    isLoading: isAppLoading,
  } = useApplicationStatus(status === "authenticated");

  // Gate: redirect to /user when applications are closed
  const applicationsOpen = useApplicationsOpen("/user");

  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasFetchedData, setHasFetchedData] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{
    cv: File | null;
    portfolio: File | null;
  }>({ cv: null, portfolio: null });

  const [uploading, setUploading] = useState({ cv: false, portfolio: false });
  const [uploadError, setUploadError] = useState({ cv: "", portfolio: "" });

  const initialFormData = {
    studentNumber: "",
    firstName: "",
    lastName: "",
    section: "",
    age: "",
    dateOfBirth: "",
    isOldCssMember: false,
    secondChoice: "",
    cv: "",
    portfolioLink: "",
  };

  const initialUIState = {
    isOpen: false,
  };

  const { formData, uiState, updateFormData, updateUIState, clearFormData, isLoaded } = useFormPersistence(
    initialFormData,
    `committee-application-${committeeId}`,
    [committeeId], // Clear when committee changes
    initialUIState
  );

  // Prefill user data from session
  useEffect(() => {
    const fetchApplicationData = async () => {
      if (status !== "authenticated" || !session?.user?.email || !isLoaded || hasFetchedData) return;

      try {
        // Prefill first and last name from Google session
        const fullName = session?.user?.name || "";
        if (fullName) {
          const { firstName: extractedFirstName, lastName: extractedLastName } =
            parseFullName(fullName);
          updateFormData({
            firstName: extractedFirstName,
            lastName: extractedLastName,
          });
        }

        // Fetch existing user data
        const response = await fetch("/api/applications/committee-staff");
        if (response.ok) {
          const data = await response.json();
          
          // Only update fields that are empty to preserve user input
          const updates: Partial<typeof formData> = {};
          
          if (!formData.studentNumber && data.user?.studentNumber) {
            updates.studentNumber = data.user.studentNumber;
          }
          
          if (!formData.section && data.user?.section) {
            updates.section = data.user.section;
          }

          if (!formData.age && data.user?.age) {
            updates.age = String(data.user.age);
          }

          if (!formData.dateOfBirth && data.user?.dateOfBirth) {
            updates.dateOfBirth = data.user.dateOfBirth.slice(0, 10);
          }

          if (data.user?.isOldCssMember !== null && data.user?.isOldCssMember !== undefined) {
            updates.isOldCssMember = data.user.isOldCssMember;
          }
          
          if (!formData.secondChoice && data.application?.secondOptionCommittee) {
            updates.secondChoice = data.application.secondOptionCommittee;
          }
          
          // Only update if there are changes to make
          if (Object.keys(updates).length > 0) {
            updateFormData(updates);
          }
        }
        
        setHasFetchedData(true);
      } catch (err) {
        console.error("Failed to fetch application data:", err);
      }
    };

    fetchApplicationData();
  }, [
    session,
    status,
    isLoaded,
    updateFormData,
    hasFetchedData,
    formData.studentNumber,
    formData.section,
    formData.age,
    formData.dateOfBirth,
    formData.cv,
    formData.portfolioLink,
    formData.secondChoice,
  ]);

  // Redirect if user already has an application
  useEffect(() => {
    if (!appStatus || status !== "authenticated") return;
    if (appStatus.hasMemberApplication)
      router.push("/user/apply/member/progress");
    else if (appStatus.hasCommitteeApplication && appStatus.committeeId)
      router.push(
        `/user/apply/committee-staff/${appStatus.committeeId}/progress`,
      );
    else if (appStatus.hasExecutiveAssociateApplication && appStatus.ebRole)
      router.push(
        `/user/apply/executive-associate/${appStatus.ebRole}/progress`,
      );
  }, [appStatus, status, router]);

  const selectedCommittee = committeeRoles.find(
    (role) => role.id === committeeId
  );

  const getCommitteeImage = (committeeId: string) => {
    const imageMap: { [key: string]: string } = {
      academics: "/assets/css-apply-static-images/assets/committee_test/CSAR_ACADEMICS.webp",
      community: "/assets/css-apply-static-images/assets/committee_test/CSAR_COMMDEV.webp",
      creatives: "/assets/css-apply-static-images/assets/committee_test/CSAR_CREATIVES.webp",
      documentation: "/assets/css-apply-static-images/assets/committee_test/CSAR_DOCU.webp",
      external: "/assets/css-apply-static-images/assets/committee_test/CSAR_EXTERNALS.webp",
      finance: "/assets/css-apply-static-images/assets/committee_test/CSAR_FINANCE.webp",
      logistics: "/assets/css-apply-static-images/assets/committee_test/CSAR_LOGISTICS.webp",
      publicity: "/assets/css-apply-static-images/assets/committee_test/CSAR_PUBLICITY.webp",
      sports: "/assets/css-apply-static-images/assets/committee_test/CSAR_SPOTA.webp",
      technology: "/assets/css-apply-static-images/assets/committee_test/CSAR_TECHDEV.webp",
    };
    return imageMap[committeeId] || "/assets/css-apply-static-images/assets/committee_test/Questions%20CSAR.webp";
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        updateUIState({ isOpen: false });
      }
    };
    if (uiState.isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [uiState.isOpen, updateUIState]);

  // Early returns AFTER all hooks
  if (status === "loading" || isAppLoading) return <LoadingScreen />;
  if (
    appStatus &&
    (appStatus.hasMemberApplication ||
      appStatus.hasCommitteeApplication ||
      appStatus.hasExecutiveAssociateApplication)
  )
    return <LoadingScreen />;
  if (!applicationsOpen) return <LoadingScreen />;

  const requiresPortfolio = (committeeKey?: string) =>
    ["creatives", "technology", "documentation"].includes(committeeKey || "");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "studentNumber") {
      const numericValue = value.replace(/[^0-9]/g, "").slice(0, 10);
      updateFormData({ [name]: numericValue });
    } else if (name === "age") {
      const numericValue = value.replace(/[^0-9]/g, "").slice(0, 3);
      updateFormData({ [name]: numericValue });
    } else {
      updateFormData({ [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!isChecked) {
      setError("Please agree to the data privacy terms");
      setLoading(false);
      return;
    }

    if (!formData.studentNumber || formData.studentNumber.length !== 10) {
      setError("Please enter a valid 10-digit student number");
      setLoading(false);
      return;
    }

    if (!formData.firstName || !formData.lastName) {
      setError("Please enter your full name");
      setLoading(false);
      return;
    }

    if (!formData.section) {
      setError("Please enter your section");
      setLoading(false);
      return;
    }

    if (!formData.age || !formData.dateOfBirth) {
      setError("Please enter your age and date of birth");
      setLoading(false);
      return;
    }

    if (!formData.secondChoice) {
      setError("Please select a second choice committee");
      setLoading(false);
      return;
    }

    if (!selectedFiles.cv) {
      setError("Please attach your CV file before submitting");
      setLoading(false);
      return;
    }

    if (
      (requiresPortfolio(selectedCommittee?.id) ||
        requiresPortfolio(formData.secondChoice)) &&
      !selectedFiles.portfolio
    ) {
      setError("Please attach your Portfolio file before submitting");
      setLoading(false);
      return;
    }

    try {
      const shouldUploadPortfolio =
        requiresPortfolio(selectedCommittee?.id) ||
        requiresPortfolio(formData.secondChoice);

      setUploading({ cv: true, portfolio: shouldUploadPortfolio });

      const cvUploadFormData = new FormData();
      cvUploadFormData.append("file", selectedFiles.cv);
      cvUploadFormData.append("studentNumber", formData.studentNumber);
      cvUploadFormData.append("section", formData.section);
      cvUploadFormData.append("fileType", "cv");
      cvUploadFormData.append("applicationType", "committee");

      const uploadCvPromise = fetch("/api/files/upload", {
        method: "POST",
        body: cvUploadFormData,
      });

      const uploadPortfolioPromise = shouldUploadPortfolio
        ? (() => {
            const portfolioUploadFormData = new FormData();
            portfolioUploadFormData.append("file", selectedFiles.portfolio!);
            portfolioUploadFormData.append(
              "studentNumber",
              formData.studentNumber,
            );
            portfolioUploadFormData.append("section", formData.section);
            portfolioUploadFormData.append("fileType", "portfolio");
            portfolioUploadFormData.append("applicationType", "committee");

            return fetch("/api/files/upload", {
              method: "POST",
              body: portfolioUploadFormData,
            });
          })()
        : null;

      const [cvUploadResponse, portfolioUploadResponse] =
        await Promise.all([uploadCvPromise, uploadPortfolioPromise]);

      const cvUploadResult = await cvUploadResponse.json();
      if (!cvUploadResponse.ok) {
        setError(cvUploadResult.error || "Failed to upload CV");
        setLoading(false);
        setUploading({ cv: false, portfolio: false });
        return;
      }

      let portfolioPath = "";
      if (portfolioUploadResponse) {
        const portfolioUploadResult = await portfolioUploadResponse.json();
        if (!portfolioUploadResponse.ok) {
          setError(portfolioUploadResult.error || "Failed to upload Portfolio");
          setLoading(false);
          setUploading({ cv: false, portfolio: false });
          return;
        }

        portfolioPath = portfolioUploadResult.filePath;
      }

      setUploading({ cv: false, portfolio: false });

      const response = await fetch("/api/applications/committee-staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentNumber: formData.studentNumber,
          firstName: formData.firstName,
          lastName: formData.lastName,
          section: formData.section,
          age: Number(formData.age),
          dateOfBirth: formData.dateOfBirth,
          isOldCssMember: formData.isOldCssMember,
          firstOptionCommittee: committeeId,
          secondOptionCommittee: formData.secondChoice,
          cv: cvUploadResult.filePath,
          portfolio: portfolioPath || undefined,
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        clearFormData(); // Clear the form data from localStorage
        router.push(`/user/apply/committee-staff/${committeeId}/schedule`);
      } else {
        setError(
          responseData.error ||
            responseData.details ||
            "Application submission failed"
        );
      }
    } catch (error) {
      console.error("Submission error:", error);
      setError("An error occurred while submitting your application");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (file: File, type: "cv" | "portfolio") => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError((prev) => ({
        ...prev,
        [type]: "Only PDF files are allowed",
      }));
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError((prev) => ({
        ...prev,
        [type]: "File size must be less than 10MB",
      }));
      return;
    }
    setUploadError((prev) => ({ ...prev, [type]: "" }));

    setSelectedFiles((prev) => ({ ...prev, [type]: file }));
  };

  if (!selectedCommittee) {
    return (
      <div>
        <section className="min-h-screen bg-[rgb(243,243,253)]">
          <div className="flex flex-col justify-center items-center px-50 py-20">
            <div className="text-center">
              <h1 className="text-2xl font-inter font-bold text-black mb-4">
                Committee not found
              </h1>
              <button
                onClick={() => router.push("/user/apply/committee-staff")}
                className="bg-[#044FAF] text-white px-6 py-3 rounded-md font-inter font-normal text-sm hover:bg-[#04387B] transition-all duration-150 active:scale-95"
              >
                Back to Committee Selection
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white sm:bg-[rgb(243,243,253)] sm:bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] sm:bg-cover  sm:bg-no-repeat flex flex-col justify-between">
      <Header />

      <section className="flex flex-col items-center justify-center sm:my-12 lg:my-28">
        <div className="w-[80%] flex flex-col justify-center items-center">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl sm:bg-white sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-10 md:p-16 lg:py-20 lg:px-24"
          >
            <div className="text-3xl lg:text-4xl font-raleway font-semibold mb-2 lg:mb-4">
              <span className="text-black">Apply for </span>
              <span className="text-[#134687]">
                {selectedCommittee.title} Committee
              </span>
            </div>

            <div className="text-black text-xs lg:text-[16px] font-Inter font-light text-justify">
              {selectedCommittee.description}
            </div>

            <hr className="my-5 lg:my-8 border-t border-[#717171]" />

            {/* Stepper */}
            <div className="w-full flex flex-col items-center justify-center">
              <div className="flex items-center">
                <div
                  onClick={() => router.push("/user/apply/committee-staff")}
                  className="flex items-center justify-center rounded-full bg-[#D9D9D9] w-5 h-5 lg:w-10 lg:h-10 cursor-pointer hover:bg-[#DAE2ED] transition-colors"
                >
                  <span className="text-[#696767] text-[9px] lg:text-xs lg:font-bold font-inter">
                    1
                  </span>
                </div>
                <div className="w-20 lg:w-24 h-0.5 lg:h-0.75 bg-[#D9D9D9]" />
                <div className="flex items-center justify-center rounded-full bg-[#2F7EE3] w-5 h-5 lg:w-10 lg:h-10">
                  <span className="text-white text-[9px] lg:text-xs lg:font-bold font-inter">
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

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {/* Application Form */}
            <div className="flex flex-col lg:flex-row justify-center lg:gap-8 mt-5 lg:mt-8">
              <div className="flex flex-col gap-4 lg:gap-6">
                <div className="flex flex-col gap-1 lg:gap-2">
                  <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                    Student Number *
                  </div>
                  <div className="text-black text-xs lg:text-sm font-Inter w-full lg:w-100">
                    <input
                      type="text"
                      name="studentNumber"
                      value={formData.studentNumber}
                      onChange={handleInputChange}
                      className="w-full h-9 lg:h-12 rounded-md border-2 border-[#CDCECF] focus:border-2 focus:border-[#044FAF] focus:outline-none bg-white px-4 py-3 text-sm lg:text-base"
                      placeholder="e.g. 2019131907"
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1 lg:gap-2">
                  <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                    First Name *
                  </div>
                  <div className="text-black text-sm font-Inter w-full lg:w-100">
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        updateFormData({ firstName: e.target.value })
                      }
                      readOnly
                      disabled
                      aria-readonly
                      className="w-full h-9 lg:h-12  rounded-md border-2 border-[#CDCECF] bg-gray-100 text-gray-700 px-4 py-3 text-sm lg:text-base"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1 lg:gap-2">
                  <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                    Last Name *
                  </div>
                  <div className="text-black lg:text-sm font-Inter lg:w-100">
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        updateFormData({ lastName: e.target.value })
                      }
                      readOnly
                      disabled
                      aria-readonly
                      className="w-full h-9 lg:h-12  rounded-md border-2 border-[#CDCECF] bg-gray-100 text-gray-700 px-4 py-3 text-sm lg:text-base"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 lg:gap-2">
                    <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                      Section *
                    </div>
                    <div className="text-black lg:text-sm font-Inter w-28 lg:w-37.5">
                      <input
                        type="text"
                        name="section"
                        value={formData.section}
                        onChange={(e) =>
                          updateFormData({
                            section: e.target.value,
                          })
                        }
                        className="w-full h-9 lg:h-12 rounded-md border-2 border-[#CDCECF] focus:border-[#044FAF] focus:outline-none bg-white px-4 py-3 text-sm lg:text-base"
                        placeholder="e.g. 1CSA"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 lg:gap-2">
                    <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                      Second Choice *
                    </div>
                    <div
                      className="relative w-44 lg:w-60"
                      ref={dropdownRef}
                    >
                      <button
                        type="button"
                        onClick={() => updateUIState({ isOpen: !uiState.isOpen })}
                        className={`w-full h-9 lg:h-12 rounded-md border-2 focus:outline-none bg-white px-2 lg:px-4 lg:py-3 text-sm lg:text-base text-left appearance-none bg-no-repeat bg-right bg-size-[16px] lg:pr-10 truncate ${
                          uiState.isOpen ? "border-[#044FAF]" : "border-[#CDCECF]"
                        } ${
                          formData.secondChoice
                            ? "text-black"
                            : "text-[#888888]"
                        }`}
                        style={{
                          backgroundImage: "url('/icons/chevron-down-dropdown.svg')",
                        }}
                      >
                        {formData.secondChoice
                          ? committeeRoles.find(
                              (role) => role.id === formData.secondChoice
                            )?.title
                          : "Select a Committee"}
                      </button>
                      {uiState.isOpen && (
                        <div className="absolute top-full left-0 right-0 bg-white border-2 border-[#044FAF] rounded-md mt-1 shadow-lg z-10 max-h-60 overflow-y-auto">
                          {committeeRoles
                            .filter((role) => role.id !== committeeId)
                            .map((role) => (
                              <div
                                key={role.id}
                                onClick={() => {
                                  updateFormData({
                                    secondChoice: role.id,
                                  });
                                  updateUIState({ isOpen: false });
                                }}
                                className={`px-4 py-3 text-base text-black cursor-pointer hover:bg-[#DCECFF] transition-colors duration-150 ${
                                  formData.secondChoice === role.id
                                    ? "border-l-4 border-[#044FAF]"
                                    : ""
                                }`}
                              >
                                {role.title}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 lg:gap-2">
                    <div className="text-black text-xs lg:text-sm font-Inter font-normal">Age *</div>
                    <input type="text" name="age" value={formData.age} onChange={handleInputChange} required inputMode="numeric" className="w-24 h-9 lg:h-12 rounded-md border-2 border-[#CDCECF] focus:border-[#044FAF] focus:outline-none bg-white px-4 py-3 text-sm lg:text-base" placeholder="Age" />
                  </div>
                  <div className="flex flex-col gap-1 lg:gap-2">
                    <div className="text-black text-xs lg:text-sm font-Inter font-normal">Date of Birth *</div>
                    <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} required className="w-44 lg:w-60 h-9 lg:h-12 rounded-md border-2 border-[#CDCECF] focus:border-[#044FAF] focus:outline-none bg-white px-4 py-3 text-sm lg:text-base" />
                  </div>
                </div>

                <div className="flex flex-col gap-1 lg:gap-2">
                  <div className="text-black text-xs lg:text-sm font-Inter font-normal">Were you an old member/staff/executive associate of CSS before? *</div>
                  <div className="flex gap-6 text-black text-sm font-Inter">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isOldCssMember} onChange={() => updateFormData({ isOldCssMember: true })} className="w-4 h-4 accent-[#134687]" />Yes</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!formData.isOldCssMember} onChange={() => updateFormData({ isOldCssMember: false })} className="w-4 h-4 accent-[#134687]" />No</label>
                  </div>
                </div>
                <div className="flex gap-4 lg:gap-2 items-center">
                  <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                    Curriculum Vitae (in pdf):
                  </div>
                  <div className="text-black lg:text-xs font-Inter lg:w-50">
                    {selectedFiles.cv ? (
                      <div className="flex items-center justify-between bg-gray-100 p-2 lg:px-3 lg:py-2 rounded-md">
                        <span className="lg:text-sm text-black truncate">
                          {selectedFiles.cv.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFiles((prev) => ({ ...prev, cv: null }))
                          }
                          className="text-black hover:text-[#044FAF] lg:ml-2 lg:text-lg"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="cv-upload" className="cursor-pointer">
                        <input
                          id="cv-upload"
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 10 * 1024 * 1024) {
                                setUploadError((prev) => ({
                                  ...prev,
                                  cv: "File size must be less than 10MB",
                                }));
                                return;
                              }
                              handleFileUpload(file, "cv");
                            }
                          }}
                          className="hidden"
                          required
                        />
                        <div className="bg-[#044FAF] text-white text-xs lg:text-sm lg:font-semibold py-1 px-3 lg:px-2 lg:py-2 rounded-md hover:bg-[#04387B] transition-all duration-150 active:scale-95 text-center w-20">
                          {uploading.cv ? "..." : "Upload"}
                        </div>
                      </label>
                    )}
                    {uploadError.cv && (
                      <div className="text-red-500 text-xs mt-1">
                        {uploadError.cv}
                      </div>
                    )}
                  </div>
                </div>
                {(requiresPortfolio(selectedCommittee.id) ||
                  requiresPortfolio(formData.secondChoice)) && (
                  <div className="flex gap-4 lg:gap-2 items-center">
                    <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                      Portfolio (in pdf):
                    </div>
                    <div className="text-black lg:text-xs font-Inter lg:w-50">
                      {selectedFiles.portfolio ? (
                        <div className="flex items-center justify-between bg-gray-100 p-2 lg:px-3 lg:py-2 rounded-md">
                          <span className="lg:text-sm text-black truncate">
                            {selectedFiles.portfolio.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedFiles((prev) => ({
                                ...prev,
                                portfolio: null,
                              }))
                            }
                            className="text-black hover:text-[#044FAF] lg:ml-2 lg:text-lg"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="portfolio-upload"
                          className="cursor-pointer"
                        >
                          <input
                            id="portfolio-upload"
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 10 * 1024 * 1024) {
                                  setUploadError((prev) => ({
                                    ...prev,
                                    portfolio:
                                      "File size must be less than 10MB",
                                  }));
                                  return;
                                }
                                handleFileUpload(file, "portfolio");
                              }
                            }}
                            className="hidden"
                            required
                          />
                          <div className="bg-[#044FAF] text-white text-xs lg:text-sm lg:font-semibold py-1 px-3 lg:px-2 lg:py-2 rounded-md hover:bg-[#04387B] transition-all duration-150 active:scale-95 text-center w-20">
                            {uploading.portfolio ? "..." : "Upload"}
                          </div>
                        </label>
                      )}
                      {uploadError.portfolio && (
                        <div className="text-red-500 text-xs mt-1">
                          {uploadError.portfolio}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="relative shrink-0 h-4 w-4 lg:h-6 lg:w-6">
                    <input
                      type="checkbox"
                      id="agreement-checkbox"
                      checked={isChecked}
                      onChange={(e) => setIsChecked(e.target.checked)}
                      className="absolute inset-0 block h-full w-full appearance-none rounded-full border-2 border-gray-400 transition-all duration-200 focus:outline-none hover:border-[#134687] checked:bg-blue-500 shadow-inner cursor-pointer"
                      required
                    />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div
                        className={`w-2 h-2 lg:w-4 lg:h-4 text-white transition-opacity duration-20 bg-current ${
                          isChecked ? "opacity-100" : "opacity-0"
                        }`}
                        style={{
                          maskImage: "url(/icons/check.svg)",
                          WebkitMaskImage: "url(/icons/check.svg)",
                          maskSize: "contain",
                          maskRepeat: "no-repeat",
                          maskPosition: "center",
                        }}
                      />
                    </div>
                  </div>
                  <label
                    htmlFor="agreement-checkbox"
                    className="text-black text-xs lg:text-sm font-normal select-none cursor-pointer text-justify"
                  >
                    I agree that the information I provide will be kept
                    confidential and used only for academic purposes. It will
                    not be shared with third parties and will be handled
                    responsibly and ethically.
                  </label>
                </div>
              </div>

              <div className="hidden lg:flex justify-center">
                <div className="w-80 h-96 rounded-lg overflow-hidden border border-gray-200 bg-linear-to-b from-blue-900 via-blue-90 to-[#2F7EE3] relative">
                  <Image
                    src={getCommitteeImage(committeeId || "")}
                    alt={selectedCommittee?.title || "Committee"}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 320px, 0px"
                  />
                </div>
              </div>
            </div>
            <hr className="my-8 border-t border-[#717171]" />
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => router.push("/user/apply/committee-staff")}
                className="cursor-pointer hidden lg:block bg-[#E7E3E3] text-gray-700 px-15 py-3 rounded-lg font-inter font-semibold text-sm hover:bg-[#CDCCCC] transition-all duration-150 active:scale-95"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="cursor-pointer whitespace-nowrap font-inter text-sm font-semibold text-[#134687] px-15 py-3 rounded-lg border-2 border-[#134687] bg-white hover:bg-[#B1CDF0] transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? uploading.cv || uploading.portfolio
                    ? "Uploading files..."
                    : "Submitting..."
                  : "Next"}
              </button>
            </div>
          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
}
