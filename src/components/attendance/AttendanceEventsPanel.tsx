"use client";

import {
  Archive,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  MapPin,
  Pencil,
  Play,
  QrCode,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import {
  card,
  cardHeader,
  checkbox,
  fieldLabel,
  focus,
  hint,
  input,
  pill,
  primary,
  secondary,
  tones,
} from "@/components/admin/ui";
import type {
  AttendanceCycle,
  AttendanceEvent,
  AttendanceEventStatus,
  AttendanceGroup,
} from "@/types/attendance";

const GROUP_OPTIONS: Array<{ value: AttendanceGroup; label: string }> = [
  { value: "MEMBER", label: "Members" },
  { value: "COMMITTEE_STAFF", label: "Committee Staff" },
  { value: "EXECUTIVE_ASSOCIATE", label: "Executive Associates" },
  { value: "IMPORTED_STUDENT", label: "Imported CS students" },
];

const STATUS_LABELS: Record<AttendanceEventStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};
const STATUS_TONES: Record<AttendanceEventStatus, string> = {
  DRAFT: tones.info,
  OPEN: tones.success,
  CLOSED: tones.neutral,
  ARCHIVED: tones.neutral,
};
const actionButton = `${secondary} inline-flex items-center gap-1.5`;
const quietButton = `inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[#134687]/70 transition-colors hover:bg-[#F3F8FF] hover:text-[#134687] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error || fallback;
}

export default function AttendanceEventsPanel({
  events,
  cycles,
  canManage,
  loading,
  onReload,
  onCheckIn,
}: {
  events: AttendanceEvent[];
  cycles: AttendanceCycle[];
  canManage: boolean;
  loading: boolean;
  onReload: () => Promise<void>;
  onCheckIn: (eventId: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AttendanceEvent | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60_000);

  async function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const eligibleGroups = GROUP_OPTIONS.filter((group) =>
      form.get(group.value),
    ).map((group) => group.value);
    if (!eligibleGroups.length) {
      toast.error("Select at least one eligible group");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        editingEvent
          ? `/api/admin/attendance/events/${editingEvent.id}`
          : "/api/admin/attendance/events",
        {
          method: editingEvent ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recruitmentCycleId: form.get("recruitmentCycleId"),
            title: form.get("title"),
            venue: form.get("venue"),
            startsAt: new Date(String(form.get("startsAt"))).toISOString(),
            endsAt: new Date(String(form.get("endsAt"))).toISOString(),
            checkInOpensAt: new Date(
              String(form.get("checkInOpensAt")),
            ).toISOString(),
            checkInClosesAt: new Date(
              String(form.get("checkInClosesAt")),
            ).toISOString(),
            eligibleGroups,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            editingEvent
              ? "Event could not be updated"
              : "Event could not be created",
          ),
        );
      }
      toast.success(
        editingEvent
          ? "Attendance event updated"
          : "Draft attendance event created",
      );
      setShowCreate(false);
      setEditingEvent(null);
      await onReload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Event could not be saved",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(
    event: AttendanceEvent,
    status: AttendanceEventStatus,
  ) {
    setChangingId(event.id);
    try {
      const response = await fetch(
        `/api/admin/attendance/events/${event.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readError(response, "Event status could not be updated"),
        );
      }
      toast.success(`Event marked ${status.toLowerCase()}`);
      await onReload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Status update failed",
      );
    } finally {
      setChangingId(null);
    }
  }

  async function refreshRoster(event: AttendanceEvent) {
    setChangingId(event.id);
    try {
      const response = await fetch(
        `/api/admin/attendance/events/${event.id}/status`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(
          await readError(response, "Roster could not be refreshed"),
        );
      }
      const body = (await response.json()) as {
        rosterCount: number;
        added: number | null;
      };
      toast.success(
        body.added === null
          ? `Roster refreshed with ${body.rosterCount} eligible attendees`
          : `Added ${body.added} new attendees (${body.rosterCount} on roster)`,
      );
      await onReload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Roster refresh failed",
      );
    } finally {
      setChangingId(null);
    }
  }

  async function deleteEvent(event: AttendanceEvent) {
    const confirmed = window.confirm(
      `Delete “${event.title}”? This permanently removes its roster, attendance records, scan history, and reports.`,
    );
    if (!confirmed) return;

    setChangingId(event.id);
    try {
      const response = await fetch(`/api/admin/attendance/events/${event.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(
          await readError(response, "Attendance event could not be deleted"),
        );
      }
      toast.success("Attendance event deleted");
      await onReload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Attendance event could not be deleted",
      );
    } finally {
      setChangingId(null);
    }
  }

  async function exportAttendance(
    event: AttendanceEvent,
    format: "csv" | "pdf",
  ) {
    const exportKey = `${event.id}:${format}`;
    setExportingKey(exportKey);
    try {
      const response = await fetch(
        `/api/admin/attendance/events/${event.id}/export?format=${format}`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(
          await readError(response, "Attendance could not be exported"),
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || `attendance.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success(`${format.toUpperCase()} attendance report downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-poppins text-lg font-semibold text-[#134687]">
            Events
          </h2>
          <p className={`${hint} max-w-2xl`}>
            Each event keeps a roster snapshot. People approved or imported
            later are added on their first scan, or with Sync roster.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setEditingEvent(null);
              setShowCreate((value) => !value);
            }}
            className={`${primary} inline-flex shrink-0 items-center gap-2`}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            {showCreate ? "Close form" : "Create event"}
          </button>
        )}
      </div>

      {(showCreate || editingEvent) && canManage && (
        <form
          id="attendance-event-form"
          key={editingEvent?.id || "create"}
          onSubmit={saveEvent}
          className={`${card} scroll-mt-6`}
        >
          <div className={cardHeader}>
            <h3 className="font-poppins font-semibold text-[#134687]">
              {editingEvent
                ? `Edit “${editingEvent.title}”`
                : "New draft event"}
            </h3>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
            <label className="min-w-0 md:col-span-2">
              <span className={fieldLabel}>Academic year</span>
              <select
                name="recruitmentCycleId"
                required
                defaultValue={
                  editingEvent?.recruitmentCycleId ||
                  cycles.find((cycle) => cycle.isActive)?.id ||
                  ""
                }
                className={input}
              >
                <option value="" disabled>
                  Select an academic year
                </option>
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    A.Y. {cycle.schoolYear}
                    {cycle.isActive ? " · Active" : ""}
                  </option>
                ))}
              </select>
            </label>
            <FormField
              label="Event name"
              name="title"
              maxLength={160}
              defaultValue={editingEvent?.title}
            />
            <FormField
              label="Venue"
              name="venue"
              maxLength={160}
              defaultValue={editingEvent?.venue}
            />
            <FormField
              label="Event starts"
              name="startsAt"
              type="datetime-local"
              defaultValue={localInputValue(
                editingEvent ? new Date(editingEvent.startsAt) : defaultStart,
              )}
            />
            <FormField
              label="Event ends"
              name="endsAt"
              type="datetime-local"
              defaultValue={localInputValue(
                editingEvent
                  ? new Date(editingEvent.endsAt)
                  : new Date(defaultStart.getTime() + 3 * 60 * 60_000),
              )}
            />
            <FormField
              label="Check-in opens"
              name="checkInOpensAt"
              type="datetime-local"
              defaultValue={localInputValue(
                editingEvent
                  ? new Date(editingEvent.checkInOpensAt)
                  : new Date(defaultStart.getTime() - 30 * 60_000),
              )}
            />
            <FormField
              label="Check-in closes"
              name="checkInClosesAt"
              type="datetime-local"
              defaultValue={localInputValue(
                editingEvent
                  ? new Date(editingEvent.checkInClosesAt)
                  : new Date(defaultStart.getTime() + 2 * 60 * 60_000),
              )}
            />
            <fieldset className="rounded-xl border border-[#005FD9]/10 p-4 md:col-span-2">
              <legend className="px-1 text-xs font-semibold text-[#134687]/80">
                Eligible groups
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {GROUP_OPTIONS.map((group) => (
                  <label
                    key={group.value}
                    className="flex items-center gap-2 text-sm text-[#134687]"
                  >
                    <input
                      type="checkbox"
                      name={group.value}
                      defaultChecked={
                        editingEvent
                          ? editingEvent.eligibleGroups.includes(group.value)
                          : true
                      }
                      className={checkbox}
                    />
                    {group.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#005FD9]/10 bg-[#F9FBFF] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setEditingEvent(null);
              }}
              className={secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`${primary} inline-flex items-center gap-2`}
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : editingEvent ? (
                <Pencil className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              )}
              {submitting
                ? "Saving…"
                : editingEvent
                  ? "Save changes"
                  : "Create draft"}
            </button>
          </div>
        </form>
      )}

      {loading && events.length === 0 ? (
        <div className="grid gap-4 xl:grid-cols-2" aria-busy="true">
          {[0, 1].map((index) => (
            <div key={index} className={`${card} animate-pulse p-5`}>
              <div className="h-4 w-16 rounded-full bg-[#F3F3FD]" />
              <div className="mt-3 h-5 w-2/3 rounded bg-[#F3F3FD]" />
              <div className="mt-3 h-3 w-1/2 rounded bg-[#F3F3FD]" />
              <div className="mt-2 h-3 w-1/3 rounded bg-[#F3F3FD]" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className={`${card} p-10 text-center`}>
          <CalendarDays
            className="mx-auto mb-3 h-9 w-9 text-[#044FAF]/35"
            aria-hidden="true"
          />
          <h3 className="font-poppins font-semibold text-[#134687]">
            No attendance events yet
          </h3>
          <p className={`${hint} mt-1`}>
            Create a draft event to build its first roster.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {events.map((event) => {
            const busy = changingId === event.id;
            return (
              <article key={event.id} className={`${card} flex flex-col`}>
                <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className={`${pill} ${STATUS_TONES[event.status]}`}>
                        {STATUS_LABELS[event.status]}
                      </span>
                      <span className="text-[11px] text-[#134687]/55">
                        A.Y. {event.schoolYear}
                      </span>
                    </div>
                    <h3 className="break-words font-poppins text-base font-semibold text-[#134687]">
                      {event.title}
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs text-[#134687]/65">
                      <li className="flex items-start gap-1.5">
                        <MapPin
                          className="mt-px h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 break-words">
                          {event.venue}
                        </span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CalendarDays
                          className="mt-px h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{formatDateTime(event.startsAt)}</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Clock3
                          className="mt-px h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Check-in {formatDateTime(event.checkInOpensAt)} –{" "}
                          {formatDateTime(event.checkInClosesAt)}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="shrink-0 rounded-xl bg-[#F3F8FF] px-3 py-2 text-center">
                    <strong className="block font-poppins text-xl font-semibold text-[#134687]">
                      {event.attendanceCount}
                    </strong>
                    <span className="text-[11px] text-[#134687]/60">
                      of {event.rosterCount} present
                    </span>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#005FD9]/10 bg-[#F9FBFF] px-4 py-3 sm:px-5">
                  {event.status === "OPEN" && (
                    <button
                      type="button"
                      onClick={() => onCheckIn(event.id)}
                      className={`${primary} inline-flex items-center gap-1.5 py-1.5`}
                    >
                      <QrCode className="h-4 w-4" aria-hidden="true" /> Check in
                    </button>
                  )}
                  {canManage && event.status === "DRAFT" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus(event, "OPEN")}
                      className={`${primary} inline-flex items-center gap-1.5 py-1.5`}
                    >
                      <Play className="h-4 w-4" aria-hidden="true" /> Open
                      check-in
                    </button>
                  )}
                  {canManage && event.status === "OPEN" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus(event, "CLOSED")}
                      className={actionButton}
                    >
                      <Square className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                      Close
                    </button>
                  )}
                  {canManage && event.status === "CLOSED" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void changeStatus(event, "OPEN")}
                      className={actionButton}
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" /> Reopen
                    </button>
                  )}
                  <div className="ml-auto flex flex-wrap gap-2">
                    {(["csv", "pdf"] as const).map((format) => (
                      <button
                        key={format}
                        type="button"
                        disabled={exportingKey !== null}
                        onClick={() => void exportAttendance(event, format)}
                        className={actionButton}
                      >
                        {exportingKey === `${event.id}:${format}` ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : format === "csv" ? (
                          <Download
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <FileText
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-wrap items-center gap-1 border-t border-[#005FD9]/10 px-3 py-2 sm:px-4">
                    {(event.status === "DRAFT" || event.status === "OPEN") && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreate(false);
                          setEditingEvent(event);
                          window.requestAnimationFrame(() =>
                            document
                              .getElementById("attendance-event-form")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              }),
                          );
                        }}
                        className={quietButton}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                        Edit
                      </button>
                    )}
                    {event.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void refreshRoster(event)}
                        title={
                          event.status === "DRAFT"
                            ? "Rebuild the roster from current approvals and imports"
                            : "Add newly eligible attendees without removing anyone"
                        }
                        className={quietButton}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
                          aria-hidden="true"
                        />
                        {event.status === "DRAFT"
                          ? "Refresh roster"
                          : "Sync roster"}
                      </button>
                    )}
                    {(event.status === "DRAFT" ||
                      event.status === "CLOSED") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void changeStatus(event, "ARCHIVED")}
                        className={quietButton}
                      >
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteEvent(event)}
                      className={`${quietButton} ml-auto text-red-700/80 hover:bg-red-50 hover:text-red-700`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                      Delete
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  name,
  type = "text",
  defaultValue,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  maxLength?: number;
}) {
  return (
    <label className="min-w-0">
      <span className={fieldLabel}>{label}</span>
      <input
        name={name}
        type={type}
        required
        defaultValue={defaultValue}
        maxLength={maxLength}
        className={input}
      />
    </label>
  );
}
