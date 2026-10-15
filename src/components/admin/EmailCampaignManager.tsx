"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";
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
const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] focus-visible:ring-offset-2";
const button = `rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const secondary = `${button} bg-[#E8F2FF] text-[#134687] hover:bg-[#D9E9F8]`;
const primary = `${button} bg-[#134687] text-white hover:bg-[#0F376B]`;
const input = `w-full min-w-0 rounded-lg border-0 bg-[#F3F8FF] px-3 py-2 text-sm text-[#134687] disabled:opacity-60 ${focus}`;
const checkbox = `h-4 w-4 shrink-0 accent-[#134687] ${focus}`;

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

  return (
    <div className="min-w-0 space-y-3 font-inter text-sm text-[#134687]">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-poppins text-base font-semibold">
            Email campaigns
          </h2>
          <p className="mt-1 text-[#134687]/75">
            Super Admin only · Accepted current-cycle EAs, Staff, and Members,
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
          className="flex items-center gap-2 rounded-lg bg-[#E8F2FF] p-3"
        >
          <LoadingSpinner size="sm" label={operation} />
          {operation}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="break-words rounded-lg bg-red-50 p-3 text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-[#F3F8FF] p-3">
          {notice}
        </p>
      )}

      {attempt && (
        <section
          aria-label="Captured campaign"
          className="space-y-2 rounded-xl bg-[#E8F2FF] p-3"
        >
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
          <p className="break-words text-xs">
            Request ID: {attempt.request.clientRequestId}
          </p>
          {attempt.campaign && (
            <p className="break-words text-xs">
              Campaign ID: {attempt.campaign.id} ·{" "}
              {attempt.campaign.counts.accepted}/{attempt.campaign.counts.total}{" "}
              provider accepted
            </p>
          )}
          <p>
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
        </section>
      )}

      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <section
          aria-labelledby="campaign-recipients-heading"
          className="min-w-0 rounded-xl bg-white p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="campaign-recipients-heading"
              className="font-poppins font-semibold"
            >
              Recipients {audience?.cycle && `· ${audience.cycle.schoolYear}`}
            </h3>
            <button
              type="button"
              className={secondary}
              onClick={() => void loadAudience()}
              disabled={frozen}
            >
              Refresh recipients
            </button>
          </div>
          {audienceLoading && (
            <p role="status" className="py-3 text-center">
              Loading eligible recipients…
            </p>
          )}
          {audienceError && (
            <div
              role="alert"
              className="my-2 rounded-lg bg-red-50 p-3 text-red-800"
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
            <p className="py-3 text-center">
              No active recruitment cycle. Activate a cycle before composing a
              campaign.
            </p>
          )}
          <fieldset
            disabled={frozen || !audience?.cycle || Boolean(audienceError)}
            className="mt-3 min-w-0 space-y-3"
          >
            <legend className="sr-only">
              Choose groups and individual recipients
            </legend>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map((group) => (
                <label
                  key={group.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#E8F2FF] px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className={checkbox}
                    checked={groups[group.value]}
                    onChange={(event) =>
                      changeGroup(group.value, event.target.checked)
                    }
                  />
                  {group.label} ({audience?.counts[group.value] ?? 0})
                </label>
              ))}
            </div>
            <p className="text-xs text-[#134687]/75">
              Groups may overlap; each person is selected once. Disabling a
              group removes its selections unless they also belong to another
              enabled group. Payment is not a filter.
            </p>
            <label className="block space-y-1">
              <span className="font-medium">Search recipients</span>
              <input
                type="search"
                className={input}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, group, or position"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondary}
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
                Select filtered ({filtered.length})
              </button>
              <button
                type="button"
                className={secondary}
                disabled={!selectedInSearch}
                onClick={() =>
                  setSelected(
                    (previous) =>
                      new Set(
                        [...previous].filter(
                          (id) =>
                            !filtered.some((person) => person.userId === id),
                        ),
                      ),
                  )
                }
              >
                Deselect filtered ({selectedInSearch})
              </button>
              <button
                type="button"
                className={secondary}
                disabled={!selected.size}
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </button>
            </div>
            <p role="status">
              {selectedRecipients.length}/{EMAIL_CAMPAIGN_RECIPIENT_LIMIT}{" "}
              selected · {filtered.length} match
              {filtered.length === 1 ? "" : "es"}
              {selectedRecipients.length > selectedInSearch &&
                ` · ${selectedRecipients.length - selectedInSearch} selected outside search`}
            </p>
            {tooMany && (
              <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-800">
                Over the {EMAIL_CAMPAIGN_RECIPIENT_LIMIT}-recipient limit.
                Deselect recipients before reviewing.
              </p>
            )}
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg bg-[#F3F8FF] p-2">
              {filtered.map((person) => (
                <label
                  key={person.userId}
                  className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-lg p-2 ${selected.has(person.userId) ? "bg-[#E8F2FF]" : "bg-white"}`}
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
                  <span className="min-w-0 break-words">
                    <span className="block font-semibold">{person.name}</span>
                    <span className="block text-xs">{person.email}</span>
                    <span className="block text-xs text-[#134687]/75">
                      {person.groups
                        .map(
                          (group) =>
                            GROUPS.find((item) => item.value === group)
                              ?.label ?? group,
                        )
                        .join(", ")}
                      {person.positions.length > 0 &&
                        ` · ${person.positions.join(", ")}`}
                    </span>
                  </span>
                </label>
              ))}
              {!filtered.length && (
                <p className="p-3 text-center">
                  {audienceLoading
                    ? "Loading…"
                    : !eligible.length
                      ? "No eligible recipients in the enabled groups."
                      : "No recipients match your search."}
                </p>
              )}
            </div>
          </fieldset>
        </section>

        <section
          aria-labelledby="campaign-content-heading"
          className="min-w-0 rounded-xl bg-white p-3 sm:p-4"
        >
          <h3
            id="campaign-content-heading"
            className="font-poppins font-semibold"
          >
            Compose email
          </h3>
          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              void prepareReview();
            }}
          >
            <fieldset disabled={frozen} className="min-w-0 space-y-3">
              <legend className="sr-only">Email content</legend>
              <label className="block space-y-1">
                <span className="font-medium">Template</span>
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
              <label className="block space-y-1">
                <span className="font-medium">Header logo</span>
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
                <span className="block text-xs text-[#134687]/75">
                  Centered above the email title. Your selection is used in the
                  preview and sent email.
                </span>
              </label>
              {(
                [
                  ["subject", "Subject"],
                  ["title", "Email title"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="block space-y-1">
                  <span className="font-medium">{label} (required)</span>
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
              <label className="block space-y-1">
                <span className="font-medium">Plain-text body (required)</span>
                <textarea
                  required
                  rows={7}
                  className={`${input} resize-y`}
                  value={content.body}
                  onChange={(event) =>
                    setContent((previous) => ({
                      ...previous,
                      body: event.target.value,
                    }))
                  }
                />
                <span className="block text-xs text-[#134687]/75">
                  Text only. CSSApply branding and email formatting are applied
                  by the server.
                </span>
              </label>
              {content.templateType === "event" && (
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["eventDate", "Event date", "date"],
                      ["eventTime", "Event time", "time"],
                      ["eventVenue", "Event venue", "text"],
                    ] as const
                  ).map(([field, label, type]) => (
                    <label
                      key={field}
                      className={`block min-w-0 space-y-1 ${field === "eventVenue" ? "sm:col-span-2" : ""}`}
                    >
                      <span className="font-medium">{label} (optional)</span>
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
              )}
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 space-y-1">
                  <span className="font-medium">Button label (optional)</span>
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
                <label className="block min-w-0 space-y-1">
                  <span className="font-medium">Button HTTPS URL</span>
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
              <p className="text-xs text-[#134687]/75">
                Provide both button fields or leave both blank. Event details
                appear only in event announcements.
              </p>
            </fieldset>
            <button
              ref={reviewButton}
              type="submit"
              className={`${primary} mt-3`}
              disabled={busy || Boolean(review) || !canReview}
            >
              Preview & review (
              {attempt?.request.recipientIds.length ??
                selectedRecipients.length}
              )
            </button>
          </form>
        </section>
      </div>

      {review && (
        <section
          aria-labelledby="campaign-review-heading"
          className="space-y-3 rounded-xl bg-white p-3 sm:p-4"
        >
          <h3
            ref={reviewHeading}
            tabIndex={-1}
            id="campaign-review-heading"
            className={`text-center font-poppins font-semibold ${focus}`}
          >
            Final confirmation · {review.captured.recipientIds.length}{" "}
            recipients
          </h3>
          <p className="text-center">
            Review this fresh server-generated preview. Confirming below saves
            the campaign and requests real emails immediately. It cannot be
            undone.
          </p>
          <p className="break-words rounded-lg bg-[#E8F2FF] p-3">
            <strong>Subject:</strong> {review.subject}
          </p>
          <iframe
            title="Email campaign final preview"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={review.html}
            className="h-[28rem] w-full min-w-0 rounded-lg bg-[#F3F8FF]"
          />
          <label className="flex items-start justify-center gap-2">
            <input
              type="checkbox"
              className={`${checkbox} mt-0.5`}
              checked={acknowledged}
              disabled={busy}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              I reviewed the preview and the{" "}
              {review.captured.recipientIds.length} selected recipients. Send
              this campaign now.
            </span>
          </label>
          <div className="flex flex-wrap justify-center gap-2">
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
        </section>
      )}

      <section
        aria-labelledby="campaign-history-heading"
        className="min-w-0 rounded-xl bg-white p-3 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="campaign-history-heading"
            className="font-poppins font-semibold"
          >
            Recent campaigns (up to 50)
          </h3>
          <button
            type="button"
            className={secondary}
            disabled={busy || Boolean(review)}
            onClick={() => void loadHistory()}
          >
            Refresh history
          </button>
        </div>
        <p className="mt-2 text-xs text-[#134687]/75">
          Provider accepted means the email provider accepted the request, not
          that it reached an inbox. For Sending or Unknown, do not resend;
          refresh status and check provider logs. No automatic retries.
        </p>
        {historyLoading && (
          <p role="status" className="py-3 text-center">
            Loading campaign history…
          </p>
        )}
        {historyError && (
          <div
            role="alert"
            className="mt-2 rounded-lg bg-red-50 p-3 text-red-800"
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
          <p className="py-4 text-center">No campaigns yet.</p>
        )}
        <ul className="mt-3 space-y-2">
          {history.map((campaign) => (
            <li
              key={campaign.id}
              className="flex min-w-0 flex-col gap-2 rounded-lg bg-[#F3F8FF] p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words font-semibold">{campaign.subject}</p>
                <p className="mt-1 text-xs">
                  {new Date(campaign.createdAt).toLocaleString("en-PH")} ·{" "}
                  {campaign.templateType === "event" ? "Event" : "Reminder"} ·{" "}
                  {campaign.counts.total} recipients
                </p>
                <p className="mt-1 text-xs">
                  Provider accepted: {campaign.counts.accepted} · Failed:{" "}
                  {campaign.counts.failed} · Unknown: {campaign.counts.unknown}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                <span className="rounded-full bg-[#E8F2FF] px-3 py-1 text-xs font-semibold">
                  {statusLabel(campaign.status)}
                </span>
                <button
                  type="button"
                  className={secondary}
                  disabled={busy || Boolean(review)}
                  onClick={() => void refreshCampaign(campaign.id, true)}
                  aria-label={`View details and refresh status: ${campaign.subject}`}
                >
                  Details / refresh status
                </button>
              </div>
            </li>
          ))}
        </ul>
        {detail && (
          <section
            aria-label="Campaign details"
            className="mt-3 space-y-2 rounded-lg bg-[#E8F2FF] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 break-words font-semibold">
                {detail.subject} · {statusLabel(detail.status)}
              </h4>
              <button
                type="button"
                className={secondary}
                disabled={busy}
                onClick={() => setDetail(null)}
              >
                Close details
              </button>
            </div>
            <p className="break-words text-xs">Campaign ID: {detail.id}</p>
            {detail.errorMessage && (
              <p role="alert" className="break-words">
                {detail.errorMessage}
              </p>
            )}
            {(detail.status === "SENDING" || detail.status === "UNKNOWN") && (
              <p>Do not resend. Check provider logs and refresh status.</p>
            )}
            <p className="font-semibold">{detail.content.title}</p>
            <p className="whitespace-pre-wrap break-words">
              {detail.content.body}
            </p>
            <p className="font-semibold">
              Saved recipients ({detail.recipients.length})
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {detail.recipients.map((person) => (
                <li
                  key={person.userId}
                  className="break-words rounded-lg bg-white p-2"
                >
                  <span className="font-medium">{person.name}</span> ·{" "}
                  {person.email}
                  <span className="block text-xs">
                    {statusLabel(person.status)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}
