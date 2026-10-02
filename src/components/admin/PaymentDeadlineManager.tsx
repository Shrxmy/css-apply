"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { committeeRoles } from "@/data/committeeRoles";
import { roles as executiveAssociateRoles } from "@/data/ebRoles";

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
  if (applicant.isLate) {
    switch (applicant.paymentStatus) {
      case "no_receipt":
        return "Late · No receipt";
      case "needs_revision":
        return "Late · Needs revision";
      case "rejected":
        return "Late · Receipt rejected";
      case "pending":
        return "Late · Awaiting review";
    }
  }

  switch (applicant.paymentStatus) {
    case "no_receipt":
      return "No receipt";
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

function statusTone(applicant: PaymentApplicant) {
  if (applicant.isLate) return "bg-[#8A5B22] text-white";
  if (applicant.paymentStatus === "approved") return "bg-[#3C684A] text-white";
  if (applicant.paymentStatus === "pending") return "bg-[#315A7B] text-white";
  if (applicant.paymentStatus === "no_receipt") {
    return "bg-[#E3E7EB] text-[#394654]";
  }
  return "bg-[#91483F] text-white";
}

function applicationLabel(applicant: PaymentApplicant) {
  if (applicant.applicationType === "member") return "Member";
  if (applicant.applicationType === "committee") {
    const committee = committeeRoles.find(
      (role) => role.id === applicant.position,
    );
    return `Committee Staff · ${committee?.title ?? applicant.position}`;
  }
  const role = executiveAssociateRoles.find(
    (item) => item.id === applicant.position,
  );
  return `Executive Associate · ${role?.title ?? applicant.position}`;
}

function redirectionLabel(redirection: string) {
  if (redirection === "member") return "Member";
  const committeeId = redirection.startsWith("committee-")
    ? redirection.slice("committee-".length)
    : redirection;
  const committee = committeeRoles.find((role) => role.id === committeeId);
  if (committee) return `${committee.title} Staff`;
  const role = executiveAssociateRoles.find((item) => item.id === redirection);
  return role?.title ?? redirection;
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
      if (!response.ok) {
        throw new Error(result.error || "Could not save payment settings");
      }
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

  const togglePaymentClosure = async () => savePolicy(!paymentsClosed);

  const sendReminders = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/admin/payment-deadline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not send payment reminders");
      }
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
    <section className="space-y-5" aria-labelledby="payment-deadline-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="payment-deadline-title"
            className="font-poppins text-base font-bold text-[#134687]"
          >
            Payment deadline & receipt tracking
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#58687A]">
            Set the active cycle&apos;s payment deadline, monitor
            acknowledgement receipts, and contact accepted applicants who have
            not submitted one.
          </p>
        </div>
        {data?.cycle && (
          <span className="w-fit rounded-full bg-[#E4EAF0] px-3 py-1 text-xs font-semibold text-[#34475B]">
            {data.cycle.schoolYear}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl bg-[#F1F3F5] p-5 text-center text-sm text-[#58687A]">
          Loading payment tracking…
        </div>
      ) : error ? (
        <div className="rounded-xl bg-[#F1E6E4] p-4 text-sm text-[#7B332C]">
          Could not load payment settings. Please refresh this section.
        </div>
      ) : !data?.cycle ? (
        <div className="rounded-xl bg-[#F2EBDD] p-4 text-sm text-[#705522]">
          No active recruitment cycle. Activate a cycle to configure payment
          settings.
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <form
              className="flex flex-col gap-3 rounded-xl bg-[#F1F3F5] p-4 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void savePolicy();
              }}
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="payment-deadline-input"
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#58687A]"
                >
                  Deadline · Philippine Time
                </label>
                <input
                  id="payment-deadline-input"
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(event) => setDeadlineInput(event.target.value)}
                  className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-[#26394D] outline-none focus-visible:ring-2 focus-visible:ring-[#58728B]"
                />
                <p className="mt-1 text-[10px] text-[#667587]">
                  Current: {formatDeadline(data.deadline)}
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#244E76] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1C3E60] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58728B] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save deadline"}
              </button>
            </form>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F1F3F5] p-4 lg:flex-col lg:items-stretch">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#58687A]">
                  Receipt submissions
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    paymentsClosed
                      ? "bg-[#E9D8D5] text-[#74352F]"
                      : hasDeadlinePassed
                        ? "bg-[#E9DFC9] text-[#6D5424]"
                        : "bg-[#DCE7DE] text-[#365B40]"
                  }`}
                >
                  {paymentsClosed
                    ? "Closed"
                    : hasDeadlinePassed
                      ? "Past deadline · Open"
                      : "Open"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void togglePaymentClosure()}
                disabled={saving}
                className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58728B] focus-visible:ring-offset-2 disabled:opacity-50 ${
                  paymentsClosed
                    ? "bg-[#3C684A] hover:bg-[#31573D]"
                    : "bg-[#6D4944] hover:bg-[#5B3B37]"
                }`}
              >
                {saving
                  ? "Saving…"
                  : paymentsClosed
                    ? "Reopen submissions"
                    : "Close submissions"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ["Accepted", data.counts.accepted],
              ["No receipt", data.counts.noReceipt],
              ["Awaiting review", data.counts.awaitingReview],
              ["Approved", data.counts.approved],
              ["Needs action", data.counts.needsRevision],
              ["Late", data.counts.late],
            ].map(([label, count]) => (
              <div key={label} className="rounded-lg bg-[#F1F3F5] px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[#667587]">
                  {label}
                </p>
                <p className="mt-0.5 text-lg font-bold leading-5 text-[#26394D]">
                  {count}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#26394D]">
                Accepted applicants
              </h3>
              <p className="text-[11px] text-[#667587]">
                Reminders go only to applicants without a receipt; submitted
                receipts awaiting review are excluded.
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
                className="rounded-lg border-0 bg-[#F1F3F5] px-3 py-2 text-xs text-[#34475B] outline-none focus-visible:ring-2 focus-visible:ring-[#58728B]"
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
                className="rounded-lg bg-[#244E76] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1C3E60] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58728B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#A8B3BD]"
              >
                Email no-receipt group ({data.counts.noReceipt})
              </button>
            </div>
          </div>

          <div className="max-h-[460px] overflow-auto rounded-xl bg-white">
            <table className="w-full min-w-[700px] table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[26%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead className="sticky top-0 bg-[#244E76] text-[9px] uppercase tracking-wider text-white">
                <tr>
                  <th className="px-3 py-2.5">Applicant</th>
                  <th className="px-3 py-2.5">Type / Position</th>
                  <th className="px-3 py-2.5 text-center">Receipt</th>
                  <th className="px-3 py-2.5 text-center">Payment status</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[#34475B]">
                {visibleApplicants.map((applicant) => (
                  <tr
                    key={`${applicant.studentNumber}:${applicant.id}`}
                    className="align-middle odd:bg-white even:bg-[#F4F6F8] hover:bg-[#E9EEF2]"
                  >
                    <td className="px-3 py-2">
                      <p className="truncate font-semibold uppercase text-[#26394D]">
                        {applicant.name}
                      </p>
                      <p className="truncate text-[10px] text-[#687789]">
                        {applicant.email}
                        {applicant.studentNumber &&
                          ` · ${applicant.studentNumber}`}
                      </p>
                    </td>
                    <td className="truncate px-3 py-2 text-[#34475B]">
                      <span title={applicationLabel(applicant)}>
                        {applicationLabel(applicant)}
                      </span>
                      {applicant.redirection && (
                        <p className="truncate text-[9px] text-[#687789]">
                          Redirected to {redirectionLabel(applicant.redirection)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {applicant.paymentProof ? (
                        <a
                          href={applicant.paymentProof}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#244E76] underline underline-offset-2 hover:text-[#1C3E60]"
                        >
                          Open receipt
                        </a>
                      ) : (
                        <span className="text-[#687789]">Not submitted</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-[9px] font-semibold leading-tight ${statusTone(applicant)}`}
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
                      className="px-3 py-8 text-center text-[#667587]"
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
              className="font-poppins text-lg font-bold text-[#26394D]"
            >
              Send payment deadline reminders?
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#58687A]">
              This will email <strong>{data.counts.noReceipt}</strong> accepted
              applicant(s) with no acknowledgement receipt on file. Applicants
              whose receipt is awaiting review or already approved will not be
              contacted. The email will state the deadline:{" "}
              <strong>{formatDeadline(data.deadline)}</strong>.
            </p>
            <p className="mt-2 text-xs text-[#667587]">
              This sends real emails via Brevo and cannot be undone. Maximum
              batch: {data.reminderRecipientLimit} recipients.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSendConfirmation(false)}
                disabled={sending}
                className="rounded-lg bg-[#E8ECEF] px-4 py-2 text-sm font-semibold text-[#34475B] hover:bg-[#DCE2E7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58728B] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendReminders()}
                disabled={sending}
                className="rounded-lg bg-[#244E76] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1C3E60] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58728B] disabled:opacity-50"
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
