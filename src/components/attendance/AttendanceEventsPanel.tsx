"use client";

import {
  Archive,
  CalendarDays,
  CalendarPlus,
  Download,
  FileText,
  LoaderCircle,
  MapPin,
  Pencil,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
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
      const body = (await response.json()) as { rosterCount: number };
      toast.success(
        `Roster refreshed with ${body.rosterCount} eligible attendees`,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-poppins text-xl font-bold text-[#134687]">
            Events
          </h2>
          <p className="text-sm text-[#134687]/65">
            Event rosters are snapshots. Later member or CSV updates do not
            rewrite attendance history.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setEditingEvent(null);
              setShowCreate((value) => !value);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#134687] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#044FAF]"
          >
            <CalendarPlus className="h-4 w-4" />
            {showCreate ? "Close form" : "Create event"}
          </button>
        )}
      </div>

      {(showCreate || editingEvent) && canManage && (
        <form
          id="attendance-event-form"
          key={editingEvent?.id || "create"}
          onSubmit={saveEvent}
          className="grid scroll-mt-6 gap-4 rounded-2xl border border-[#005FD9]/10 bg-white p-5 shadow-sm md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#044FAF]/60">
              {editingEvent ? "Update event" : "New event"}
            </p>
            <h3 className="font-poppins text-lg font-bold text-[#134687]">
              {editingEvent ? editingEvent.title : "Create a draft event"}
            </h3>
          </div>
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-[#134687]">
              Academic year
            </span>
            <select
              name="recruitmentCycleId"
              required
              defaultValue={
                editingEvent?.recruitmentCycleId ||
                cycles.find((cycle) => cycle.isActive)?.id ||
                ""
              }
              className="w-full rounded-lg border border-[#005FD9]/20 px-3 py-2.5 text-sm"
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
            <legend className="px-2 text-xs font-semibold text-[#134687]">
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
                    className="h-4 w-4 accent-[#044FAF]"
                  />
                  {group.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setEditingEvent(null);
              }}
              className="rounded-lg border border-[#005FD9]/15 px-4 py-2 text-sm font-semibold text-[#134687]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : editingEvent ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
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

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl bg-white">
          <LoaderCircle className="h-7 w-7 animate-spin text-[#044FAF]" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-[#005FD9]/10 bg-white p-10 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-[#044FAF]/40" />
          <h3 className="font-poppins font-semibold text-[#134687]">
            No attendance events yet
          </h3>
          <p className="mt-1 text-sm text-[#134687]/60">
            Create a draft event to materialize its first roster.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {events.map((event) => (
            <article
              key={event.id}
              className="rounded-2xl border border-[#005FD9]/10 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${event.status === "OPEN" ? "bg-green-100 text-green-700" : event.status === "CLOSED" ? "bg-gray-100 text-gray-700" : event.status === "ARCHIVED" ? "bg-slate-100 text-slate-500" : "bg-[#E8F2FF] text-[#044FAF]"}`}
                    >
                      {event.status}
                    </span>
                    <span className="font-mono text-[10px] text-[#134687]/50">
                      A.Y. {event.schoolYear}
                    </span>
                  </div>
                  <h3 className="truncate font-poppins text-lg font-bold text-[#134687]">
                    {event.title}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-[#134687]/65">
                    <MapPin className="h-4 w-4" /> {event.venue}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#134687]/55">
                    <CalendarDays className="h-4 w-4" />{" "}
                    {new Date(event.startsAt).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <strong className="block font-poppins text-2xl text-[#044FAF]">
                    {event.attendanceCount}
                  </strong>
                  <span className="text-[11px] text-[#134687]/55">
                    of {event.rosterCount} present
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#005FD9]/10 pt-4">
                {canManage &&
                  (event.status === "DRAFT" || event.status === "OPEN") && (
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#005FD9]/15 px-3 py-2 text-xs font-semibold text-[#134687] hover:bg-[#F3F8FF]"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                {event.status === "OPEN" && (
                  <button
                    type="button"
                    onClick={() => onCheckIn(event.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#134687] px-3 py-2 text-xs font-semibold text-white hover:bg-[#044FAF]"
                  >
                    <Play className="h-3.5 w-3.5" /> Check in
                  </button>
                )}
                <button
                  type="button"
                  disabled={exportingKey !== null}
                  onClick={() => void exportAttendance(event, "csv")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#005FD9]/15 px-3 py-2 text-xs font-semibold text-[#134687] hover:bg-[#F3F8FF] disabled:opacity-50"
                >
                  {exportingKey === `${event.id}:csv` ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  CSV
                </button>
                <button
                  type="button"
                  disabled={exportingKey !== null}
                  onClick={() => void exportAttendance(event, "pdf")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E8F2FF] px-3 py-2 text-xs font-semibold text-[#044FAF] hover:bg-[#D8E9FF] disabled:opacity-50"
                >
                  {exportingKey === `${event.id}:pdf` ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  PDF
                </button>
                {canManage && event.status === "DRAFT" && (
                  <>
                    <button
                      type="button"
                      disabled={changingId === event.id}
                      onClick={() => void refreshRoster(event)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#005FD9]/15 px-3 py-2 text-xs font-semibold text-[#134687] disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh roster
                    </button>
                    <button
                      type="button"
                      disabled={changingId === event.id}
                      onClick={() => void changeStatus(event, "OPEN")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" /> Open
                    </button>
                  </>
                )}
                {canManage && event.status === "OPEN" && (
                  <button
                    type="button"
                    disabled={changingId === event.id}
                    onClick={() => void changeStatus(event, "CLOSED")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#005FD9]/15 px-3 py-2 text-xs font-semibold text-[#134687] disabled:opacity-50"
                  >
                    <Square className="h-3.5 w-3.5" /> Close
                  </button>
                )}
                {canManage && event.status === "CLOSED" && (
                  <button
                    type="button"
                    disabled={changingId === event.id}
                    onClick={() => void changeStatus(event, "OPEN")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" /> Reopen
                  </button>
                )}
                {canManage &&
                  (event.status === "DRAFT" || event.status === "CLOSED") && (
                    <button
                      type="button"
                      disabled={changingId === event.id}
                      onClick={() => void changeStatus(event, "ARCHIVED")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
                    >
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                  )}
                {canManage && (
                  <button
                    type="button"
                    disabled={changingId === event.id}
                    onClick={() => void deleteEvent(event)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            </article>
          ))}
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
    <label>
      <span className="mb-1 block text-xs font-semibold text-[#134687]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required
        defaultValue={defaultValue}
        maxLength={maxLength}
        className="w-full rounded-lg border border-[#005FD9]/20 px-3 py-2.5 text-sm outline-none focus:border-[#044FAF] focus:ring-2 focus:ring-[#044FAF]/10"
      />
    </label>
  );
}
