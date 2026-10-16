"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  Keyboard,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import {
  card,
  cardHeader,
  fieldLabel,
  hint,
  input,
  pill,
  primary,
  secondary,
  tones,
} from "@/components/admin/ui";
import AttendanceQrScanner from "@/components/attendance/AttendanceQrScanner";
import type { AttendanceEvent } from "@/types/attendance";

type TestResult = {
  recognized: boolean;
  credentialType: "CSS_ID_QR" | "UST_QR" | "UNKNOWN";
  event: {
    title: string;
    status: string;
    schoolYear: string;
  } | null;
  attendee: {
    fullName: string;
    studentNumber: string;
    memberId: string | null;
    section: string | null;
    source: "CSSAPPLY" | "IMPORTED";
    affiliationGroups: string[];
    schoolYear: string | null;
  } | null;
  alreadyCheckedIn?: boolean;
  message: string;
};

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error || fallback;
}

export default function AttendanceQrTestPanel({
  events,
}: {
  events: AttendanceEvent[];
}) {
  const [eventId, setEventId] = useState(
    events.find((event) => event.status === "OPEN")?.id ||
      events.find((event) => event.status === "DRAFT")?.id ||
      events[0]?.id ||
      "",
  );
  const [decodedValue, setDecodedValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [testedValue, setTestedValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const testCredential = useCallback(
    async (credential: string) => {
      const submittedCredential = credential.trim();
      if (submitting || !submittedCredential) return;
      setDecodedValue("");
      setTestedValue(submittedCredential);
      setSubmitting(true);
      setResult(null);
      setError(null);
      try {
        const response = await fetch("/api/admin/attendance/test-credential", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(eventId ? { eventId } : {}),
            credential: submittedCredential,
          }),
        });
        if (!response.ok) {
          throw new Error(
            await readError(response, "The QR credential could not be tested"),
          );
        }
        setResult((await response.json()) as TestResult);
      } catch (testError) {
        setError(
          testError instanceof Error
            ? testError.message
            : "The QR credential could not be tested",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [eventId, submitting],
  );

  function submitDecodedValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void testCredential(decodedValue);
  }

  function clearResult() {
    setResult(null);
    setError(null);
    setDecodedValue("");
  }

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h2 className="font-poppins text-lg font-semibold text-[#134687]">
          QR check-in test
        </h2>
        <p className={`${hint} max-w-2xl`}>
          Test the check-in scanner with or without an event roster. Tests never
          create or change attendance records.
        </p>
      </div>

      <section className={`${card} p-4 sm:p-5`}>
        <label className="block">
          <span className={fieldLabel}>Event roster to test</span>
          <select
            value={eventId}
            disabled={submitting}
            onChange={(event) => {
              setEventId(event.target.value);
              clearResult();
            }}
            className={input}
          >
            <option value="">No event · check the QR and its owner only</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} · {event.status.toLowerCase()} · A.Y.{" "}
                {event.schoolYear}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(330px,0.9fr)]">
        <AttendanceQrScanner
          disabled={submitting || Boolean(result)}
          onScan={testCredential}
        />

        <div className="min-w-0 space-y-5">
          <section className={card} aria-live="assertive">
            <div className={cardHeader}>
              <h3 className="font-poppins font-semibold text-[#134687]">
                Result
              </h3>
              {result && (
                <span
                  className={`${pill} ${result.recognized ? tones.success : tones.danger}`}
                >
                  {result.recognized ? "Passed" : "Failed"}
                </span>
              )}
            </div>
            <div className="flex min-h-56 flex-col justify-center p-4 sm:p-5">
              {submitting ? (
                <div className="flex flex-col items-center gap-3 text-[#134687]/70">
                  <LoaderCircle className="h-7 w-7 animate-spin" />
                  <span className="text-sm font-semibold">
                    {eventId
                      ? "Testing QR against the event roster…"
                      : "Looking up the QR owner…"}
                  </span>
                </div>
              ) : result ? (
                <div>
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${result.recognized ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                    >
                      {result.recognized ? (
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-poppins font-semibold text-[#134687]">
                        {result.recognized
                          ? "QR check passed"
                          : "QR check failed"}
                      </h4>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`${pill} ${tones.info}`}>
                          {result.credentialType === "CSS_ID_QR"
                            ? "CSS digital ID"
                            : result.credentialType === "UST_QR"
                              ? "UST QR"
                              : "Unrecognized"}
                        </span>
                        <span className={`${pill} ${tones.neutral}`}>
                          {result.event
                            ? `${result.event.title} · ${result.event.status.toLowerCase()}`
                            : "No event roster"}
                        </span>
                        {result.alreadyCheckedIn && (
                          <span className={`${pill} ${tones.warning}`}>
                            Already present
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {result.attendee && (
                    <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl border border-[#005FD9]/10 bg-[#F9FBFF] px-4 py-3 text-sm">
                      <dt className="text-[#134687]/55">Name</dt>
                      <dd className="break-words font-semibold text-[#134687]">
                        {result.attendee.fullName}
                      </dd>
                      <dt className="text-[#134687]/55">Student no.</dt>
                      <dd className="font-mono text-[#134687]">
                        {result.attendee.studentNumber || "—"}
                      </dd>
                      <dt className="text-[#134687]/55">Member ID</dt>
                      <dd className="font-mono text-[#134687]">
                        {result.attendee.memberId || "—"}
                      </dd>
                      <dt className="text-[#134687]/55">Section</dt>
                      <dd className="text-[#134687]">
                        {result.attendee.section || "—"}
                      </dd>
                      <dt className="text-[#134687]/55">Source</dt>
                      <dd className="text-[#134687]">
                        {result.attendee.source === "CSSAPPLY"
                          ? "CSSApply"
                          : "Imported roster"}
                        {result.attendee.schoolYear
                          ? ` · A.Y. ${result.attendee.schoolYear}`
                          : ""}
                      </dd>
                      {result.attendee.affiliationGroups.length > 0 && (
                        <>
                          <dt className="text-[#134687]/55">Groups</dt>
                          <dd className="capitalize text-[#134687]">
                            {result.attendee.affiliationGroups
                              .map((group) =>
                                group.replaceAll("_", " ").toLowerCase(),
                              )
                              .join(", ")}
                          </dd>
                        </>
                      )}
                    </dl>
                  )}

                  <p className="mt-4 text-sm leading-relaxed text-[#134687]/75">
                    {result.message}
                  </p>
                  <p className="mt-2 break-all font-mono text-[11px] text-[#134687]/50">
                    Decoded: {testedValue}
                  </p>
                  <button
                    type="button"
                    onClick={clearResult}
                    className={`${secondary} mt-4 inline-flex items-center gap-2`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                    Test another QR
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <ClipboardCheck
                    className="mx-auto mb-3 h-9 w-9 text-[#044FAF]/25"
                    aria-hidden="true"
                  />
                  <h4 className="font-poppins font-semibold text-[#134687]">
                    Ready to test
                  </h4>
                  <p className={`${hint} mx-auto mt-1 max-w-sm`}>
                    Start the camera and hold a QR inside the frame. With an
                    event selected, its roster is checked too.
                  </p>
                </div>
              )}
              {error && (
                <p
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
          </section>

          <form onSubmit={submitDecodedValue} className={card}>
            <div className={cardHeader}>
              <h3 className="font-poppins font-semibold text-[#134687]">
                Test decoded text
              </h3>
            </div>
            <div className="p-4 sm:p-5">
              <label htmlFor="qr-test-value" className={fieldLabel}>
                QR text
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="qr-test-value"
                  value={decodedValue}
                  onChange={(event) => setDecodedValue(event.target.value)}
                  disabled={submitting || Boolean(result)}
                  placeholder="Member ID or UST QR text"
                  autoComplete="off"
                  className={`${input} font-mono sm:flex-1`}
                />
                <button
                  type="submit"
                  disabled={
                    submitting || Boolean(result) || !decodedValue.trim()
                  }
                  className={`${primary} inline-flex shrink-0 items-center justify-center gap-2`}
                >
                  <Keyboard className="h-4 w-4" aria-hidden="true" /> Test
                </button>
              </div>
              <p className={`${hint} mt-2`}>
                Paste the exact text a QR contains when no camera is available.
              </p>
            </div>
          </form>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-[#005FD9]/10 bg-white px-4 py-3 text-xs leading-relaxed text-[#134687]/65">
        <ShieldCheck
          className="mt-px h-4 w-4 shrink-0 text-[#044FAF]/60"
          aria-hidden="true"
        />
        A passed test confirms the scanner can read the QR and find its owner
        (and the event roster, when one is selected). Actual check-in still
        needs the event to be open within its check-in window.
      </p>
    </div>
  );
}
