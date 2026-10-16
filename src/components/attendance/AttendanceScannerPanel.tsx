"use client";

import {
  CheckCircle2,
  Clock3,
  Keyboard,
  LoaderCircle,
  RotateCcw,
  Search,
  UserX,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  card,
  cardHeader,
  fieldLabel,
  focus,
  hint,
  input,
  pill,
  primary,
  secondary,
  tones,
} from "@/components/admin/ui";
import AttendanceQrScanner from "@/components/attendance/AttendanceQrScanner";
import type {
  AttendanceEvent,
  AttendanceRosterEntry,
  AttendanceScanOutcome,
} from "@/types/attendance";

type ResultKind = "success" | "warning" | "danger";

const RESULT_CONTENT: Record<
  AttendanceScanOutcome,
  { title: string; description: string; kind: ResultKind }
> = {
  ACCEPTED: {
    title: "Checked in",
    description: "Attendance was recorded.",
    kind: "success",
  },
  DUPLICATE: {
    title: "Already checked in",
    description: "This attendee already has an attendance record.",
    kind: "warning",
  },
  UNKNOWN: {
    title: "Not recognized",
    description:
      "No member or imported student matches this QR or student number.",
    kind: "danger",
  },
  INACTIVE: {
    title: "Attendee inactive",
    description: "This roster entry is inactive and cannot be checked in.",
    kind: "danger",
  },
  INELIGIBLE: {
    title: "Not eligible for this event",
    description:
      "This person exists, but is not in any of the event's eligible groups.",
    kind: "danger",
  },
  OUTSIDE_WINDOW: {
    title: "Check-in is closed",
    description: "The event is not open, or its check-in window is not active.",
    kind: "warning",
  },
};

const RESULT_STYLES: Record<ResultKind, { icon: string; pill: string }> = {
  success: { icon: "bg-green-50 text-green-700", pill: tones.success },
  warning: { icon: "bg-[#FFF8E7] text-[#8A5A00]", pill: tones.warning },
  danger: { icon: "bg-red-50 text-red-700", pill: tones.danger },
};

type ScanResult = {
  attemptId: string;
  outcome: AttendanceScanOutcome;
  attendanceId: string | null;
  attendee: {
    fullName: string;
    studentNumber: string;
    memberId: string | null;
    section: string | null;
  } | null;
};

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error || fallback;
}

export default function AttendanceScannerPanel({
  events,
  initialEventId,
  onAttendanceChange,
}: {
  events: AttendanceEvent[];
  initialEventId: string | null;
  onAttendanceChange: () => Promise<void>;
}) {
  const [eventId, setEventId] = useState(
    initialEventId || events.find((event) => event.status === "OPEN")?.id || "",
  );
  const rosterRequestId = useRef(0);
  const [entries, setEntries] = useState<AttendanceRosterEntry[]>([]);
  const [event, setEvent] = useState<AttendanceEvent | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [manualNumber, setManualNumber] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [canManage, setCanManage] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [eventId, debouncedSearch, statusFilter]);

  useEffect(() => {
    if (initialEventId) {
      setEventId(initialEventId);
      setEvent(null);
      setEntries([]);
    }
  }, [initialEventId]);

  const loadRoster = useCallback(async () => {
    const requestId = ++rosterRequestId.current;
    if (!eventId) {
      setEvent(null);
      setEntries([]);
      setLoadingRoster(false);
      return;
    }
    setLoadingRoster(true);
    setRequestError(null);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const response = await fetch(
        `/api/admin/attendance/events/${eventId}?${params}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          await readError(response, "Roster could not be loaded"),
        );
      const body = (await response.json()) as {
        canManage: boolean;
        event: AttendanceEvent;
        entries: AttendanceRosterEntry[];
        pagination: { totalPages: number; total: number };
      };
      if (requestId === rosterRequestId.current) {
        setCanManage(body.canManage);
        setEvent(body.event);
        setEntries(body.entries);
        setPagination(body.pagination);
      }
    } catch (error) {
      if (requestId === rosterRequestId.current) {
        setRequestError(
          error instanceof Error ? error.message : "Roster could not be loaded",
        );
      }
    } finally {
      if (requestId === rosterRequestId.current) setLoadingRoster(false);
    }
  }, [eventId, debouncedSearch, statusFilter, page]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const submitScan = useCallback(
    async (
      payload:
        | { mode: "QR"; credential: string }
        | { mode: "MANUAL"; studentNumber: string },
    ) => {
      if (!eventId || submitting) return;
      setSubmitting(true);
      setRequestError(null);
      try {
        const response = await fetch(
          `/api/admin/attendance/events/${eventId}/scan`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payload,
              clientScanId: crypto.randomUUID(),
            }),
          },
        );
        if (!response.ok)
          throw new Error(
            await readError(response, "Scan could not be processed"),
          );
        const body = (await response.json()) as ScanResult;
        setResult(body);
        setManualNumber("");
        // Show the result now; the roster and counts refresh in the background.
        void Promise.all([loadRoster(), onAttendanceChange()]);
      } catch (error) {
        setRequestError(
          error instanceof Error
            ? error.message
            : "Scan could not be processed",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [eventId, loadRoster, onAttendanceChange, submitting],
  );

  useEffect(() => {
    if (!result) return;
    const timeout = window.setTimeout(
      () => setResult(null),
      result.outcome === "ACCEPTED" ? 4_000 : 7_000,
    );
    return () => window.clearTimeout(timeout);
  }, [result]);

  async function voidCheckIn(entry: AttendanceRosterEntry) {
    if (!entry.attendance || voidingId) return;
    if (
      !window.confirm(
        `Undo ${entry.fullName}'s check-in? They can be scanned in again afterwards.`,
      )
    )
      return;
    setVoidingId(entry.attendance.id);
    setRequestError(null);
    try {
      const response = await fetch(
        `/api/admin/attendance/events/${eventId}/attendance/${entry.attendance.id}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error(
          await readError(response, "Check-in could not be undone"),
        );
      await Promise.all([loadRoster(), onAttendanceChange()]);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Check-in could not be undone",
      );
    } finally {
      setVoidingId(null);
    }
  }

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (manualNumber.trim()) {
      void submitScan({ mode: "MANUAL", studentNumber: manualNumber });
    }
  }

  const selectedIsOpen = event?.status === "OPEN";
  const content = result ? RESULT_CONTENT[result.outcome] : null;
  const resultStyle = content ? RESULT_STYLES[content.kind] : null;
  const closeTime = event
    ? new Date(event.checkInOpensAt).toDateString() ===
      new Date(event.checkInClosesAt).toDateString()
      ? new Date(event.checkInClosesAt).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        })
      : formatDateTime(event.checkInClosesAt)
    : "";

  return (
    <div className="space-y-5">
      <section className={`${card} p-4 sm:p-5`}>
        <label className="block">
          <span className={fieldLabel}>Event</span>
          <select
            value={eventId}
            onChange={(changeEvent) => {
              setEventId(changeEvent.target.value);
              setEvent(null);
              setEntries([]);
              setResult(null);
            }}
            className={input}
          >
            <option value="">Choose an attendance event</option>
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {item.status.toLowerCase()} · A.Y.{" "}
                {item.schoolYear}
              </option>
            ))}
          </select>
        </label>
        {event && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#134687]/65">
            <span
              className={`${pill} ${selectedIsOpen ? tones.success : tones.neutral}`}
            >
              {selectedIsOpen ? "Open" : event.status.toLowerCase()}
            </span>
            <span className="min-w-0 break-words">{event.venue}</span>
            <span>
              <strong className="font-semibold text-[#134687]">
                {event.attendanceCount}
              </strong>{" "}
              / {event.rosterCount} checked in
            </span>
            <span>
              Window: {formatDateTime(event.checkInOpensAt)} – {closeTime}
            </span>
          </div>
        )}
      </section>

      {eventId && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <AttendanceQrScanner
            disabled={submitting || Boolean(result) || !selectedIsOpen}
            onScan={(credential) => submitScan({ mode: "QR", credential })}
          />
          <div className="min-w-0 space-y-5">
            <section className={card} aria-live="assertive">
              <div className={cardHeader}>
                <h2 className="font-poppins font-semibold text-[#134687]">
                  Result
                </h2>
                {content && resultStyle && (
                  <span className={`${pill} ${resultStyle.pill}`}>
                    {content.title}
                  </span>
                )}
              </div>
              <div className="flex min-h-56 flex-col justify-center p-4 sm:p-5">
                {submitting ? (
                  <div className="flex flex-col items-center gap-3 text-[#134687]/70">
                    <LoaderCircle className="h-7 w-7 animate-spin" />
                    <span className="text-sm font-semibold">
                      Checking the event roster…
                    </span>
                  </div>
                ) : result && content && resultStyle ? (
                  <div className="text-center">
                    <span
                      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${resultStyle.icon}`}
                    >
                      {content.kind === "success" ? (
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                      ) : content.kind === "warning" ? (
                        <Clock3 className="h-6 w-6" aria-hidden="true" />
                      ) : (
                        <UserX className="h-6 w-6" aria-hidden="true" />
                      )}
                    </span>
                    <h3 className="mt-3 font-poppins text-lg font-semibold text-[#134687]">
                      {content.title}
                    </h3>
                    {result.attendee && (
                      <div className="mx-auto mt-3 max-w-sm rounded-xl border border-[#005FD9]/10 bg-[#F9FBFF] px-4 py-3 text-left">
                        <strong className="block break-words text-sm text-[#134687]">
                          {result.attendee.fullName}
                        </strong>
                        <span className="mt-0.5 block font-mono text-xs text-[#134687]/60">
                          {result.attendee.studentNumber}
                          {result.attendee.section
                            ? ` · ${result.attendee.section}`
                            : ""}
                        </span>
                      </div>
                    )}
                    <p className={`${hint} mt-3`}>{content.description}</p>
                    <button
                      type="button"
                      onClick={() => setResult(null)}
                      className={`${secondary} mt-4 inline-flex items-center gap-2`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Next attendee
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <CheckCircle2
                      className="mx-auto mb-3 h-9 w-9 text-[#044FAF]/25"
                      aria-hidden="true"
                    />
                    <h3 className="font-poppins font-semibold text-[#134687]">
                      Ready for an attendee
                    </h3>
                    <p className={`${hint} mx-auto mt-1 max-w-sm`}>
                      {selectedIsOpen
                        ? "Scan a CSS digital ID QR, or an imported student's UST QR."
                        : "Open the event from the Events tab to start check-in."}
                    </p>
                  </div>
                )}
                {requestError && (
                  <p
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    role="alert"
                  >
                    {requestError}
                  </p>
                )}
              </div>
            </section>

            <form onSubmit={submitManual} className={card}>
              <div className={cardHeader}>
                <h2 className="font-poppins font-semibold text-[#134687]">
                  Manual check-in
                </h2>
              </div>
              <div className="p-4 sm:p-5">
                <label htmlFor="manual-student-number" className={fieldLabel}>
                  Student number
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="manual-student-number"
                    value={manualNumber}
                    onChange={(inputEvent) =>
                      setManualNumber(inputEvent.target.value)
                    }
                    inputMode="numeric"
                    maxLength={16}
                    disabled={submitting || !selectedIsOpen}
                    placeholder="10-digit student number"
                    className={`${input} sm:flex-1`}
                  />
                  <button
                    type="submit"
                    disabled={
                      submitting || !selectedIsOpen || !manualNumber.trim()
                    }
                    className={`${primary} inline-flex shrink-0 items-center justify-center gap-2`}
                  >
                    <Keyboard className="h-4 w-4" aria-hidden="true" /> Check in
                  </button>
                </div>
                <p className={`${hint} mt-2`}>
                  Use this when the camera is unavailable or a QR won&apos;t
                  scan.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}

      {event && (
        <section className={card}>
          <div className={cardHeader}>
            <div className="min-w-0">
              <h2 className="font-poppins font-semibold text-[#134687]">
                Event roster
              </h2>
              <p className="text-xs text-[#134687]/60">
                {pagination.total} matching · page {page} of{" "}
                {pagination.totalPages}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label className="relative min-w-0 sm:w-56">
                <span className="sr-only">Search roster</span>
                <Search
                  className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#134687]/40"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(inputEvent) => setSearch(inputEvent.target.value)}
                  placeholder="Search name or ID"
                  className={`${input} pl-9`}
                />
              </label>
              <label className="min-w-0">
                <span className="sr-only">Attendance filter</span>
                <select
                  value={statusFilter}
                  onChange={(filterEvent) =>
                    setStatusFilter(filterEvent.target.value)
                  }
                  className={`${input} sm:w-40`}
                >
                  <option value="all">All attendees</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            {loadingRoster && entries.length === 0 ? (
              <div className="flex justify-center py-10">
                <LoaderCircle className="h-6 w-6 animate-spin text-[#044FAF]" />
              </div>
            ) : entries.length ? (
              <table
                className={`w-full min-w-[680px] text-left text-sm transition-opacity ${loadingRoster ? "opacity-60" : ""}`}
              >
                <thead className="bg-[#F9FBFF] text-[11px] font-semibold uppercase tracking-wide text-[#134687]/55">
                  <tr>
                    <th className="px-4 py-2.5 sm:px-5">Attendee</th>
                    <th className="px-4 py-2.5">Student / Member ID</th>
                    <th className="px-4 py-2.5">Group</th>
                    <th className="px-4 py-2.5 sm:px-5">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#005FD9]/10">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-4 py-3 sm:px-5">
                        <strong className="block break-words font-semibold text-[#134687]">
                          {entry.fullName}
                        </strong>
                        <span className="text-xs text-[#134687]/55">
                          {entry.section || "No section"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#134687]/70">
                        {entry.studentNumber}
                        <br />
                        {entry.memberId || "No member ID"}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-[#134687]/65">
                        {entry.affiliationGroups
                          .map((group) =>
                            group.replaceAll("_", " ").toLowerCase(),
                          )
                          .join(", ")}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {entry.attendance ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`${pill} ${tones.success}`}>
                              Present
                            </span>
                            <span className="text-xs text-[#134687]/55">
                              {new Date(
                                entry.attendance.checkedInAt,
                              ).toLocaleTimeString("en-PH", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            {canManage && (
                              <button
                                type="button"
                                disabled={voidingId !== null}
                                onClick={() => void voidCheckIn(entry)}
                                className={`rounded-md px-2 py-0.5 text-xs font-semibold text-red-700/80 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 ${focus}`}
                              >
                                {voidingId === entry.attendance.id
                                  ? "Undoing…"
                                  : "Undo"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={`${pill} ${tones.neutral}`}>
                            Absent
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-10 text-center text-sm text-[#134687]/55">
                No roster entries match these filters.
              </p>
            )}
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#005FD9]/10 px-4 py-3 sm:px-5">
              <button
                type="button"
                disabled={page <= 1 || loadingRoster}
                onClick={() => setPage((current) => current - 1)}
                className={secondary}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages || loadingRoster}
                onClick={() => setPage((current) => current + 1)}
                className={secondary}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
