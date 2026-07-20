// member application page.tsx
"use client";

import Footer from "@/components/Footer";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Header from "@/components/Header";
import LoadingScreen from "@/components/LoadingScreen";
import { parseFullName } from "@/lib/name-parsing";
import { useFormPersistence } from "@/lib/useFormPersistence";
import { useApplicationStatus } from "@/lib/useApplicationStatus";
import { useApplicationsOpen } from "@/lib/useApplicationsOpen";
import { memberApplicationSchema } from "@/lib/schemas";

export default function MemberApplication() {
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasFetchedData, setHasFetchedData] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  // SWR hook — shared with user dashboard, no duplicate fetch
  const { data: appStatus, isLoading: isAppLoading } = useApplicationStatus(
    status === "authenticated",
  );

  // Gate: redirect to /user when applications are closed
  const applicationsOpen = useApplicationsOpen("/user");

  const initialFormData = {
    studentNumber: "",
    section: "",
    age: "",
    dateOfBirth: "",
    isOldCssMember: false,
    firstName: "",
    lastName: "",
  };

  const { formData, updateFormData, clearFormData, isLoaded } = useFormPersistence(
    initialFormData,
    "member-application"
  );

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

  useEffect(() => {
    const fetchApplicationData = async () => {
      if (status !== "authenticated" || !session?.user?.email || !isLoaded || hasFetchedData) return;

      try {
        // Prefill first and last name from Google session
        const fullName = session?.user?.name || "";
        if (fullName) {
          const { firstName: extractedFirstName, lastName: extractedLastName } = parseFullName(fullName);
          updateFormData({
            firstName: extractedFirstName,
            lastName: extractedLastName,
          });
        }

        const response = await fetch("/api/applications/member");
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
  ]);

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
    setError("");

    // Zod validation
    const parsed = memberApplicationSchema.safeParse({
      studentNumber: formData.studentNumber,
      section: formData.section,
      age: formData.age,
      dateOfBirth: formData.dateOfBirth,
      isOldCssMember: formData.isOldCssMember,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    if (!isChecked) {
      setError("Please agree to the data privacy terms");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/applications/member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentNumber: formData.studentNumber,
          section: formData.section,
          age: Number(formData.age),
          dateOfBirth: formData.dateOfBirth,
          isOldCssMember: formData.isOldCssMember,
        }),
      });

      if (response.ok) {
        clearFormData(); // Clear the form data from localStorage
        router.push("/user/apply/member/success");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Application submission failed");
      }
    } catch (error) {
      console.error(error);
      setError("An error occurred while submitting your application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen md:bg-[rgb(243,243,253)] md:bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] flex flex-col justify-between bg-cover bg-repeat">
      <Header />

      <section className="flex flex-col justify-between items-center px-20 py-10 lg:px-50 lg:py-20">
        <form
          onSubmit={handleSubmit}
          className="rounded-[24px]  md:bg-white lg:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] md:p-20 lg:p-28"
        >
          <div className="text-2xl lg:text-4xl font-raleway font-semibold mb-2 lg:mb-4">
            <span className="text-black">Apply as </span>
            <span className="text-[#134687]">Member</span>
          </div>
          <div className="text-black text-xs lg:text-lg font-Inter font-light">
            Be part of the Computer Science Society community. As a member,
            you&apos;ll gain access to exclusive workshops, events, and opportunities
            to grow alongside fellow students passionate about tech.
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <hr className="my-8 border-t-1 border-[#717171]" />
          <div className="flex flex-col lg:flex-row gap-20">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                  Student Number *
                </div>
                <div className="text-black text-sm font-Inter lg:w-[400px]">
                  <input
                    type="text"
                    name="studentNumber"
                    value={formData.studentNumber}
                    onChange={handleInputChange}
                    required
                    pattern="[0-9]{10}"
                    maxLength={10}
                    className="w-full h-9 lg:h-12  rounded-md border-2 border-[#CDCECF] focus:border-2 focus:border-[#044FAF] focus:outline-none bg-white px-4 py-3 text-sm lg:text-base"
                    placeholder="e.g. 2019131907"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                  Name *
                </div>
                <div className="text-black text-sm font-Inter lg:w-[400px]">
                  <input
                    type="text"
                    name="name"
                    value={[formData.firstName, formData.lastName]
                      .filter(Boolean)
                      .join(" ")}
                    readOnly
                    disabled
                    aria-readonly
                    className="w-full h-9 lg:h-12  rounded-md border-2 border-[#CDCECF] bg-gray-100 text-gray-700 px-4 py-3 text-sm lg:text-base"
                    placeholder="Full name"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                  Section *
                </div>
                <div className="text-black text-sm font-Inter w-36 lg:w-[200px]">
                  <input
                    type="text"
                    name="section"
                    value={formData.section}
                    onChange={handleInputChange}
                    required
                    className="w-full h-9 lg:h-12 rounded-md border-2 border-[#CDCECF] focus:border-2 focus:border-[#044FAF] focus:outline-none bg-white px-4 py-3 text-sm lg:text-base"
                    placeholder="e.g. 1CSA"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-2">
                  <div className="text-black text-xs lg:text-sm font-Inter font-normal">Age *</div>
                  <input
                    type="text"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    required
                    inputMode="numeric"
                    className="w-24 h-9 lg:h-12 rounded-md border-2 border-[#CDCECF] focus:border-2 focus:border-[#044FAF] focus:outline-none bg-white px-4 py-3 text-sm lg:text-base"
                    placeholder="Age"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-black text-xs lg:text-sm font-Inter font-normal">Date of Birth *</div>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    required
                    className="w-44 lg:w-56 h-9 lg:h-12 rounded-md border-2 border-[#CDCECF] focus:border-2 focus:border-[#044FAF] focus:outline-none bg-white px-4 py-3 text-sm lg:text-base"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-black text-xs lg:text-sm font-Inter font-normal">
                  Were you an old member/staff/executive associate of CSS before? *
                </div>
                <div className="flex gap-6 text-black text-sm font-Inter">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isOldCssMember}
                      onChange={() => updateFormData({ isOldCssMember: true })}
                      className="w-4 h-4 accent-[#134687]"
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!formData.isOldCssMember}
                      onChange={() => updateFormData({ isOldCssMember: false })}
                      className="w-4 h-4 accent-[#134687]"
                    />
                    No
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-center lg:items-start gap-3">
                <div className="relative flex-shrink-0 h-4 w-4 lg:h-6 lg:w-6">
                  <input
                    type="checkbox"
                    id="circle-checkbox"
                    checked={isChecked}
                    onChange={(e) => setIsChecked(e.target.checked)}
                    required
                    className="absolute inset-0 block h-full w-full appearance-none rounded-full border-2 border-gray-400 transition-all duration-200 focus:outline-none
                    hover:border-[#134687]
                    checked:bg-blue-500
                    shadow-inner cursor-pointer"
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
                  htmlFor="circle-checkbox"
                  className="text-black text-xs md:text-sm font-normal select-none cursor-pointer text-justify"
                >
                  I agree that the information I provide will be kept
                  confidential and used only for academic purposes. It will not
                  be shared with third parties and will be handled responsibly
                  and ethically.
                </label>
              </div>
            </div>

            <div className="hidden lg:flex justify-center items-center mt-8">
              <div className="relative w-[300px] h-[360px]">
                <Image
                  src="/assets/css-apply-static-images/assets/pictures/MemberImage1.webp"
                  alt="Member"
                  fill
                  sizes="300px"
                  className="object-cover shadow-md border border-[#2F7EE3] rounded-lg"
                />
              </div>
            </div>
          </div>
          <hr className="my-8 border-t-1 border-[#717171]" />
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/user")}
              className="bg-gray-300 text-gray-700 px-15 py-3 rounded-lg font-inter font-semibold text-sm hover:bg-gray-400 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !formData.studentNumber ||
                formData.studentNumber.length !== 10 ||
                !formData.section ||
                !formData.age ||
                !formData.dateOfBirth
              }
              className="whitespace-nowrap font-inter text-sm font-semibold text-white px-12 py-3 rounded-lg bg-[#134687] hover:bg-[#0d3569] disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </section>

      <Footer />
    </div>
  );
}
