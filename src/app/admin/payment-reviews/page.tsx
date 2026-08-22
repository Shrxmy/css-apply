"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import FormProcessingOverlay from "@/components/FormProcessingOverlay";
import AdminEmptyState from "@/components/AdminEmptyState";

type ReviewStatus = "pending" | "approved" | "rejected";
type ApplicationType = "member" | "committee" | "executive-associate";

interface PaymentReview {
  id: string;
  applicationType: ApplicationType;
  acceptedAs: string;
  paymentProof: string;
  paymentStatus: ReviewStatus;
  paymentReviewedAt?: string | null;
  paymentRejectionReason?: string | null;
  reviewedByName?: string | null;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    studentNumber?: string | null;
    section?: string | null;
    memberships: Array<{ memberId: string }>;
  };
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("The server returned an invalid response");
  }
}

const REVIEWS_PER_PAGE = 10;

const typeLabels: Record<ApplicationType, string> = {
  member: "Member",
  committee: "Committee Staff",
  "executive-associate": "Executive Associate",
};

export default function PaymentReviewsPage() {
  const { status: sessionStatus } = useSession();
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>("pending");
  const [reviews, setReviews] = useState<PaymentReview[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [schoolYear, setSchoolYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(
        `/api/admin/payment-reviews?status=${selectedStatus}`,
        { cache: "no-store" },
      );
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to load acknowledgement receipts",
        );
      }
      setReviews(Array.isArray(data.reviews) ? (data.reviews as PaymentReview[]) : []);
      setSchoolYear(typeof data.schoolYear === "string" ? data.schoolYear : "");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load acknowledgement receipts",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    if (sessionStatus !== "loading") void fetchReviews();
  }, [fetchReviews, sessionStatus]);

  const totalPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));
  const paginatedReviews = reviews.slice(
    (currentPage - 1) * REVIEWS_PER_PAGE,
    currentPage * REVIEWS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const reviewReceipt = async (
    review: PaymentReview,
    action: "approve" | "reject",
  ) => {
    if (action === "reject" && !rejectionReason.trim()) {
      toast.error("Enter a reason before rejecting the receipt");
      return;
    }

    setProcessingId(review.id);
    try {
      const response = await fetch("/api/admin/payment-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: review.id,
          applicationType: review.applicationType,
          action,
          rejectionReason: action === "reject" ? rejectionReason.trim() : undefined,
        }),
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to review receipt",
        );
      }

      toast.success(
        action === "approve"
          ? "Receipt approved and Member ID released"
          : "Receipt rejected; the applicant can resubmit",
      );
      setRejectingId(null);
      setRejectionReason("");
      await fetchReviews();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to review receipt",
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-repeat">
      <MobileSidebar>
        <SidebarContent activePage="payment-reviews" />
      </MobileSidebar>

      <main className="h-screen flex-1 overflow-y-auto p-6 pt-16 md:p-8 md:pt-12">
        <header className="mb-8 mt-12 text-center md:mt-8 md:text-left">
          <div className="mb-4 w-fit max-w-full rounded-[45px] px-6 py-2 text-center text-lg font-poppins font-medium text-white [background:linear-gradient(90deg,_#2F7EE3_0%,_#0349A2_100%)] lg:py-4 lg:text-4xl">
            Acknowledgement Receipt Review
          </div>
          <p className="mb-4 text-xs font-Inter font-light leading-5 text-black md:mb-6 lg:text-lg">
            Verify submitted receipts for AY {schoolYear || "—"}. Approving a
            receipt releases the applicant&apos;s Member ID.
          </p>
          <hr className="border-[#005FD9]" />
        </header>

        <section>
          <div className="mb-5 rounded-xl border border-[#005FD9]/10 bg-white p-5">
            <div className="w-full sm:w-fit">
              <label
                htmlFor="payment-review-status"
                className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#134687]/50 font-mono"
              >
                Status
              </label>
              <select
                id="payment-review-status"
                value={selectedStatus}
                onChange={(event) => {
                  setSelectedStatus(event.target.value as ReviewStatus);
                  setCurrentPage(1);
                  setRejectingId(null);
                  setRejectionReason("");
                }}
                className="w-full rounded-lg border border-[#005FD9]/15 px-3 py-2 text-sm text-[#134687] focus:outline-none focus:ring-2 focus:ring-[#044FAF]/20 sm:w-auto"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="mb-5 min-h-[calc(100vh-180px)] rounded-xl border border-[#005FD9]/10 bg-white p-5 md:min-h-[calc(100vh-280px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner label="Loading receipts" size="md" />
              <p className="mt-3 text-sm text-[#134687]/60">Loading receipts...</p>
            </div>
          ) : loadError ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-sm text-red-700">{loadError}</p>
              <button
                type="button"
                onClick={() => void fetchReviews()}
                className="rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </div>
          ) : reviews.length === 0 ? (
            <AdminEmptyState
              title={`No ${selectedStatus} acknowledgement receipts`}
              description="Receipt submissions will appear here when they match this review status."
            />
          ) : (
            <div className="space-y-3">
              {paginatedReviews.map((review) => {
                const isProcessing = processingId === review.id;
                const isRejecting = rejectingId === review.id;
                return (
                  <article
                    key={`${review.applicationType}-${review.id}`}
                    aria-busy={isProcessing}
                    className="relative overflow-hidden rounded-lg border border-[#005FD9]/10 p-4 transition-colors hover:bg-[#F3F3FD]/50"
                  >
                    <FormProcessingOverlay
                      active={isProcessing}
                      label={
                        isRejecting
                          ? "Rejecting acknowledgement receipt..."
                          : "Approving acknowledgement receipt..."
                      }
                    />
                    <fieldset
                      disabled={isProcessing}
                      className={`border-0 p-0 transition ${
                        isProcessing ? "opacity-45 grayscale" : "opacity-100"
                      }`}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-semibold text-[#134687]">
                              {review.user.name}
                            </h2>
                            <span className="rounded-full bg-[#044FAF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#044FAF]">
                              {typeLabels[review.applicationType]}
                            </span>
                          </div>
                          <p className="break-all text-xs text-[#134687]/60 font-mono">
                            {review.user.studentNumber || "No student number"} ·{" "}
                            {review.user.section || "No section"} · {review.user.email}
                          </p>
                          <p className="text-xs text-[#134687]/60 font-mono">
                            Accepted as: <strong>{review.acceptedAs}</strong>
                          </p>
                          <p className="text-xs text-[#134687]/50 font-mono">
                            Submitted {new Date(review.updatedAt).toLocaleString()}
                          </p>
                          {review.paymentReviewedAt && (
                            <p className="text-xs text-[#134687]/50 font-mono">
                              Reviewed by {review.reviewedByName || "Administrator"} on{" "}
                              {new Date(review.paymentReviewedAt).toLocaleString()}
                            </p>
                          )}
                          {review.paymentRejectionReason && (
                            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                              Reason: {review.paymentRejectionReason}
                            </p>
                          )}
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-64">
                          <a
                            href={review.paymentProof}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-[#134687]/20 px-4 py-2.5 text-center text-sm font-semibold text-[#134687] hover:bg-[#F3F3FD]"
                          >
                            Open Receipt in Google Drive
                          </a>

                          {selectedStatus === "pending" && !isRejecting && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => void reviewReceipt(review, "approve")}
                                className="rounded-lg bg-[#134687] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d3569]"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingId(review.id);
                                  setRejectionReason("");
                                }}
                                className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {selectedStatus === "pending" && isRejecting && (
                            <div className="space-y-2 rounded-lg bg-red-50 p-3">
                              <label
                                htmlFor={`rejection-${review.id}`}
                                className="block text-xs font-semibold text-red-800"
                              >
                                Why is this receipt invalid?
                              </label>
                              <textarea
                                id={`rejection-${review.id}`}
                                value={rejectionReason}
                                onChange={(event) => setRejectionReason(event.target.value)}
                                maxLength={500}
                                rows={3}
                                required
                                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => void reviewReceipt(review, "reject")}
                                  className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
                                >
                                  Confirm Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingId(null);
                                    setRejectionReason("");
                                  }}
                                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {selectedStatus === "approved" &&
                            review.user.memberships[0]?.memberId && (
                              <p className="rounded-lg bg-green-50 p-3 text-center text-sm font-semibold text-green-700">
                                Member ID: {review.user.memberships[0].memberId}
                              </p>
                            )}
                        </div>
                      </div>
                    </fieldset>
                  </article>
                );
              })}
            </div>
          )}
          </div>

          {reviews.length > REVIEWS_PER_PAGE && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#005FD9]/10 bg-white p-4">
              <div className="text-xs text-[#134687]/40 font-mono">
                {(currentPage - 1) * REVIEWS_PER_PAGE + 1}&ndash;
                {Math.min(currentPage * REVIEWS_PER_PAGE, reviews.length)} /{" "}
                {reviews.length}
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => page - 1)}
                  disabled={currentPage <= 1}
                  className="rounded border border-[#005FD9]/15 px-2.5 py-1 text-xs text-[#134687] font-mono hover:bg-[#F3F3FD] disabled:opacity-30"
                >
                  prev
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter(
                    (page) =>
                      totalPages <= 5 ||
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1,
                  )
                  .map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`rounded px-2.5 py-1 text-xs font-mono ${
                        currentPage === page
                          ? "bg-[#044FAF] text-white"
                          : "border border-[#005FD9]/15 text-[#134687] hover:bg-[#F3F3FD]"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => page + 1)}
                  disabled={currentPage >= totalPages}
                  className="rounded border border-[#005FD9]/15 px-2.5 py-1 text-xs text-[#134687] font-mono hover:bg-[#F3F3FD] disabled:opacity-30"
                >
                  next
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
