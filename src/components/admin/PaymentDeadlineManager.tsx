"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

type ApplicantStatus =
  "no_receipt" | "pending" | "approved" | "needs_revision" | "rejected";

type PaymentApplicant = {
  id: string;
  studentNumber: string;
  name: string;
  email: string;
  applicationType: "member" | "committee" | "executive-associate";
  position: string;
  redirection: string | null;
  paymentProof: string | null;
  paymentStatus: ApplicantStatus;
  hasSubmittedReceipt: boolean;
  updatedAt: string;
  isLate: boolean;
};

type PaymentDeadlineResponse = {
  cycle: { id: string; schoolYear: string } | null;
  deadline: string | null;
  closed: boolean;
  deadlinePassed: boolean;
  reminderRecipientLimit: number;
  applicants: PaymentApplicant[];
  counts: {
    accepted: number;
    noReceipt: number;
    awaitingReview: number;
    approved: number;
    needsRevision: number;
    late: number;
  };
};

type ApplicantFilter = "all" | ApplicantStatus | "late";

async function fetchDeadlineData(
  url: string,
): Promise<PaymentDeadlineResponse> {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load payment deadline settings");
  return response.json();
}

function formatDateTimeInput(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function manilaDateTimeToIso(value: string) {
  const date = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Enter a valid payment deadline");
  }
  return date.toISOString();
}

function formatDeadline(value: string | null) {
  if (!value) return "No deadline set";
  return `${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value))} Philippine Time`;
}

function statusLabel(applicant: PaymentApplicant) {
  if (applicant.isLate && applicant.paymentStatus === "no_receipt") {
    return "Late · No receipt";
  }
  if (applicant.isLate && applicant.paymentStatus === "needs_revision") {
    return "Late · Needs revision";
  }
  if (applicant.isLate && applicant.paymentStatus === "rejected") {
    return "Late · Receipt rejected";
  }
  if (applicant.isLate && applicant.paymentStatus === "pending") {
    return "Late · Receipt awaiting review";
  }
  switch (applicant.paymentStatus) {
    case "no_receipt":
      return "No receipt submitted";
    case "pending":
      return "Awaiting review";
    case "approved":
      return "Approved";
    case "needs_revision":
      return "Needs revision";
    case "rejected":
      return "Rejected";
  }
}

function statusStyle(applicant: PaymentApplicant) {
  if (applicant.isLate) return "border-amber-200 bg-amber-50 text-amber-800";
  if (applicant.paymentStatus === "approved")
    return "border-green-200 bg-green-50 text-green-700";
  if (applicant.paymentStatus === "pending")
    return "border-blue-200 bg-blue-50 text-blue-700";
  if (applicant.paymentStatus === "no_receipt")
    return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-orange-200 bg-orange-50 text-orange-800";
}

function applicationLabel(applicant: PaymentApplicant) {
  const type =
    applicant.applicationType === "executive-associate"
      ? "Executive Associate"
      : applicant.applicationType === "committee"
        ? "Committee Staff"
        : "Member";
  return applicant.position ? `${type} · ${applicant.position}` : type;
}

export default function PaymentDeadlineManager() {
  const { data, error, isLoading, mutate } = useSWR<PaymentDeadlineResponse>(
    "/api/admin/payment-deadline",
    fetchDeadlineData,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
  const [deadlineInput, setDeadlineInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [filter, setFilter] = useState<ApplicantFilter>("all");

  useEffect(() => {
    setDeadlineInput(formatDateTimeInput(data?.deadline ?? null));
  }, [data?.deadline]);

  const applicants = data?.applicants ?? [];
  const visibleApplicants = applicants.filter((applicant) => {
    if (filter === "all") return true;
    if (filter === "late") return applicant.isLate;
    return applicant.paymentStatus === filter;
  });
  const paymentsClosed = data?.closed ?? false;
  const hasDeadlinePassed = data?.deadlinePassed ?? false;

  const savePolicy = async (closed = paymentsClosed) => {
    if (!data?.cycle) {
      toast.error("Create and activate a recruitment cycle first");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/payment-deadline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadline: deadlineInput ? manilaDateTimeToIso(deadlineInput) : null,
          closed,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save payment settings");
      await mutate();
      toast.success("Payment settings saved");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Could not save payment settings",
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePaymentClosure = async () => {
    await savePolicy(!paymentsClosed);
  };

  const sendReminders = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/admin/payment-deadline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not send payment reminders");
      setShowSendConfirmation(false);
      toast.success(
        `Payment deadline reminder sent to ${result.sentCount} applicant${result.sentCount === 1 ? "" : "s"}`,
      );
      await mutate();
    } catch (sendError) {
      toast.error(
        sendError instanceof Error
          ? sendError.message
          : "Could not send payment reminders",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      className="rounded-2xl border border-[#005FD9]/10 bg-white/95 p-5 shadow-sm sm:p-6"
      aria-labelledby="payment-deadline-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="payment-deadline-title"
            className="font-poppins text-sm font-bold text-[#134687]"
          >
            Payment deadline & receipt tracking
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-[#134687]/65">
            Configure the active cycle&apos;s deadline, monitor acknowledgement
            receipt submissions, and email only accepted applicants who have not
            submitted a receipt.
          </p>
        </div>
        {data?.cycle && (
          <span className="w-fit rounded-full bg-[#E8F2FF] px-3 py-1 text-xs font-semibold text-[#044FAF]">
            {data.cycle.schoolYear}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-xl bg-[#F7F9FC] p-5 text-center text-sm text-[#134687]/60">
          Loading payment tracking…
        </div>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load payment settings. Please refresh this section.
        </div>
      ) : !data?.cycle ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No active recruitment cycle. Activate a cycle to configure payment
          settings.
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <form
              className="flex flex-col gap-3 rounded-xl bg-[#F7F9FC] p-4 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void savePolicy();
              }}
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="payment-deadline-input"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#134687]/70"
                >
                  Deadline · Philippine Time
                </label>
                <input
                  id="payment-deadline-input"
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(event) => setDeadlineInput(event.target.value)}
                  className="w-full rounded-lg border border-[#005FD9]/20 bg-white px-3 py-2 text-sm text-[#134687] outline-none focus:ring-2 focus:ring-[#044FAF]/20"
                />
                <p className="mt-1 text-[11px] text-[#134687]/55">
                  Current: {formatDeadline(data.deadline)}
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#134687] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F376B] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save deadline"}
              </button>
            </form>
            <div className="flex flex-col justify-center gap-2 rounded-xl border border-[#005FD9]/10 p-4 lg:min-w-56">
              <p className="text-xs font-semibold text-[#134687]">
                Receipt submissions
              </p>
              <p
                className={`text-xs ${paymentsClosed ? "text-red-700" : hasDeadlinePassed ? "text-amber-800" : "text-green-700"}`}
              >
                {paymentsClosed
                  ? "Closed by Super Admin"
                  : hasDeadlinePassed
                    ? "Deadline passed · still open"
                    : "Open"}
              </p>
              <button
                type="button"
                onClick={() => void togglePaymentClosure()}
                disabled={saving}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${paymentsClosed ? "border-green-200 bg-green-50 text-green-800 hover:bg-green-100" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}
              >
                {saving
                  ? "Saving…"
                  : paymentsClosed
                    ? "Reopen submissions"
                    : "Close submissions"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ["Accepted", data.counts.accepted],
              ["No receipt", data.counts.noReceipt],
              ["Awaiting review", data.counts.awaitingReview],
              ["Approved", data.counts.approved],
              ["Needs action", data.counts.needsRevision],
              ["Late", data.counts.late],
            ].map(([label, count]) => (
              <div
                key={label}
                className="rounded-xl border border-[#005FD9]/10 bg-white p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#134687]/55">
                  {label}
                </p>
                <p className="mt-1 text-xl font-bold text-[#134687]">{count}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#134687]">
                Accepted applicants
              </h3>
              <p className="text-xs text-[#134687]/55">
                Reminder emails target only the no-receipt group. Applicants
                awaiting review are excluded.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="payment-applicant-filter" className="sr-only">
                Filter applicants
              </label>
              <select
                id="payment-applicant-filter"
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as ApplicantFilter)
                }
                className="rounded-lg border border-[#005FD9]/15 bg-white px-3 py-2 text-xs text-[#134687]"
              >
                <option value="all">All statuses</option>
                <option value="no_receipt">No receipt</option>
                <option value="pending">Awaiting review</option>
                <option value="approved">Approved</option>
                <option value="needs_revision">Needs revision</option>
                <option value="rejected">Rejected</option>
                <option value="late">Late</option>
              </select>
              <button
                type="button"
                onClick={() => setShowSendConfirmation(true)}
                disabled={
                  data.counts.noReceipt === 0 ||
                  paymentsClosed ||
                  !data.deadline ||
                  sending
                }
                className="rounded-lg bg-[#134687] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F376B] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Email no-receipt group ({data.counts.noReceipt})
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-[460px] overflow-auto rounded-xl border border-[#005FD9]/10">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="sticky top-0 bg-[#134687] text-[10px] uppercase tracking-wide text-white/85">
                <tr>
                  <th className="px-3 py-3">Applicant</th>
                  <th className="px-3 py-3">Application</th>
                  <th className="px-3 py-3">Receipt</th>
                  <th className="px-3 py-3">Payment status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#005FD9]/10 bg-white">
                {visibleApplicants.map((applicant) => (
                  <tr
                    key={`${applicant.studentNumber}:${applicant.id}`}
                    className="align-top hover:bg-[#F9FBFF]"
                  >
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#134687]">
                        {applicant.name}
                      </p>
                      <p className="mt-0.5 text-[#134687]/65">
                        {applicant.email}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#134687]/50">
                        {applicant.studentNumber}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[#134687]">
                      {applicationLabel(applicant)}
                      {applicant.redirection && (
                        <p className="mt-1 text-[10px] text-[#044FAF]">
                          Redirected to: {applicant.redirection}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {applicant.paymentProof ? (
                        <a
                          href={applicant.paymentProof}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#044FAF] underline"
                        >
                          Open receipt
                        </a>
                      ) : (
                        <span className="text-[#134687]/45">Not submitted</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusStyle(applicant)}`}
                      >
                        {statusLabel(applicant)}
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleApplicants.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-sm text-[#134687]/55"
                    >
                      No accepted applicants match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showSendConfirmation && data?.cycle && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-reminder-confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3
              id="payment-reminder-confirm-title"
              className="font-poppins text-lg font-bold text-[#134687]"
            >
              Send payment deadline reminders?
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#134687]/75">
              This will email <strong>{data.counts.noReceipt}</strong> accepted
              applicant(s) with no acknowledgement receipt on file. Applicants
              whose receipt is awaiting review or already approved will not be
              contacted. The email will state the deadline:{" "}
              <strong>{formatDeadline(data.deadline)}</strong>.
            </p>
            <p className="mt-2 text-xs text-[#134687]/60">
              This action sends real emails via Brevo and cannot be undone.
              Maximum batch: {data.reminderRecipientLimit} recipients.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSendConfirmation(false)}
                disabled={sending}
                className="rounded-lg border border-[#005FD9]/15 px-4 py-2 text-sm font-semibold text-[#134687] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendReminders()}
                disabled={sending}
                className="rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send reminders"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
