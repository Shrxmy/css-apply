"use client";

import { useCallback, useEffect, useState } from "react";

type CommunityStatus = {
  paymentRequirementAcknowledgedAt: string | null;
  hasJoined: boolean | null;
  respondedAt: string | null;
};

type CommunityJoinCardProps = {
  communityUrl: string;
  communityLabel: string;
};

export default function CommunityJoinCard({
  communityUrl,
  communityLabel,
}: CommunityJoinCardProps) {
  const [status, setStatus] = useState<CommunityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acknowledgementChecked, setAcknowledgementChecked] = useState(false);
  const [joinAnswer, setJoinAnswer] = useState<"yes" | "no" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/user/community-join", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load community status.");
      }
      setStatus(data);
      setJoinAnswer(
        data.hasJoined === true ? "yes" : data.hasJoined === false ? "no" : "",
      );
      setError("");
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
    void loadStatus();
  }, [loadStatus]);

  const submit = async (
    action: "acknowledge-payment" | "answer-join-question",
    hasJoined?: boolean,
  ) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/user/community-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(hasJoined === undefined ? {} : { hasJoined }),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save your confirmation.");
      }
      setStatus(data);
      setJoinAnswer(
        data.hasJoined === true ? "yes" : data.hasJoined === false ? "no" : "",
      );
      setAcknowledgementChecked(false);
      setNotice(
        action === "answer-join-question"
          ? "Your answer has been saved. You can update it after joining."
          : "Acknowledgement saved. The community invite is now available below.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save your confirmation.",
      );
    } finally {
      setSaving(false);
    }
  };

  const hasAcknowledged = Boolean(status?.paymentRequirementAcknowledgedAt);
  const safeCommunityUrl = (() => {
    try {
      const parsed = new URL(communityUrl);
      return parsed.protocol === "https:" ? parsed.toString() : "";
    } catch {
      return "";
    }
  })();

  if (!safeCommunityUrl) return null;

  return (
    <section className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-[0_2px_8px_0_rgba(0,0,0,0.15)] sm:rounded-[20px] sm:p-6 sm:shadow-[0_4px_4px_0_rgba(0,0,0,0.18)] lg:rounded-3xl lg:p-10">
      <h3 className="mb-4 text-center text-base font-semibold sm:mb-5 sm:text-lg lg:text-xl">
        Join Our Community
      </h3>

      <div className="rounded-xl border border-[#005FD9]/15 bg-[#F3F8FF] p-4 sm:p-6 lg:p-8">
        {status?.hasJoined === true ? (
          <div className="text-center">
            <p className="font-semibold text-[#134687]">
              Thanks for confirming that you have joined the CSS community.
            </p>
            <p className="mt-2 text-sm text-[#134687]/70">
              Your response is saved. Payment and approval of your
              acknowledgement receipt are still required before your Member ID
              can be released.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-center text-sm leading-relaxed text-[#134687] sm:mb-5 sm:text-base">
              Join the official CSS community group to stay connected and
              receive updates. After joining, return here and answer the
              required question so we can track your confirmation.
            </p>

            <div className="mb-5 rounded-lg border border-[#D6A326]/30 bg-[#FFF8E7] p-4 text-sm leading-relaxed text-[#6F4B00]">
              <strong>Member ID reminder:</strong> Payment is required before
              your Member ID can be released. You must submit your
              acknowledgement receipt and wait for an authorized reviewer to
              approve it.
            </div>

            {loading ? (
              <p className="text-center text-sm text-[#134687]/60">
                Loading your community confirmation…
              </p>
            ) : !hasAcknowledged ? (
              <div className="mx-auto max-w-2xl">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#005FD9]/15 bg-white p-4 text-sm leading-relaxed text-[#134687]">
                  <input
                    type="checkbox"
                    required
                    checked={acknowledgementChecked}
                    onChange={(event) =>
                      setAcknowledgementChecked(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[#044FAF]"
                  />
                  <span>
                    I understand that I must complete payment and have my
                    acknowledgement receipt approved before my Member ID is
                    released.
                  </span>
                </label>
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    disabled={!acknowledgementChecked || saving}
                    onClick={() => void submit("acknowledge-payment")}
                    className="rounded-lg bg-[#134687] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0F376B] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Acknowledge and continue"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <a
                    href={safeCommunityUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg bg-linear-to-r from-[#134687] to-[#0f3a6b] px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl sm:px-7 sm:text-base"
                  >
                    {communityLabel}
                  </a>
                </div>

                <fieldset className="mx-auto mt-6 max-w-2xl rounded-lg border border-[#005FD9]/15 bg-white p-4">
                  <legend className="px-1 text-sm font-semibold text-[#134687]">
                    Have you joined the community group?{" "}
                    <span aria-hidden="true">*</span>
                  </legend>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#134687]">
                      <input
                        type="radio"
                        name="community-joined"
                        value="yes"
                        required
                        checked={joinAnswer === "yes"}
                        onChange={() => setJoinAnswer("yes")}
                        className="h-4 w-4 accent-[#044FAF]"
                      />
                      Yes, I have joined
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#134687]">
                      <input
                        type="radio"
                        name="community-joined"
                        value="no"
                        required
                        checked={joinAnswer === "no"}
                        onChange={() => setJoinAnswer("no")}
                        className="h-4 w-4 accent-[#044FAF]"
                      />
                      Not yet
                    </label>
                  </div>
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      disabled={!joinAnswer || saving}
                      onClick={() =>
                        void submit(
                          "answer-join-question",
                          joinAnswer === "yes",
                        )
                      }
                      className="rounded-lg border border-[#044FAF]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#044FAF] transition-colors hover:bg-[#E8F2FF] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? "Saving…" : "Save my answer"}
                    </button>
                  </div>
                </fieldset>
              </>
            )}
          </>
        )}

        {notice && (
          <p role="status" className="mt-4 text-center text-sm text-green-700">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-red-600">
            {error}
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
