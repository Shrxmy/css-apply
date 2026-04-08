"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { roles } from "@/data/ebRoles";
import { committeeRolesSubmitted } from "@/data/committeeRoles";
import { useSession } from "next-auth/react";
import { truncateToLast7 } from "@/lib/truncate-utils";
import type React from "react";

export default function EAProgressPageContent() {
  const router = useRouter();
  const { data: session } = useSession();

  const [applicationData, setApplicationData] = useState<{
    hasApplication: boolean;
    application: {
      id: string;
      studentNumber: string;
      ebRole: string;
      firstOptionEb: string;
      secondOptionEb: string;
      cv: string;
      supabaseFilePath?: string;
      interviewSlotDay?: string;
      interviewSlotTimeStart?: string;
      interviewSlotTimeEnd?: string;
      interviewBy?: string;
      hasFinishedInterview: boolean;
      status?: string;
      redirection?: string;
      hasAccepted: boolean;
      createdAt: string;
      updatedAt: string;
    };
    user: {
      studentNumber: string;
      name: string;
      section: string;
    };
    ebRole: string;
    meetingLink?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduledTime, setScheduledTime] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRespondingRedirect, setIsRespondingRedirect] = useState(false);
  const [redirectError, setRedirectError] = useState("");

  const getRedirectionDisplayName = (redirection?: string) => {
    if (!redirection) return "";
    if (redirection.toLowerCase() === "member") return "Member";

    if (redirection.startsWith("committee-")) {
      const committeeId = redirection.replace("committee-", "");
      const committee = committeeRolesSubmitted.find((c) => c.id === committeeId);
      return committee?.title || committeeId;
    }

    const committee = committeeRolesSubmitted.find(
      (c) => c.id === redirection || c.title === redirection,
    );
    if (committee) return committee.title;

    const eaRole = roles.find((r) => r.id === redirection);
    if (eaRole) return `Executive Assistant for ${eaRole.title}`;

    return redirection;
  };

  const fetchApplicationData = async () => {
    try {
      const response = await fetch("/api/applications/executive-assistant");
      if (response.ok) {
        const data = await response.json();
        setApplicationData(data);

        setScheduledTime("");

        if (
          data.application?.interviewSlotDay &&
          data.application?.interviewSlotTimeStart
        ) {
          const date = new Date(data.application.interviewSlotDay);
          const formattedDate = date.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          });

          const [hourStr, minute] =
            data.application.interviewSlotTimeStart.split(":");
          let hour = parseInt(hourStr, 10);
          const ampm = hour >= 12 ? "pm" : "am";
          hour = hour % 12;
          if (hour === 0) hour = 12;
          const formattedTime = `${hour}:${minute}${ampm}`;

          setScheduledTime(`${formattedDate} at ${formattedTime}`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch application data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationData();
  }, []);

  const handleRedirectionResponse = async (decision: "accept" | "reject") => {
    try {
      setIsRespondingRedirect(true);
      setRedirectError("");

      const response = await fetch("/api/applications/redirection-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      if (!response.ok) {
        const result = await response.json();
        setRedirectError(result.error || "Failed to update redirection response");
        return;
      }

      setLoading(true);
      await fetchApplicationData();
    } catch (error) {
      console.error("Redirection response error:", error);
      setRedirectError("Failed to update redirection response");
    } finally {
      setIsRespondingRedirect(false);
    }
  };

  const handleDeleteApplication = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/applications/executive-assistant", {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        router.push("/user/apply/executive-assistant");
      } else {
        alert(result.error || "Failed to delete application");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete application");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const canDeleteApplication = () => {
    if (!applicationData || !applicationData.application) return false;

    const app = applicationData.application;
    return !app.interviewSlotDay || !app.interviewSlotTimeStart;
  };

  const renderDeleteConfirmation = () => {
    if (!showDeleteConfirm) return null;

    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4 sm:p-6"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick={() => setShowDeleteConfirm(false)}
      >
        <div
          className="bg-white rounded-2xl p-4 sm:p-6 lg:p-10 max-w-xl w-full shadow-2xl border-red-800 border sm:border-2 max_h-[90vh] max-h-[90vh] overflow-y-auto"
          onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        >
          <div className="text-center">
            {/* Header section with icon and title */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-4 sm:mb-6">
              <div className="p-2 sm:p-3 flex items-center justify-center h-12 w-12 sm:h-15 sm:w-15 rounded-full bg-red-100 shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 sm:w-8 sm:h-8 text-red-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-inter font-bold text-red-600 mb-2">
                  Confirm Reset
                </h3>
                <div className="font-inter text-xs sm:text-sm text-black">
                  Are you sure you want to reset your application? This action
                  cannot be undone. All your progress will be permanently
                  removed.
                </div>
              </div>
            </div>

            {/* Note section */}
            <div className="bg-[#FFE5E5] border-[#F5B7B7] border rounded-lg px-4 sm:px-8 lg:px-14 py-4 sm:py-6 lg:py-9 mb-4 sm:mb-6 text-left">
              <p className="font-inter text-xs sm:text-sm text-red-700 font-bold mb-2">
                Warning:
              </p>
              <ul className="list-disc pl-4 sm:pl-5 space-y-1 text-xs sm:text-sm text-black font-inter">
                <li>This will delete your current EA application.</li>
                <li>
                  You will need to start a new application to apply again.
                </li>
                <li>This action cannot be undone.</li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-6 sm:px-9 py-2 sm:py-2.5 bg-[#E7E3E3] text-black rounded-2xl font-inter font-semibold text-xs sm:text-sm hover:bg-gray-400 transition-colors disabled:opacity-50 order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteApplication}
                disabled={isDeleting}
                className="px-6 sm:px-9 py-2 sm:py-2.5 bg-red-600 text-white rounded-full font-inter font-semibold text-xs sm:text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                    <span>Resetting...</span>
                  </>
                ) : (
                  <span>Reset Application</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[rgb(243,243,253)] flex flex-col">
        <Header />
        <div className="grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#134687]"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!applicationData || !applicationData.hasApplication) {
    return (
      <div className="min-h-screen bg-[rgb(243,243,253)] flex flex-col">
        <Header />
        <div className="grow flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              No Application Found
            </h1>
            <p className="text-gray-600 mb-6">
              You don&apos;t have an active EA application.
            </p>
            <button
              onClick={() => router.push("/user/apply/executive-assistant")}
              className="bg-[#134687] hover:bg-[#0d3569] text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Apply Now
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const application = applicationData.application;
  const firstEB = roles.find((role) => role.id === application.firstOptionEb);
  const secondEB = roles.find((role) => role.id === application.secondOptionEb);
  const hasPendingRedirectionDecision =
    application.status === "redirected" && !!application.redirection;
  const memberIdDisplay = truncateToLast7(application.id).toUpperCase();
  const hideMeetingAccess =
    application.status === "evaluating" ||
    application.status === "failed" ||
    application.status === "rejected" ||
    application.status === "redirected" ||
    application.hasAccepted;
  const meetingLinkHref = applicationData.meetingLink
    ? applicationData.meetingLink.startsWith("http")
      ? applicationData.meetingLink
      : `https://${applicationData.meetingLink}`
    : "";

  // Get user name from session
  const rawFirstName = session?.user?.name?.split(" ")[0];
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase()
    : "";

  return (
    <div className="min-h-screen bg-[rgb(243,243,253)] bg-[url('https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/pictures/background.png')] bg-cover bg-no-repeat flex flex-col justify-between">
      <Header />

      <section className="w-full py-8 sm:py-12 md:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col justify-center items-center gap-6 sm:gap-8 lg:gap-10">
          {/* Welcome Section */}
          <div className="flex flex-col justify-center items-center gap-3 sm:gap-4 lg:gap-5 w-full max-w-2xl">
            <div className="rounded-[25px] sm:rounded-[35px] lg:rounded-[45px] text-white text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-medium px-4 sm:px-6 lg:px-8 py-3 sm:py-3 lg:py-4 text-center [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] w-full sm:w-[85%] md:w-[75%] lg:w-[70%]">
              Welcome, {firstName} 👋
            </div>
            <div className="text-black text-sm sm:text-base lg:text-lg font-light text-center px-3 w-full leading-5 sm:leading-6 italic">
              Track your Executive Assistant application journey.
            </div>
          </div>

          <hr className="w-[90%] sm:w-[85%] lg:w-[80%] border-t border-[#717171]" />

          {/* Application Status */}
          <div className="rounded-2xl sm:rounded-[20px] lg:rounded-3xl bg-white shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] py-6 sm:py-8 lg:py-10 px-4 sm:px-8 lg:px-16 w-full max-w-2xl flex flex-col items-center justify-center">
            <div className="flex items-center">
              <div className="flex items-center justify-center rounded-full bg-[#2F7EE3] w-7 h-7 lg:w-10 lg:h-10">
                <span className="text-white text-[9px] lg:text-xs font-bold font-inter">
                  1
                </span>
              </div>
              <div
                className={`w-20 lg:w-28 h-0.5 lg:h-0.75 ${application.status === "evaluating" || application.hasAccepted || application.status === "failed" || application.status === "redirected" ? "bg-[#2F7EE3]" : "bg-[#D9D9D9]"}`}
              />
              <div
                className={`flex items-center justify-center rounded-full w-7 h-7 lg:w-10 lg:h-10 ${application.status === "evaluating" || application.hasAccepted || application.status === "failed" || application.status === "redirected" ? "bg-[#2F7EE3]" : "bg-[#D9D9D9]"}`}
              >
                <span
                  className={`text-[9px] lg:text-xs font-bold font-inter ${application.status === "evaluating" || application.hasAccepted || application.status === "failed" || application.status === "redirected" ? "text-white" : "text-[#696767]"}`}
                >
                  2
                </span>
              </div>
              <div
                className={`w-20 lg:w-28 h-0.5 lg:h-0.75 ${application.hasAccepted || application.status === "failed" || application.status === "redirected" ? "bg-[#2F7EE3]" : "bg-[#D9D9D9]"}`}
              />
              <div
                className={`flex items-center justify-center rounded-full w-7 h-7 lg:w-10 lg:h-10 ${application.hasAccepted || application.status === "failed" || application.status === "redirected" ? "bg-[#2F7EE3]" : "bg-[#D9D9D9]"}`}
              >
                <span
                  className={`text-[9px] lg:text-xs font-bold font-inter ${application.hasAccepted || application.status === "failed" || application.status === "redirected" ? "text-white" : "text-[#696767]"}`}
                >
                  3
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 w-80 lg:w-114 mt-3 gap-x-0 place-items-center font-inter font-medium">
              <span className="text-[12px] leading-none whitespace-nowrap text-center">
                For Interview
              </span>
              <span className="text-[12px] leading-none whitespace-nowrap text-center">
                Evaluation
              </span>
              <span className="text-[12px] leading-none whitespace-nowrap text-center">
                Application Results
              </span>
            </div>
            {scheduledTime && (
              <div className="flex flex-col">
                <p className="text-[10px] text-center lg:text-xs font-inter mt-6 text-gray-600">
                  Interview scheduled for: <br className="lg:hidden" />
                  <span className="font-semibold">{scheduledTime}</span>
                </p>
                {!hideMeetingAccess && (
                  <>
                    <p className="text-[10px] text-center lg:text-xs font-inter mt-6 text-gray-600">
                      Meeting Link: <br className="lg:hidden" />
                      <span className="font-semibold">
                        {applicationData.meetingLink}
                      </span>
                    </p>
                    {applicationData.meetingLink && (
                      <a
                        href={meetingLinkHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center justify-center self-center rounded-lg bg-[#044FAF] px-4 py-2 text-[10px] lg:text-xs font-medium text-white hover:bg-[#033f8c] transition-colors"
                      >
                        Join Meeting
                      </a>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Application Summary */}
          <div className="rounded-2xl sm:rounded-[20px] lg:rounded-3xl bg-white shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-4 sm:p-6 lg:p-10 w-full max-w-4xl">
            <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-4 sm:mb-5">
              Application Summary
            </h3>

            <div className="bg-[#F3F8FF] rounded-xl p-4 sm:p-6 lg:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {/* Left Column */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Name:
                    </span>
                    <span className="text-sm sm:text-base wrap-break-word">
                      {applicationData.user?.name}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Student Number:
                    </span>
                    <span className="text-sm sm:text-base">
                      {applicationData.user?.studentNumber}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Section:
                    </span>
                    <span className="text-sm sm:text-base">
                      {applicationData.user?.section}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Schedule:
                    </span>
                    <span
                      className={`text-sm sm:text-base ${
                        scheduledTime ? "" : "text-gray-500"
                      }`}
                    >
                      {scheduledTime || "Pending"}
                    </span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-2 sm:space-y-3 md:pl-4 lg:pl-8">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Member ID:
                    </span>
                    <span
                      className={`text-sm sm:text-base ${application.hasAccepted ? "text-green-600 font-semibold" : "text-gray-500"}`}
                    >
                      {application.hasAccepted ? memberIdDisplay : "Pending"}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      First Choice:
                    </span>
                    <span className="text-sm sm:text-base wrap-break-word">
                      {firstEB?.title}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Second Choice:
                    </span>
                    <span className="text-sm sm:text-base wrap-break-word">
                      {secondEB?.title}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Application Status and Results */}
          {(application.status === "evaluating" ||
            application.hasAccepted ||
            application.status === "failed" ||
            application.status === "redirected") && (
            <div className="rounded-2xl sm:rounded-[20px] lg:rounded-3xl bg-white shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-4 sm:p-6 lg:p-10 w-full max-w-4xl">
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-4 sm:mb-5">
                Application Status
              </h3>

              <div className="bg-[#F3F8FF] border-[#e5edf9] border rounded-xl p-4 sm:p-6 lg:p-8">
                {application.status === "evaluating" && (
                  <div className="rounded-lg border border-[#044FAF]/20 bg-[#E8F2FF] px-4 py-5 text-center">
                    <div className="text-[#044FAF] text-lg font-semibold mb-2">
                      Under Evaluation
                    </div>
                    <p className="text-[#134687]/80 text-sm sm:text-base">
                      Your application is currently being reviewed. Please wait
                      for the results.
                    </p>
                  </div>
                )}

                {application.hasAccepted && (
                  <div className="text-center">
                    <div className="text-green-600 text-lg font-semibold mb-2">
                      ✅ Congratulations! You&apos;ve been accepted!
                    </div>
                    <div className="text-gray-600">
                      <p>
                        <strong>Member ID:</strong>{" "}
                        {memberIdDisplay}
                      </p>
                      {application.redirection ? (
                        <p>
                          <strong>Accepted at:</strong> {getRedirectionDisplayName(application.redirection)}
                        </p>
                      ) : (
                        <p>
                          <strong>Accepted at:</strong> Executive Assistant for{" "}
                          {firstEB?.title}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {application.status === "failed" && (
                  <div className="text-center">
                    <div className="text-red-600 text-lg font-semibold mb-2">
                      ❌ Application Not Accepted
                    </div>
                    <p className="text-gray-600">
                      Unfortunately, your application was not accepted this
                      time. Thank you for your interest in joining the Computer
                      Science Society.
                    </p>
                  </div>
                )}

                {application.status === "redirected" && (
                  <div className="rounded-lg border border-[#044FAF]/20 bg-[#E8F2FF] px-4 py-5">
                    <div className="text-[#044FAF] text-lg font-semibold mb-2 text-center">
                      Application Redirected
                    </div>
                    <p className="text-[#134687]/80 text-sm sm:text-base text-center">
                      You were offered a redirection to <strong>{getRedirectionDisplayName(application.redirection)}</strong>.
                    </p>

                    {hasPendingRedirectionDecision && (
                      <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                          onClick={() => handleRedirectionResponse("accept")}
                          disabled={isRespondingRedirect}
                          className="px-4 py-2 rounded-lg bg-[#044FAF] text-white text-sm font-medium hover:bg-[#033c87] disabled:opacity-50"
                        >
                          {isRespondingRedirect ? "Processing..." : "Accept Redirection"}
                        </button>
                        <button
                          onClick={() => handleRedirectionResponse("reject")}
                          disabled={isRespondingRedirect}
                          className="px-4 py-2 rounded-lg border border-[#005FD9]/15 text-[#134687] text-sm font-medium hover:bg-[#F3F3FD] disabled:opacity-50"
                        >
                          Reject and Become Member
                        </button>
                      </div>
                    )}

                    {redirectError && (
                      <p className="mt-3 text-center text-sm text-red-600">
                        {redirectError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Instructions - Only show for accepted applications */}
          {application.hasAccepted && (
            <div className="rounded-2xl sm:rounded-[20px] lg:rounded-3xl bg-white shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-4 sm:p-6 lg:p-10 w-full max-w-4xl">
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-4 sm:mb-5 text-center">
                Payment Instructions
              </h3>

              <div className="bg-[#F3F8FF] border border-[#005FD9]/15 rounded-xl p-4 sm:p-6 lg:p-8">
                <p className="text-[#134687] text-center mb-4 sm:mb-6 text-sm sm:text-base lg:text-lg">
                  To complete your membership, please proceed with the payment
                  of{" "}
                  <strong className="text-[#134687] text-lg sm:text-xl">
                    ₱250.00
                  </strong>{" "}
                  using the GCash QR code below:
                </p>

                <div className="text-center mb-4 sm:mb-6">
                  <Image
                    src="https://itvimtcxzsubgcbnknvq.supabase.co/storage/v1/object/sign/payment/CSSPayment-Cropped.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zZDI2NmE0Mi02NGNmLTQzZjItOTE5Mi00OTk1MmViZDMxY2QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYXltZW50L0NTU1BheW1lbnQtQ3JvcHBlZC5qcGciLCJpYXQiOjE3NTk1ODE4MjksImV4cCI6MTc5MTExNzgyOX0.SVFyO2WgwnA0pasjevIYWNESH6udyOLJiivdGob-FP4"
                    alt="GCash QR Code for CSS Payment"
                    width={300}
                    height={300}
                    className="max-w-62.5 sm:max-w-75 w-full h-auto border-3 border-[#134687] rounded-xl shadow-lg mx-auto"
                  />
                </div>

                <div className="bg-white border border-[#005FD9]/15 rounded-lg p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
                  <h4 className="text-[#044FAF] text-center font-bold mb-2 sm:mb-3 text-sm sm:text-base lg:text-lg">
                    Important Payment Message
                  </h4>
                  <p className="text-[#134687] text-center font-semibold mb-2 sm:mb-3 text-sm sm:text-base">
                    When sending your payment via GCash QR, you MUST include
                    this message:
                  </p>
                  <div className="bg-linear-to-r from-[#134687] to-[#0f3a6b] rounded-lg p-3 sm:p-4 text-center">
                    <code className="text-white font-bold text-sm sm:text-base lg:text-lg font-mono">
                      Member ID: {memberIdDisplay}
                    </code>
                  </div>
                  <p className="text-[#134687]/80 text-center text-xs sm:text-sm mt-2">
                    This message is required for payment verification and
                    processing.
                  </p>
                </div>

                <p className="text-[#134687]/80 text-center text-xs sm:text-sm">
                  Please keep a screenshot of your payment confirmation for your
                  records.
                </p>
              </div>
            </div>
          )}

          {/* Join Our Community - Only show for accepted applications */}
          {application.hasAccepted && (
            <div className="rounded-2xl sm:rounded-[20px] lg:rounded-3xl bg-white shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-4 sm:p-6 lg:p-10 w-full max-w-4xl">
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-4 sm:mb-5 text-center">
                Join Our Community
              </h3>

              <div className="bg-[#F3F8FF] border border-[#005FD9]/15 rounded-xl p-4 sm:p-6 lg:p-8">
                <p className="text-[#134687] text-center mb-4 sm:mb-6 text-sm sm:text-base lg:text-lg">
                  Join our exclusive private FB group for members to stay
                  connected and receive updates:
                </p>
                <div className="text-center">
                  <a
                    href="https://fb.me/g/6UCY6FrzU/L7r94Zcj"
                    className="inline-block bg-linear-to-r from-[#134687] to-[#0f3a6b] text-white px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 rounded-lg font-bold text-sm sm:text-base lg:text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join UST CSS Members 25&apos;-26&apos; Group
                  </a>
                </div>
                <p className="text-[#134687]/70 text-center text-xs sm:text-sm mt-4">
                  Connect with fellow members and stay updated with exclusive
                  announcements!
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {!application.interviewSlotDay && (
              <button
                onClick={() =>
                  router.push(
                    `/user/apply/executive-assistant/${application.firstOptionEb}/schedule`,
                  )
                }
                className="bg-[#134687] border-[#0d3569] border-2  text-white px-15 py-3 rounded-lg font-inter font-semibold text-xs lg:text-sm hover:bg-[#0d3569] transition-all duration-150 active:scale-95 whitespace-nowrap"
              >
                Schedule Interview
              </button>
            )}
            {canDeleteApplication() && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-[#f7e651] border-[#c9bb43] border-2 text-yellow-900 px-15 py-3 rounded-lg font-inter font-semibold text-xs lg:text-sm hover:bg-[#e5d549] transition-all duration-150 active:scale-95 whitespace-nowrap"
              >
                Reset Application
              </button>
            )}
          </div>
        </div>
      </section>

      <Footer />
      {renderDeleteConfirmation()}
    </div>
  );
}
