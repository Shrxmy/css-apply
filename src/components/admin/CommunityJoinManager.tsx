"use client";

import { useCallback, useEffect, useState } from "react";

type CommunityApplicant = {
  userId: string;
  name: string;
  email: string;
  applicationTypes: string[];
  paymentRequirementAcknowledgedAt: string | null;
  hasJoined: boolean | null;
  respondedAt: string | null;
  lastReminderSentAt: string | null;
  reminderCount: number;
};

type CommunityDashboard = {
  cycle: { id: string; schoolYear: string } | null;
  community: { enabled: boolean; configured: boolean; label: string };
  totalAccepted: number;
  joinedCount: number;
  notYetJoinedCount: number;
  notAnsweredCount: number;
  unconfirmedCount: number;
  sendableCount: number;
  invalidEmailCount: number;
  applicants: CommunityApplicant[];
  recipientLimit: number;
};

export default function CommunityJoinManager() {
  const [dashboard, setDashboard] = useState<CommunityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/community-reminders", {
        cache: "no-store",
      });
      const data = (await response.json()) as CommunityDashboard & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Could not load community status.");
      setDashboard(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load community status.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendReminders = async () => {
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/community-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        sentCount?: number;
        message?: string;
        error?: string;
        emailsAccepted?: boolean;
      };
      if (!response.ok) {
        throw new Error(
          data.emailsAccepted
            ? `${data.error} Do not resend until the provider history has been checked.`
            : data.error || "Could not send community reminders.",
        );
      }
      setNotice(
        data.message ||
          `Email provider accepted ${data.sentCount || 0} reminders.`,
      );
      setShowConfirmation(false);
      await refresh();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send community reminders.",
      );
      setShowConfirmation(false);
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(
    dashboard?.cycle &&
    dashboard.community.enabled &&
    dashboard.community.configured &&
    dashboard.sendableCount > 0 &&
    dashboard.sendableCount <= dashboard.recipientLimit,
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#005FD9]/10 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-poppins text-xl font-bold text-[#134687]">
              Community Join Reminders
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#134687]/65">
              Review accepted applicants who have not confirmed joining, then
              manually send them a reminder. Nothing is sent automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || sending}
            className="shrink-0 rounded-lg border border-[#005FD9]/20 px-4 py-2 text-sm font-semibold text-[#134687] transition-colors hover:bg-[#F3F8FF] disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh status"}
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-[#D6A326]/25 bg-[#FFF8E7] p-4 text-sm leading-relaxed text-[#6F4B00]">
          Community membership cannot be verified automatically. Until an
          applicant answers the portal question, they are treated as unconfirmed
          (including applicants who may already have joined). The reminder asks
          those members to confirm in CSSApply. Payment and approval of the
          acknowledgement receipt are required before their Member ID is
          released.
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {notice}
          </p>
        )}
      </section>

      {loading && !dashboard ? (
        <div className="rounded-2xl border border-[#005FD9]/10 bg-white py-12 text-center text-sm text-[#134687]/60">
          Loading community confirmation status…
        </div>
      ) : dashboard ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Accepted applicants", value: dashboard.totalAccepted },
              { label: "Confirmed joined", value: dashboard.joinedCount },
              {
                label: "Answered ‘not yet’",
                value: dashboard.notYetJoinedCount,
              },
              { label: "Not answered", value: dashboard.notAnsweredCount },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#005FD9]/10 bg-white p-4"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#134687]/50">
                  {item.label}
                </p>
                <p className="mt-1 font-poppins text-2xl font-bold text-[#044FAF]">
                  {item.value}
                </p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#005FD9]/10 bg-white">
            <div className="flex flex-col gap-4 border-b border-[#005FD9]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-poppins text-lg font-bold text-[#134687]">
                  {dashboard.cycle
                    ? `${dashboard.cycle.schoolYear} unconfirmed applicants`
                    : "No active recruitment cycle"}
                </h3>
                <p className="mt-1 text-xs text-[#134687]/60">
                  {dashboard.unconfirmedCount} not confirmed ·{" "}
                  {dashboard.sendableCount} valid email address
                  {dashboard.sendableCount === 1 ? "" : "es"}
                  {dashboard.invalidEmailCount > 0
                    ? ` · ${dashboard.invalidEmailCount} invalid address${dashboard.invalidEmailCount === 1 ? "" : "es"} excluded`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmation(true)}
                disabled={!canSend || sending || loading}
                className="rounded-lg bg-[#134687] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0F376B] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending
                  ? "Sending…"
                  : `Send reminders (${dashboard.sendableCount})`}
              </button>
            </div>

            {(!dashboard.community.enabled ||
              !dashboard.community.configured) && (
              <p className="border-b border-[#D6A326]/20 bg-[#FFF8E7] px-5 py-3 text-sm text-[#6F4B00]">
                Community invitations are disabled or the HTTPS group link is
                missing. Configure them in Super Admin → Configuration before
                sending reminders.
              </p>
            )}
            {dashboard.sendableCount > dashboard.recipientLimit && (
              <p className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                The batch exceeds the {dashboard.recipientLimit}-recipient
                safety limit. No email will be sent.
              </p>
            )}

            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 bg-[#F3F8FF] text-[10px] uppercase tracking-wider text-[#134687]/60">
                  <tr>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Application</th>
                    <th className="px-4 py-3">Confirmation</th>
                    <th className="px-4 py-3">Last reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#005FD9]/10">
                  {dashboard.applicants.map((applicant) => (
                    <tr key={applicant.userId} className="hover:bg-[#F9FBFF]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#134687]">
                          {applicant.name}
                        </p>
                        <p className="text-xs text-[#134687]/60">
                          {applicant.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#134687]/70">
                        {applicant.applicationTypes.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {applicant.hasJoined === false ? (
                          <span className="rounded-full bg-[#FFF8E7] px-2.5 py-1 font-semibold text-[#8A5A00]">
                            Not joined yet
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#F3F3FD] px-2.5 py-1 font-semibold text-[#134687]/70">
                            Awaiting confirmation
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#134687]/70">
                        {applicant.lastReminderSentAt
                          ? `${new Date(applicant.lastReminderSentAt).toLocaleString("en-PH")} · ${applicant.reminderCount} sent`
                          : "Never sent"}
                      </td>
                    </tr>
                  ))}
                  {!dashboard.applicants.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-sm text-[#134687]/55"
                      >
                        {dashboard.cycle
                          ? "Everyone has confirmed joining for this cycle."
                          : "There is no active recruitment cycle."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {showConfirmation && dashboard && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !sending) {
              setShowConfirmation(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-reminder-confirm-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="community-reminder-confirm-title"
              className="font-poppins text-lg font-bold text-[#134687]"
            >
              Confirm community reminder batch
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#134687]/75">
              Send the CSS community reminder to {dashboard.sendableCount}{" "}
              accepted applicant{dashboard.sendableCount === 1 ? "" : "s"} who
              have not confirmed joining? Each receives an individual email. The
              batch is capped at {dashboard.recipientLimit} recipients.
            </p>
            <p className="mt-3 rounded-lg bg-[#F3F8FF] p-3 text-xs leading-relaxed text-[#134687]/75">
              The email directs applicants to CSSApply; the group invite remains
              behind the required payment acknowledgement. The system records
              only that the email provider accepted the batch, not that each
              message reached an inbox.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={sending}
                onClick={() => setShowConfirmation(false)}
                className="rounded-lg border border-[#005FD9]/20 px-4 py-2 text-sm font-semibold text-[#134687] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSend || sending}
                onClick={() => void sendReminders()}
                className="rounded-lg bg-[#134687] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send reminders"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
