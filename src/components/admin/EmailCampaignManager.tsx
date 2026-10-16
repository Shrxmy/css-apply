"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  card,
  cardHeader,
  checkbox,
  fieldLabel,
  focus,
  hint,
  input,
  primary,
  secondary,
} from "@/components/admin/ui";
import { EMAIL_CAMPAIGN_RECIPIENT_LIMIT } from "@/lib/email-campaign-contract";
import type {
  EmailCampaignAudience,
  EmailCampaignContent,
  EmailCampaignDetail,
  EmailCampaignGroup,
  EmailCampaignStatus,
  EmailCampaignSummary,
} from "@/lib/email-campaign-contract";

const API = "/api/admin/email-campaigns";
const GROUPS: { value: EmailCampaignGroup; label: string }[] = [
  { value: "ea", label: "EAs" },
  { value: "staff", label: "Staff" },
  { value: "member", label: "Members" },
];
const optional = (
  <span className="font-normal text-[#134687]/45"> · optional</span>
);

function statusTone(status: EmailCampaignStatus | "PENDING") {
  switch (status) {
    case "ACCEPTED":
      return "bg-green-50 text-green-800";
    case "FAILED":
      return "bg-red-50 text-red-700";
    case "SENDING":
    case "UNKNOWN":
      return "bg-[#FFF8E7] text-[#8A5A00]";
    default:
      return "bg-[#F3F3FD] text-[#134687]/75";
  }
}

// This is only a client-side guard; every API must also enforce super_admin.
export default function EmailCampaignManager() {
  const { data: session, status } = useSession();
  if (status === "loading") {
    return <LoadingSpinner label="Checking email campaign access" size="sm" />;
  }
  if (status !== "authenticated" || session?.user?.role !== "super_admin") {
    return (
      <p role="status">Email campaigns are available to Super Admins only.</p>
    );
  }
  return <CampaignComposer />;
}

type CampaignRequest = {
  clientRequestId: string;
  recruitmentCycleId: string;
  content: EmailCampaignContent;
  recipientIds: string[];
};
type CapturedContent = Omit<CampaignRequest, "clientRequestId">;
type Review = {
  captured: CapturedContent;
  subject: string;
  html: string;
};
type Attempt = {
  request: CampaignRequest;
  campaign: EmailCampaignDetail | null;
  sendAttempted: boolean;
  uncertain: boolean;
};

function emptyContent(): EmailCampaignContent {
  return {
    templateType: "event",
    logo: "cssapply",
    subject: "",
    title: "",
    body: "",
  };
}

function enabledGroups(): Record<EmailCampaignGroup, boolean> {
  return { ea: true, staff: true, member: true };
}

function statusLabel(status: EmailCampaignStatus | "PENDING") {
  switch (status) {
    case "ACCEPTED":
      return "Provider accepted";
    case "SENDING":
      return "Sending · do not resend";
    case "UNKNOWN":
      return "Unknown · do not resend";
    case "FAILED":
      return "Failed · check provider logs";
    case "DRAFT":
      return "Draft";
    case "PENDING":
      return "Pending";
    default:
      return "Unrecognized status · do not resend";
  }
}

function isUncertain(campaign: EmailCampaignDetail, sendAttempted: boolean) {
  return (
    campaign.status === "SENDING" ||
    campaign.status === "UNKNOWN" ||
    (sendAttempted && campaign.status === "DRAFT")
  );
}

async function requestJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `Request failed (${response.status}).`,
    );
  }
  if (!data) throw new Error("The server returned an unreadable response.");
  return data as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not finish.";
}

function validatedContent(content: EmailCampaignContent): EmailCampaignContent {
  const result: EmailCampaignContent = {
    templateType: content.templateType,
    logo: content.logo ?? "cssapply",
    subject: content.subject.trim(),
    title: content.title.trim(),
    body: content.body.trim(),
  };
  if (!result.subject || !result.title || !result.body) {
    throw new Error("Enter a subject, title, and plain-text body.");
  }
  const label = content.ctaLabel?.trim() || "";
  const url = content.ctaUrl?.trim() || "";
  if (Boolean(label) !== Boolean(url)) {
    throw new Error(
      "Provide both the button label and HTTPS URL, or leave both blank.",
    );
  }
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Enter a valid HTTPS button URL.");
    }
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error(
        "The button URL must use HTTPS and must not contain credentials.",
      );
    }
    result.ctaLabel = label;
    result.ctaUrl = url;
  }
  if (result.templateType === "event") {
    for (const field of ["eventDate", "eventTime", "eventVenue"] as const) {
      if (content[field]?.trim()) result[field] = content[field]!.trim();
    }
  }
  return result;
}

function CampaignComposer() {
  const [audience, setAudience] = useState<EmailCampaignAudience | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(true);
  const [audienceError, setAudienceError] = useState("");
  const [history, setHistory] = useState<EmailCampaignSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [detail, setDetail] = useState<EmailCampaignDetail | null>(null);
  const [groups, setGroups] = useState(enabledGroups);
  const groupsRef = useRef(groups);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [content, setContent] = useState(emptyContent);
  const [review, setReview] = useState<Review | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Synchronous guards also cover rapid double-clicks before React renders.
  const inFlight = useRef(false);
  const attemptRef = useRef<Attempt | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const capturedHeading = useRef<HTMLHeadingElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const wasReviewing = useRef(false);

  const rememberAttempt = (next: Attempt | null) => {
    attemptRef.current = next;
    setAttempt(next);
  };

  const loadAudience = useCallback(async () => {
    setAudienceLoading(true);
    setAudienceError("");
    try {
      const data = await requestJson<EmailCampaignAudience>(
        `${API}/recipients`,
      );
      setAudience(data);
      // Keep selections only if they are still in the current eligible audience.
      setSelected(
        (previous) =>
          new Set(
            [...previous].filter((id) =>
              data.recipients.some(
                (person) =>
                  person.userId === id &&
                  person.groups.some((group) => groupsRef.current[group]),
              ),
            ),
          ),
      );
    } catch (loadError) {
      setAudienceError(errorMessage(loadError));
    } finally {
      setAudienceLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await requestJson<{ campaigns: EmailCampaignSummary[] }>(
        API,
      );
      setHistory(data.campaigns);
    } catch (loadError) {
      setHistoryError(errorMessage(loadError));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudience();
    void loadHistory();
  }, [loadAudience, loadHistory]);

  useEffect(() => {
    if (review) reviewHeading.current?.focus();
    else if (wasReviewing.current) {
      if (attemptRef.current) capturedHeading.current?.focus();
      else reviewButton.current?.focus();
    }
    wasReviewing.current = Boolean(review);
  }, [review]);

  useEffect(() => {
    if (!attempt?.uncertain) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempt?.uncertain]);

  const busy = Boolean(operation) || audienceLoading || historyLoading;
  const frozen = busy || Boolean(review) || Boolean(attempt);
  const recipients = [
    ...new Map(
      (audience?.recipients ?? []).map((person) => [person.userId, person]),
    ).values(),
  ];
  const eligible = recipients.filter((person) =>
    person.groups.some((group) => groups[group]),
  );
  const selectedRecipients = eligible.filter((person) =>
    selected.has(person.userId),
  );
  const query = search.trim().toLowerCase();
  const filtered = eligible.filter((person) =>
    [
      person.name,
      person.email,
      ...person.positions,
      ...person.groups.map(
        (group) => GROUPS.find((item) => item.value === group)?.label ?? group,
      ),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
  const selectedInSearch = filtered.filter((person) =>
    selected.has(person.userId),
  ).length;
  const tooMany = selectedRecipients.length > EMAIL_CAMPAIGN_RECIPIENT_LIMIT;
  const canReview = attempt
    ? attempt.campaign?.status === "DRAFT" &&
      !attempt.sendAttempted &&
      !attempt.uncertain
    : Boolean(audience?.cycle) &&
      !audienceError &&
      selectedRecipients.length > 0 &&
      !tooMany;

  const changeGroup = (group: EmailCampaignGroup, checked: boolean) => {
    const next = { ...groups, [group]: checked };
    groupsRef.current = next;
    setGroups(next);
    setSelected(
      (previous) =>
        new Set(
          [...previous].filter((id) =>
            recipients.some(
              (person) =>
                person.userId === id &&
                person.groups.some((value) => next[value]),
            ),
          ),
        ),
    );
  };

  const begin = (label: string) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setOperation(label);
    setError("");
    setNotice("");
    return true;
  };
  const finish = () => {
    inFlight.current = false;
    setOperation("");
  };
  const recordCampaign = (campaign: EmailCampaignDetail) => {
    setHistory((previous) =>
      [campaign, ...previous.filter((item) => item.id !== campaign.id)].slice(
        0,
        50,
      ),
    );
  };

  const prepareReview = async () => {
    if (!canReview || review || busy || !begin("Generating fresh preview…"))
      return;
    try {
      const captured: CapturedContent = attemptRef.current?.request ?? {
        recruitmentCycleId: audience!.cycle!.id,
        content: validatedContent(content),
        recipientIds: selectedRecipients.map((person) => person.userId),
      };
      if (
        !captured.recipientIds.length ||
        captured.recipientIds.length > EMAIL_CAMPAIGN_RECIPIENT_LIMIT
      ) {
        throw new Error(
          `Choose between 1 and ${EMAIL_CAMPAIGN_RECIPIENT_LIMIT} recipients.`,
        );
      }
      const preview = await requestJson<{ subject: string; html: string }>(
        `${API}/preview`,
        {
          content: captured.content,
        },
      );
      if (
        typeof preview.html !== "string" ||
        typeof preview.subject !== "string"
      ) {
        throw new Error("The server did not return a valid preview.");
      }
      setAcknowledged(false);
      setReview({ captured, subject: preview.subject, html: preview.html });
    } catch (previewError) {
      setError(errorMessage(previewError));
    } finally {
      finish();
    }
  };

  const createDraft = async (current: Attempt) => {
    const { campaign } = await requestJson<{ campaign: EmailCampaignDetail }>(
      API,
      current.request,
    );
    if (!campaign?.id || !campaign.status)
      throw new Error("The server did not return a campaign ID and status.");
    const next = {
      ...current,
      campaign,
      uncertain: isUncertain(campaign, current.sendAttempted),
    };
    rememberAttempt(next);
    recordCampaign(campaign);
    return next;
  };

  const confirmSend = async () => {
    if (!review || !acknowledged || busy || !begin("Saving campaign…")) return;
    let current = attemptRef.current;
    try {
      if (!current) {
        current = {
          request: { ...review.captured, clientRequestId: crypto.randomUUID() },
          campaign: null,
          sendAttempted: false,
          uncertain: true,
        };
        // Capture the immutable request BEFORE making a potentially ambiguous POST.
        rememberAttempt(current);
      }
      if (!current.campaign) current = await createDraft(current);
      if (
        current.campaign?.status !== "DRAFT" ||
        current.sendAttempted ||
        current.uncertain
      ) {
        throw new Error(
          "This campaign cannot be sent from the composer. Refresh its status and check provider logs.",
        );
      }
      current = { ...current, sendAttempted: true, uncertain: true };
      rememberAttempt(current);
      setOperation("Sending campaign…");
      const { campaign } = await requestJson<{ campaign: EmailCampaignDetail }>(
        `${API}/${encodeURIComponent(current.campaign!.id)}/send`,
        { confirmed: true },
      );
      if (
        !campaign?.id ||
        campaign.id !== current.campaign!.id ||
        !campaign.status
      ) {
        throw new Error(
          "The server did not return the captured campaign status.",
        );
      }
      rememberAttempt({
        ...current,
        campaign,
        uncertain: isUncertain(campaign, true),
      });
      recordCampaign(campaign);
      setNotice(
        campaign.status === "ACCEPTED"
          ? `Provider accepted ${campaign.counts.accepted} of ${campaign.counts.total} emails. This does not confirm inbox receipt.`
          : "Send request recorded. Review the campaign status below; do not resend.",
      );
    } catch (sendError) {
      // Never discard the request ID or campaign ID, and never retry a send.
      setError(
        `${errorMessage(sendError)} Your content and recipients are preserved.`,
      );
    } finally {
      setReview(null);
      setAcknowledged(false);
      finish();
    }
  };

  const recoverDraft = async () => {
    const current = attemptRef.current;
    if (
      !current ||
      current.campaign ||
      busy ||
      !begin("Recovering saved draft…")
    )
      return;
    try {
      await createDraft(current); // Same UUID and payload; this action NEVER sends.
      setNotice(
        "Saved campaign recovered. Review a fresh preview and confirm separately to send a draft.",
      );
    } catch (saveError) {
      setError(
        `${errorMessage(saveError)} The same request ID is retained. No send was requested.`,
      );
    } finally {
      finish();
    }
  };

  const refreshCampaign = async (id: string, showDetail = false) => {
    if (busy || review || !begin("Refreshing campaign status…")) return;
    try {
      const { campaign } = await requestJson<{ campaign: EmailCampaignDetail }>(
        `${API}/${encodeURIComponent(id)}`,
      );
      if (!campaign?.id || campaign.id !== id || !campaign.status) {
        throw new Error(
          "The server did not return the requested campaign status.",
        );
      }
      const current = attemptRef.current;
      if (current?.campaign?.id === id) {
        rememberAttempt({
          ...current,
          campaign,
          uncertain: isUncertain(campaign, current.sendAttempted),
        });
      }
      recordCampaign(campaign);
      if (showDetail || detail?.id === id) setDetail(campaign);
      setNotice("Campaign status refreshed. No email was sent.");
    } catch (refreshError) {
      setError(
        `${errorMessage(refreshError)} Status could not be verified. Do not resend; check provider logs.`,
      );
    } finally {
      finish();
    }
  };

  const newCampaign = () => {
    if (busy || review) return;
    const uncertain =
      attempt?.uncertain ||
      !attempt?.campaign ||
      attempt?.campaign.status === "SENDING" ||
      attempt?.campaign.status === "UNKNOWN";
    const warning =
      attempt && uncertain
        ? "The previous campaign status is uncertain. Do not resend its content until you check provider logs. Starting a new campaign may cause duplicate emails. Discard this local draft and intentionally start a NEW campaign?"
        : "Discard this local draft and start a NEW campaign? This does not cancel or undo any previous campaign.";
    if (!window.confirm(warning)) return;
    rememberAttempt(null);
    setContent(emptyContent());
    setSelected(new Set());
    groupsRef.current = enabledGroups();
    setGroups(groupsRef.current);
    setSearch("");
    setReview(null);
    setError("");
    setNotice("New campaign started. No recipients selected.");
    void loadAudience();
  };

  const groupLabel = (group: EmailCampaignGroup) =>
    GROUPS.find((item) => item.value === group)?.label ?? group;

  return (
    <div className="min-w-0 space-y-4 font-inter text-sm text-[#134687]">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-poppins text-xl font-bold">Email Composer</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#134687]/65">
            Send to accepted EAs, Staff, and Members in the current cycle,
            regardless of payment. Nothing is sent until you confirm.
          </p>
        </div>
        <button
          type="button"
          className={`${secondary} shrink-0`}
          onClick={newCampaign}
          disabled={busy || Boolean(review)}
        >
          New campaign
        </button>
      </header>

      {operation && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-[#005FD9]/15 bg-[#F3F8FF] px-3 py-2"
        >
          <LoadingSpinner size="sm" label={operation} />
          {operation}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800"
        >
          {notice}
        </p>
      )}

      {attempt && (
        <section
          aria-label="Captured campaign"
          className="space-y-2 rounded-2xl border border-[#D6A326]/30 bg-[#FFF8E7] p-4 text-[#6F4B00]"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3
              ref={capturedHeading}
              tabIndex={-1}
              className={`font-semibold ${focus}`}
            >
              {!attempt.campaign
                ? "Save status uncertain · draft frozen"
                : attempt.uncertain && attempt.campaign.status === "DRAFT"
                  ? "Send status uncertain · do not resend"
                  : statusLabel(attempt.campaign.status)}
            </h3>
            <button
              type="button"
              className={secondary}
              disabled={busy || Boolean(review)}
              onClick={() => {
                if (attempt.campaign) void refreshCampaign(attempt.campaign.id);
                else void recoverDraft();
              }}
            >
              {attempt.campaign
                ? "Refresh status"
                : "Recover saved draft (does not send)"}
            </button>
          </div>
          <p className="leading-relaxed">
            {attempt.uncertain
              ? "Do not resend. Check provider logs and refresh status. Keep this composer open to retain the captured request."
              : attempt.campaign?.status === "FAILED"
                ? "Check provider logs before starting another campaign; some recipients may have been provider accepted. No retry is available here."
                : attempt.campaign?.status === "ACCEPTED"
                  ? "Provider accepted this campaign. This composer will not resend. Provider acceptance does not confirm inbox receipt."
                  : attempt.sendAttempted
                    ? "A send was already attempted. This composer will not resend. Check provider logs before starting another campaign."
                    : "The saved campaign is frozen. Review and confirm to send, or explicitly start a new campaign to make changes."}
          </p>
          <p className="break-all font-mono text-[11px] opacity-75">
            Request {attempt.request.clientRequestId}
            {attempt.campaign &&
              ` · Campaign ${attempt.campaign.id} · ${attempt.campaign.counts.accepted}/${attempt.campaign.counts.total} provider accepted`}
          </p>
        </section>
      )}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section aria-labelledby="campaign-recipients-heading" className={card}>
          <div className={cardHeader}>
            <h3
              id="campaign-recipients-heading"
              className="font-poppins font-semibold"
            >
              Recipients
              {audience?.cycle && (
                <span className="ml-2 font-inter text-xs font-normal text-[#134687]/55">
                  AY {audience.cycle.schoolYear}
                </span>
              )}
            </h3>
            <button
              type="button"
              className={secondary}
              onClick={() => void loadAudience()}
              disabled={frozen}
            >
              Refresh
            </button>
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            {audienceLoading && (
              <p role="status" className="py-2 text-center text-[#134687]/60">
                Loading eligible recipients…
              </p>
            )}
            {audienceError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700"
              >
                <p>{audienceError}</p>
                <button
                  type="button"
                  className={`${secondary} mt-2`}
                  disabled={frozen}
                  onClick={() => void loadAudience()}
                >
                  Retry recipients
                </button>
              </div>
            )}
            {!audienceLoading && !audienceError && !audience?.cycle && (
              <p className="py-2 text-center text-[#134687]/60">
                No active recruitment cycle. Activate a cycle before composing a
                campaign.
              </p>
            )}
            <fieldset
              disabled={frozen || !audience?.cycle || Boolean(audienceError)}
              className="min-w-0 space-y-3"
            >
              <legend className="sr-only">
                Choose groups and individual recipients
              </legend>
              <div className="flex flex-wrap gap-2">
                {GROUPS.map((group) => (
                  <label
                    key={group.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${groups[group.value] ? "border-[#134687]/30 bg-[#E8F2FF]" : "border-[#005FD9]/15 bg-white text-[#134687]/60"}`}
                  >
                    <input
                      type="checkbox"
                      className={checkbox}
                      checked={groups[group.value]}
                      onChange={(event) =>
                        changeGroup(group.value, event.target.checked)
                      }
                    />
                    {group.label}
                    <span className="font-normal opacity-70">
                      {audience?.counts[group.value] ?? 0}
                    </span>
                  </label>
                ))}
              </div>
              <p className={hint}>
                Groups may overlap; each person is listed once. Turning a group
                off removes its selections unless they belong to another enabled
                group.
              </p>
              <input
                type="search"
                aria-label="Search recipients"
                className={input}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, group, or position"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p role="status" className="text-xs text-[#134687]/70">
                  <span className="font-semibold text-[#134687]">
                    {selectedRecipients.length}/{EMAIL_CAMPAIGN_RECIPIENT_LIMIT}
                  </span>{" "}
                  selected · {filtered.length} match
                  {filtered.length === 1 ? "" : "es"}
                  {selectedRecipients.length > selectedInSearch &&
                    ` · ${selectedRecipients.length - selectedInSearch} outside search`}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className={`${secondary} px-2.5 py-1 text-xs`}
                    disabled={!filtered.length}
                    onClick={() =>
                      setSelected(
                        (previous) =>
                          new Set([
                            ...previous,
                            ...filtered.map((person) => person.userId),
                          ]),
                      )
                    }
                  >
                    Select shown ({filtered.length})
                  </button>
                  <button
                    type="button"
                    className={`${secondary} px-2.5 py-1 text-xs`}
                    disabled={!selectedInSearch}
                    onClick={() =>
                      setSelected(
                        (previous) =>
                          new Set(
                            [...previous].filter(
                              (id) =>
                                !filtered.some(
                                  (person) => person.userId === id,
                                ),
                            ),
                          ),
                      )
                    }
                  >
                    Deselect shown ({selectedInSearch})
                  </button>
                  <button
                    type="button"
                    className={`${secondary} px-2.5 py-1 text-xs`}
                    disabled={!selected.size}
                    onClick={() => setSelected(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {tooMany && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700"
                >
                  Over the {EMAIL_CAMPAIGN_RECIPIENT_LIMIT}-recipient limit.
                  Deselect recipients before reviewing.
                </p>
              )}
              <div className="max-h-[26rem] divide-y divide-[#005FD9]/10 overflow-y-auto rounded-xl border border-[#005FD9]/10">
                {filtered.map((person) => (
                  <label
                    key={person.userId}
                    className={`flex min-w-0 cursor-pointer items-start gap-3 px-3 py-2 transition-colors ${selected.has(person.userId) ? "bg-[#F3F8FF]" : "bg-white hover:bg-[#F9FBFF]"}`}
                  >
                    <input
                      type="checkbox"
                      className={`${checkbox} mt-0.5`}
                      checked={selected.has(person.userId)}
                      onChange={(event) =>
                        setSelected((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(person.userId);
                          else next.delete(person.userId);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 break-words">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="font-semibold">{person.name}</span>
                        <span className="text-[11px] text-[#134687]/55">
                          {person.groups.map(groupLabel).join(", ")}
                        </span>
                      </span>
                      <span className="block text-xs text-[#134687]/70">
                        {person.email}
                      </span>
                      {person.positions.length > 0 && (
                        <span className="block text-[11px] text-[#134687]/50">
                          {person.positions.join(", ")}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
                {!filtered.length && (
                  <p className="p-6 text-center text-[#134687]/55">
                    {audienceLoading
                      ? "Loading…"
                      : !eligible.length
                        ? "No eligible recipients in the enabled groups."
                        : "No recipients match your search."}
                  </p>
                )}
              </div>
            </fieldset>
          </div>
        </section>

        <section aria-labelledby="campaign-content-heading" className={card}>
          <div className={cardHeader}>
            <h3
              id="campaign-content-heading"
              className="font-poppins font-semibold"
            >
              Compose email
            </h3>
          </div>
          <form
            className="p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void prepareReview();
            }}
          >
            <fieldset disabled={frozen} className="min-w-0 space-y-4">
              <legend className="sr-only">Email content</legend>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className={fieldLabel}>Template</span>
                  <select
                    className={input}
                    value={content.templateType}
                    onChange={(event) =>
                      setContent((previous) => {
                        const next: EmailCampaignContent = {
                          ...previous,
                          templateType: event.target
                            .value as EmailCampaignContent["templateType"],
                        };
                        if (next.templateType === "reminder") {
                          delete next.eventDate;
                          delete next.eventTime;
                          delete next.eventVenue;
                        }
                        return next;
                      })
                    }
                  >
                    <option value="event">Event announcement</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className={fieldLabel}>Header logo</span>
                  <select
                    className={input}
                    value={content.logo ?? "cssapply"}
                    onChange={(event) =>
                      setContent((previous) => ({
                        ...previous,
                        logo: event.target.value as "css" | "cssapply",
                      }))
                    }
                  >
                    <option value="cssapply">CSSApply</option>
                    <option value="css">CSS</option>
                  </select>
                </label>
              </div>
              {(
                [
                  ["subject", "Subject"],
                  ["title", "Email title"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="block">
                  <span className={fieldLabel}>{label}</span>
                  <input
                    type="text"
                    required
                    className={input}
                    value={content[field]}
                    onChange={(event) =>
                      setContent((previous) => ({
                        ...previous,
                        [field]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <label className="block">
                <span className={fieldLabel}>Message</span>
                <textarea
                  required
                  rows={7}
                  className={`${input} resize-y leading-relaxed`}
                  value={content.body}
                  onChange={(event) =>
                    setContent((previous) => ({
                      ...previous,
                      body: event.target.value,
                    }))
                  }
                />
                <span className={`${hint} mt-1 block`}>
                  Plain text only. A blank line starts a new paragraph; branding
                  and formatting are added by the server.
                </span>
              </label>
              {content.templateType === "event" && (
                <div className="rounded-xl bg-[#F3F8FF] p-3">
                  <p className="mb-2 text-xs font-semibold">Event details</p>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_1fr_2fr]">
                    {(
                      [
                        ["eventDate", "Date", "date"],
                        ["eventTime", "Time", "time"],
                        ["eventVenue", "Venue", "text"],
                      ] as const
                    ).map(([field, label, type]) => (
                      <label key={field} className="block min-w-0">
                        <span className={fieldLabel}>
                          {label}
                          {optional}
                        </span>
                        <input
                          type={type}
                          className={input}
                          value={content[field] ?? ""}
                          onChange={(event) =>
                            setContent((previous) => ({
                              ...previous,
                              [field]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid min-w-0 gap-3 sm:grid-cols-[2fr_3fr]">
                <label className="block min-w-0">
                  <span className={fieldLabel}>
                    Button label
                    {optional}
                  </span>
                  <input
                    type="text"
                    className={input}
                    value={content.ctaLabel ?? ""}
                    onChange={(event) =>
                      setContent((previous) => ({
                        ...previous,
                        ctaLabel: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block min-w-0">
                  <span className={fieldLabel}>
                    Button HTTPS URL
                    {optional}
                  </span>
                  <input
                    type="url"
                    className={input}
                    placeholder="https://"
                    value={content.ctaUrl ?? ""}
                    onChange={(event) =>
                      setContent((previous) => ({
                        ...previous,
                        ctaUrl: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </fieldset>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#005FD9]/10 pt-4">
              <p className={hint}>
                Fill both button fields or leave both blank.
              </p>
              <button
                ref={reviewButton}
                type="submit"
                className={primary}
                disabled={busy || Boolean(review) || !canReview}
              >
                Preview & review (
                {attempt?.request.recipientIds.length ??
                  selectedRecipients.length}
                )
              </button>
            </div>
          </form>
        </section>
      </div>

      {review && (
        <section aria-labelledby="campaign-review-heading" className={card}>
          <div className={`${cardHeader} bg-[#F3F8FF]`}>
            <h3
              ref={reviewHeading}
              tabIndex={-1}
              id="campaign-review-heading"
              className={`font-poppins font-semibold ${focus}`}
            >
              Final confirmation · {review.captured.recipientIds.length}{" "}
              recipients
            </h3>
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <p className="leading-relaxed text-[#134687]/75">
              Review this fresh server-generated preview. Confirming below saves
              the campaign and requests real emails immediately. It cannot be
              undone.
            </p>
            <p className="break-words rounded-lg border border-[#005FD9]/10 px-3 py-2">
              <span className="text-xs font-semibold text-[#134687]/60">
                Subject
              </span>{" "}
              {review.subject}
            </p>
            <iframe
              title="Email campaign final preview"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={review.html}
              className="h-[32rem] w-full min-w-0 rounded-xl border border-[#005FD9]/10 bg-[#F3F8FF]"
            />
            <div className="flex flex-col gap-3 border-t border-[#005FD9]/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className={`${checkbox} mt-0.5`}
                  checked={acknowledged}
                  disabled={busy}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  I reviewed the preview and the{" "}
                  {review.captured.recipientIds.length} selected recipients.
                  Send this campaign now.
                </span>
              </label>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className={secondary}
                  disabled={busy}
                  onClick={() => {
                    setReview(null);
                    setAcknowledged(false);
                  }}
                >
                  Back to draft
                </button>
                <button
                  type="button"
                  className={primary}
                  disabled={busy || !acknowledged}
                  onClick={() => void confirmSend()}
                >
                  Confirm & send to {review.captured.recipientIds.length}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="campaign-history-heading" className={card}>
        <div className={cardHeader}>
          <div className="min-w-0">
            <h3
              id="campaign-history-heading"
              className="font-poppins font-semibold"
            >
              Recent campaigns
            </h3>
            <p className={`${hint} mt-0.5`}>
              Last 50. &ldquo;Provider accepted&rdquo; is not inbox delivery.
              For Sending or Unknown, do not resend; check provider logs.
            </p>
          </div>
          <button
            type="button"
            className={secondary}
            disabled={busy || Boolean(review)}
            onClick={() => void loadHistory()}
          >
            Refresh
          </button>
        </div>
        {historyLoading && (
          <p role="status" className="py-6 text-center text-[#134687]/60">
            Loading campaign history…
          </p>
        )}
        {historyError && (
          <div
            role="alert"
            className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700"
          >
            <p>{historyError}</p>
            <button
              type="button"
              className={`${secondary} mt-2`}
              disabled={busy || Boolean(review)}
              onClick={() => void loadHistory()}
            >
              Retry history
            </button>
          </div>
        )}
        {!historyLoading && !historyError && !history.length && (
          <p className="py-8 text-center text-[#134687]/55">
            No campaigns yet.
          </p>
        )}
        {history.length > 0 && (
          <ul className="divide-y divide-[#005FD9]/10">
            {history.map((campaign) => (
              <li
                key={campaign.id}
                className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold">
                    {campaign.subject}
                  </p>
                  <p className="mt-0.5 text-xs text-[#134687]/60">
                    {new Date(campaign.createdAt).toLocaleString("en-PH")} ·{" "}
                    {campaign.templateType === "event" ? "Event" : "Reminder"} ·{" "}
                    {campaign.counts.accepted}/{campaign.counts.total} accepted
                    {campaign.counts.failed > 0 &&
                      ` · ${campaign.counts.failed} failed`}
                    {campaign.counts.unknown > 0 &&
                      ` · ${campaign.counts.unknown} unknown`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(campaign.status)}`}
                  >
                    {statusLabel(campaign.status)}
                  </span>
                  <button
                    type="button"
                    className={`${secondary} px-2.5 py-1 text-xs`}
                    disabled={busy || Boolean(review)}
                    onClick={() => void refreshCampaign(campaign.id, true)}
                    aria-label={`View details and refresh status: ${campaign.subject}`}
                  >
                    Details
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {detail && (
          <section
            aria-label="Campaign details"
            className="space-y-3 border-t border-[#005FD9]/10 bg-[#F9FBFF] p-4 sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="break-words font-semibold">{detail.subject}</h4>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#134687]/60">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-semibold ${statusTone(detail.status)}`}
                  >
                    {statusLabel(detail.status)}
                  </span>
                  <span className="break-all font-mono">{detail.id}</span>
                </p>
              </div>
              <button
                type="button"
                className={`${secondary} px-2.5 py-1 text-xs`}
                disabled={busy}
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>
            {detail.errorMessage && (
              <p
                role="alert"
                className="break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700"
              >
                {detail.errorMessage}
              </p>
            )}
            {(detail.status === "SENDING" || detail.status === "UNKNOWN") && (
              <p className="text-[#8A5A00]">
                Do not resend. Check provider logs and refresh status.
              </p>
            )}
            <div className="rounded-xl border border-[#005FD9]/10 bg-white p-3">
              <p className="font-semibold">{detail.content.title}</p>
              <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-[#134687]/80">
                {detail.content.body}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[#134687]/70">
                Saved recipients ({detail.recipients.length})
              </p>
              <ul className="max-h-64 divide-y divide-[#005FD9]/10 overflow-y-auto rounded-xl border border-[#005FD9]/10 bg-white">
                {detail.recipients.map((person) => (
                  <li
                    key={person.userId}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="min-w-0 break-words">
                      <span className="font-medium">{person.name}</span>{" "}
                      <span className="text-xs text-[#134687]/60">
                        {person.email}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(person.status)}`}
                    >
                      {statusLabel(person.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
