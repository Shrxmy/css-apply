"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Header from "@/components/Header";
import LoadingSpinner from "@/components/LoadingSpinner";
import LoadingScreen from "@/components/LoadingScreen";
import FormProcessingOverlay from "@/components/FormProcessingOverlay";
import Footer from "@/components/Footer";
import NoApplicationFound from "@/components/NoApplicationFound";
import { useSession } from "next-auth/react";
import { usePaymentQr } from "@/lib/usePaymentQr";
import { useCommunityLink } from "@/lib/useCommunityLink";
import { usePaymentReceiptTemplate } from "@/lib/usePaymentReceiptTemplate";

export default function MemberProgressPageContent() {
  const { communityEnabled, communityUrl, communityLabel } = useCommunityLink();
  const { paymentQrUrl } = usePaymentQr();
  const { receiptTemplateUrl } = usePaymentReceiptTemplate();
  const [applicationData, setApplicationData] = useState<{
    hasApplication: boolean;
    application: {
      id: string;
      hasAccepted?: boolean;
      paymentProof?: string;
      paymentStatus?: "not_submitted" | "pending" | "approved" | "rejected";
      paymentRejectionReason?: string;
      createdAt: string;
    } | null;
    user: {
      id: string;
      studentNumber: string;
      name: string;
      section: string;
      memberships?: Array<{ memberId: string }>;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentProof, setPaymentProof] = useState("");
  const [submittingPaymentProof, setSubmittingPaymentProof] = useState(false);
  const [paymentProofError, setPaymentProofError] = useState("");
  const { data: session } = useSession();

  const hasPaymentProof = !!applicationData?.application?.paymentProof;
  const paymentStatus =
    applicationData?.application?.paymentStatus ?? "not_submitted";
  const isPaymentApproved = paymentStatus === "approved";
  const canSubmitPaymentProof =
    paymentStatus === "not_submitted" || paymentStatus === "rejected";

  const handlePaymentProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentProofError("");
    setSubmittingPaymentProof(true);

    try {
      const response = await fetch("/api/applications/payment-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentProof }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to submit payment proof");

      setApplicationData((current) =>
        current && current.application
          ? {
              ...current,
              application: {
                ...current.application,
                paymentProof: data.paymentProof,
                paymentStatus: "pending",
                paymentRejectionReason: undefined,
              },
            }
          : current,
      );
      setPaymentProof("");
    } catch (error) {
      setPaymentProofError(
        error instanceof Error
          ? error.message
          : "Failed to submit payment proof",
      );
    } finally {
      setSubmittingPaymentProof(false);
    }
  };

  useEffect(() => {
    const fetchApplicationData = async () => {
      try {
        const response = await fetch("/api/applications/member");
        if (response.ok) {
          const data = await response.json();
          setApplicationData(data);
        }
      } catch (error) {
        console.error("Failed to fetch application data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicationData();
  }, []);

  if (loading) {
    return <LoadingScreen message="Loading your application" />;
  }

  if (!applicationData || !applicationData.hasApplication) {
    return (
      <NoApplicationFound
        applicationName="Member"
        description="We couldn’t find an active Member application for the current recruitment cycle. You can begin a new application whenever you’re ready."
        applyHref="/user/apply/member"
      />
    );
  }

  const rawFirstName = session?.user?.name?.split(" ")[0];
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase()
    : "";

  return (
    <div className="min-h-screen bg-[rgb(243,243,253)] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-no-repeat flex flex-col justify-between">
      <Header />

      <section className="w-full py-8 sm:py-12 md:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col justify-center items-center gap-6 sm:gap-8 lg:gap-10">
          <div className="flex flex-col justify-center items-center gap-3 sm:gap-4 lg:gap-5 w-full max-w-2xl">
            <div className="rounded-[25px] sm:rounded-[35px] lg:rounded-[45px] text-white text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-medium px-4 sm:px-6 lg:px-8 py-3 sm:py-3 lg:py-4 text-center [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] w-full sm:w-[85%] md:w-[75%] lg:w-[70%]">
              Welcome, {firstName} 👋
            </div>
            <div className="text-black text-sm sm:text-base lg:text-lg font-light text-center px-3 w-full leading-5 sm:leading-6 italic">
              Track your journey with the Computer Science Society.
            </div>
          </div>

          <hr className="w-[90%] sm:w-[85%] lg:w-[80%] border-t border-[#717171]" />

          <div className="rounded-2xl sm:rounded-[20px] lg:rounded-3xl bg-white shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-4 sm:p-6 lg:p-10 w-full max-w-4xl">
            <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-4 sm:mb-5">
              Application Summary
            </h3>
            <div className="bg-[#F3F8FF] rounded-xl p-4 sm:p-6 lg:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Name:
                    </span>
                    <span className="text-sm sm:text-base wrap-break-word">
                      {applicationData.user.name}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Student Number:
                    </span>
                    <span className="text-sm sm:text-base">
                      {applicationData.user.studentNumber}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3 md:pl-4 lg:pl-8">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Section:
                    </span>
                    <span className="text-sm sm:text-base">
                      {applicationData.user.section}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-bold text-sm sm:text-base mb-1 sm:mb-0 sm:mr-3 min-w-fit">
                      Member ID:
                    </span>
                    <span
                      className={`text-sm sm:text-base ${isPaymentApproved ? "text-green-600 font-semibold" : "text-gray-500"}`}
                    >
                      {!applicationData.application?.hasAccepted
                        ? "Pending"
                        : isPaymentApproved
                          ? (applicationData.user.memberships?.[0]?.memberId ??
                            "Approved — refresh to view")
                          : paymentStatus === "pending"
                            ? "Awaiting Executive Board approval"
                            : paymentStatus === "rejected"
                              ? "Receipt needs resubmission"
                              : "Submit acknowledgement receipt first"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {applicationData.application?.hasAccepted && (
            <div className="rounded-2xl sm:rounded-[20px] lg:rounded-3xl bg-white shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.31)] p-4 sm:p-6 lg:p-10 w-full max-w-4xl">
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold mb-4 sm:mb-5 text-center">
                Payment Instructions
              </h3>
              <div className="bg-[#F3F8FF] rounded-xl p-4 sm:p-6 lg:p-8">
                {!hasPaymentProof && (
                  <>
                    <p className="text-[#134687] text-center mb-4 sm:mb-6 text-sm sm:text-base lg:text-lg">
                      To complete your membership, please proceed with the
                      payment of{" "}
                      <strong className="text-[#134687] text-lg sm:text-xl">
                        ₱250.00
                      </strong>{" "}
                      using the GCash QR code below:
                    </p>
                    <div className="text-center mb-4 sm:mb-6">
                      {paymentQrUrl ? (
                        <Image
                          src={paymentQrUrl}
                          alt="GCash QR Code for CSS Payment"
                          width={300}
                          height={300}
                          className="max-w-62.5 sm:max-w-75 w-full h-auto border-3 border-[#134687] rounded-xl shadow-lg mx-auto"
                        />
                      ) : (
                        <div className="mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                          Payment QR code is currently unavailable. Please
                          contact css.cics@ust.edu.ph for payment instructions.
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="bg-white rounded-lg p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
                  <h4 className="text-[#044FAF] text-center font-bold mb-2 sm:mb-3 text-sm sm:text-base lg:text-lg">
                    Important Payment Message
                  </h4>
                  <p className="text-[#134687] text-center font-semibold mb-2 sm:mb-3 text-sm sm:text-base">
                    After payment, fill out the acknowledgement receipt PDF and
                    upload it to Google Drive, then submit the shareable link
                    below.
                  </p>
                  {receiptTemplateUrl && (
                    <div className="text-center mb-4 sm:mb-6">
                      <a
                        href={receiptTemplateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#044FAF] font-semibold underline"
                      >
                        Download acknowledgement receipt PDF
                      </a>
                    </div>
                  )}
                  {canSubmitPaymentProof ? (
                    <form
                      onSubmit={handlePaymentProofSubmit}
                      aria-busy={submittingPaymentProof}
                      className="relative mb-4 sm:mb-6"
                    >
                      <FormProcessingOverlay
                        active={submittingPaymentProof}
                        label="Submitting acknowledgement receipt..."
                      />
                      <fieldset
                        disabled={submittingPaymentProof}
                        className={`space-y-3 border-0 p-0 transition duration-200 ${submittingPaymentProof ? "opacity-45 grayscale" : "opacity-100"}`}
                      >
                      <input
                        type="url"
                        value={paymentProof}
                        onChange={(e) => setPaymentProof(e.target.value)}
                        required
                        placeholder="Paste Google Drive receipt link"
                        className="w-full rounded-lg border border-[#005FD9]/20 px-4 py-3 text-sm focus:outline-none focus:border-[#044FAF]"
                      />
                      {paymentProofError && (
                        <p className="text-red-600 text-xs text-center">
                          {paymentProofError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={submittingPaymentProof}
                        className="w-full bg-[#134687] text-white px-4 py-3 rounded-lg font-semibold disabled:opacity-50"
                      >
                        {submittingPaymentProof ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <LoadingSpinner label="Submitting acknowledgement receipt" size="sm" className="border-white border-t-transparent" />
                            Submitting...
                          </span>
                        ) : (
                          "Submit Acknowledgement Receipt"
                        )}
                      </button>
                      </fieldset>
                    </form>
                  ) : paymentStatus === "pending" ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-center text-sm font-semibold text-amber-800 mb-4 sm:mb-6">
                      Your acknowledgement receipt is awaiting Executive Board review.
                    </p>
                  ) : (
                    <p className="rounded-lg bg-green-50 p-3 text-center text-sm font-semibold text-green-700 mb-4 sm:mb-6">
                      Your acknowledgement receipt was approved. Your Member ID
                      is available above.
                    </p>
                  )}
                  {paymentStatus === "rejected" && (
                    <p className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">
                      Receipt rejected: {applicationData.application?.paymentRejectionReason || "Please submit a valid acknowledgement receipt."}
                    </p>
                  )}
                  <p className="text-[#134687]/80 text-center text-xs sm:text-sm mt-2">
                    Your Member ID will be shown only after an authorized Executive
                    Board reviewer approves your acknowledgement receipt.
                  </p>
                </div>
                <p className="text-[#134687]/80 text-center text-xs sm:text-sm">
                  Please keep a screenshot of your payment confirmation for your
                  records.
                </p>
              </div>
            </div>
          )}

          {applicationData.application?.hasAccepted &&
            communityEnabled &&
            communityUrl && (
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
                      href={communityUrl}
                      className="inline-block bg-linear-to-r from-[#134687] to-[#0f3a6b] text-white px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 rounded-lg font-bold text-sm sm:text-base lg:text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {communityLabel}
                    </a>
                  </div>
                  <p className="text-[#134687]/70 text-center text-xs sm:text-sm mt-4">
                    Connect with fellow members and stay updated with exclusive
                    announcements!
                  </p>
                </div>
              </div>
            )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
