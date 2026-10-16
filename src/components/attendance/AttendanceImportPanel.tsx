"use client";

import {
  FileCheck2,
  FileUp,
  LoaderCircle,
  Plus,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import type { AttendanceCycle } from "@/types/attendance";

type Preview = {
  schoolYear: string;
  headerRow: number;
  studentCount: number;
  canImport: boolean;
  students: Array<{
    rowNumber: number;
    studentNumber: string;
    fullName: string;
    section: string;
  }>;
  issues: Array<{
    rowNumber: number | null;
    severity: "WARNING" | "ERROR";
    code: string;
    message: string;
  }>;
};

type ImportedGuest = {
  id: string;
  studentNumber: string;
  fullName: string;
  section: string | null;
  isActive: boolean;
};

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error || fallback;
}

export default function AttendanceImportPanel({
  cycles,
}: {
  cycles: AttendanceCycle[];
}) {
  const [cycleId, setCycleId] = useState(
    cycles.find((cycle) => cycle.isActive)?.id || cycles[0]?.id || "",
  );
  const [section, setSection] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [guests, setGuests] = useState<ImportedGuest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadGuests = useCallback(async () => {
    if (!cycleId) return;
    setLoadingGuests(true);
    try {
      const response = await fetch(
        `/api/admin/attendance/import?recruitmentCycleId=${encodeURIComponent(cycleId)}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          await readError(response, "Imported students could not be loaded"),
        );
      const body = (await response.json()) as { guests: ImportedGuest[] };
      setGuests(body.guests);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Imported students could not be loaded",
      );
    } finally {
      setLoadingGuests(false);
    }
  }, [cycleId]);

  useEffect(() => {
    void loadGuests();
  }, [loadGuests]);

  const errorCount = useMemo(
    () =>
      preview?.issues.filter((issue) => issue.severity === "ERROR").length || 0,
    [preview],
  );
  const warningCount = useMemo(
    () =>
      preview?.issues.filter((issue) => issue.severity === "WARNING").length ||
      0,
    [preview],
  );

  function uploadForm() {
    if (!file || !cycleId)
      throw new Error("Choose a CSV file and academic year first");
    const form = new FormData();
    form.set("file", file);
    form.set("recruitmentCycleId", cycleId);
    form.set("section", section);
    return form;
  }

  async function previewCsv() {
    setPreviewing(true);
    try {
      const response = await fetch("/api/admin/attendance/import/preview", {
        method: "POST",
        body: uploadForm(),
      });
      if (!response.ok)
        throw new Error(
          await readError(response, "CSV could not be previewed"),
        );
      setPreview((await response.json()) as Preview);
    } catch (error) {
      setPreview(null);
      toast.error(
        error instanceof Error ? error.message : "CSV preview failed",
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function importCsv() {
    setImporting(true);
    try {
      const response = await fetch("/api/admin/attendance/import", {
        method: "POST",
        body: uploadForm(),
      });
      if (!response.ok)
        throw new Error(await readError(response, "CSV could not be imported"));
      const body = (await response.json()) as {
        createdCount: number;
        updatedCount: number;
        total: number;
      };
      toast.success(
        `${body.createdCount} added, ${body.updatedCount} updated · ${body.total} imported students`,
      );
      await loadGuests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV import failed");
    } finally {
      setImporting(false);
    }
  }

  async function addStudent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const formElement = formEvent.currentTarget;
    const form = new FormData(formElement);
    setAdding(true);
    try {
      const response = await fetch("/api/admin/attendance/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruitmentCycleId: cycleId,
          studentNumber: form.get("studentNumber"),
          fullName: form.get("fullName"),
          section: form.get("section"),
        }),
      });
      if (!response.ok)
        throw new Error(
          await readError(response, "Student could not be added"),
        );
      const body = (await response.json()) as { duplicate?: boolean };
      if (body.duplicate) {
        toast.info("That student is already active in the imported roster");
      } else {
        toast.success("Student added to the imported roster");
      }
      formElement.reset();
      await loadGuests();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Student could not be added",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h2 className="font-poppins text-lg font-semibold text-[#134687]">
          Imported CS students
        </h2>
        <p className={`${hint} max-w-2xl`}>
          Add attendees who are not in CSSApply. They check in with their UST QR
          or student number. Students imported after an event is created are
          added to its roster on their first scan.
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <section className={card}>
          <div className={cardHeader}>
            <h3 className="font-poppins font-semibold text-[#134687]">
              Import a class list (CSV)
            </h3>
          </div>
          <div className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0">
                <span className={fieldLabel}>Academic year</span>
                <select
                  value={cycleId}
                  onChange={(event) => {
                    setCycleId(event.target.value);
                    setPreview(null);
                  }}
                  className={input}
                >
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      A.Y. {cycle.schoolYear}
                      {cycle.isActive ? " · Active" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className={fieldLabel}>
                  Section override
                  <span className="font-normal text-[#134687]/45">
                    {" "}
                    · optional
                  </span>
                </span>
                <input
                  value={section}
                  onChange={(event) => {
                    setSection(event.target.value);
                    setPreview(null);
                  }}
                  placeholder="e.g. 4CSD"
                  className={input}
                />
              </label>
            </div>
            <label
              className={`mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#005FD9]/25 bg-[#F9FBFF] p-4 text-[#134687] transition-colors hover:bg-[#F3F8FF] focus-within:ring-2 focus-within:ring-[#044FAF]`}
            >
              <FileUp
                className="h-5 w-5 shrink-0 text-[#044FAF]/70"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <strong className="block truncate text-sm font-semibold">
                  {file?.name || "Choose a class-list CSV"}
                </strong>
                <span className="text-xs text-[#134687]/55">
                  Up to 2 MB · student ID and name columns required
                </span>
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setPreview(null);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void previewCsv()}
              disabled={!file || previewing || importing}
              className={`${secondary} mt-3 inline-flex items-center gap-2`}
            >
              {previewing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              )}
              {previewing ? "Reading CSV…" : "Preview rows"}
            </button>

            {preview && (
              <div className="mt-5 space-y-4 border-t border-[#005FD9]/10 pt-5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    {
                      label: "students",
                      value: preview.studentCount,
                      color: "text-[#134687]",
                    },
                    {
                      label: "warnings",
                      value: warningCount,
                      color: "text-[#8A5A00]",
                    },
                    {
                      label: "errors",
                      value: errorCount,
                      color: "text-red-700",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl bg-[#F3F8FF] px-2 py-2.5"
                    >
                      <strong
                        className={`block font-poppins text-lg font-semibold ${stat.color}`}
                      >
                        {stat.value}
                      </strong>
                      <span className="text-xs text-[#134687]/60">
                        {stat.label}
                      </span>
                    </div>
                  ))}
                </div>
                {preview.issues.length > 0 && (
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                    {preview.issues.map((issue, index) => (
                      <li
                        key={`${issue.code}-${issue.rowNumber}-${index}`}
                        className={`rounded-lg px-3 py-2 text-xs ${issue.severity === "ERROR" ? "bg-red-50 text-red-700" : "bg-[#FFF8E7] text-[#6F4B00]"}`}
                      >
                        <strong className="font-semibold">
                          {issue.severity === "ERROR" ? "Error" : "Warning"}
                          {issue.rowNumber ? ` · row ${issue.rowNumber}` : ""}:
                        </strong>{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="max-h-72 overflow-auto rounded-xl border border-[#005FD9]/10">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="sticky top-0 bg-[#F9FBFF] text-[11px] font-semibold uppercase tracking-wide text-[#134687]/55">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Student number</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Section</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#005FD9]/10 text-[#134687]/80">
                      {preview.students.map((student) => (
                        <tr
                          key={`${student.studentNumber}-${student.rowNumber}`}
                        >
                          <td className="px-3 py-2">{student.rowNumber}</td>
                          <td className="px-3 py-2 font-mono">
                            {student.studentNumber}
                          </td>
                          <td className="px-3 py-2 font-semibold text-[#134687]">
                            {student.fullName}
                          </td>
                          <td className="px-3 py-2">{student.section}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => void importCsv()}
                  disabled={!preview.canImport || importing}
                  className={`${primary} inline-flex w-full items-center justify-center gap-2 py-2.5`}
                >
                  {importing ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <UsersRound className="h-4 w-4" aria-hidden="true" />
                  )}
                  {importing
                    ? "Importing…"
                    : `Import ${preview.studentCount} students`}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h3 className="font-poppins font-semibold text-[#134687]">
              Add one student
            </h3>
          </div>
          <form onSubmit={addStudent} className="space-y-3 p-4 sm:p-5">
            <ImportField
              label="Student number"
              name="studentNumber"
              placeholder="10-digit student number"
              inputMode="numeric"
            />
            <ImportField
              label="Full name"
              name="fullName"
              placeholder="Juan Dela Cruz"
            />
            <ImportField label="Section" name="section" placeholder="4CSD" />
            <button
              type="submit"
              disabled={adding || !cycleId}
              className={`${primary} inline-flex w-full items-center justify-center gap-2`}
            >
              {adding ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              {adding ? "Adding…" : "Add student"}
            </button>
          </form>
        </section>
      </div>

      <section className={card}>
        <div className={cardHeader}>
          <div className="min-w-0">
            <h3 className="font-poppins font-semibold text-[#134687]">
              Current imported roster
            </h3>
            <p className="text-xs text-[#134687]/60">
              {guests.filter((guest) => guest.isActive).length} active students
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadGuests()}
            disabled={loadingGuests}
            className={`${secondary} inline-flex items-center gap-1.5`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingGuests ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
        {loadingGuests && guests.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-6 w-6 animate-spin text-[#044FAF]" />
          </div>
        ) : guests.length ? (
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="sticky top-0 bg-[#F9FBFF] text-[11px] font-semibold uppercase tracking-wide text-[#134687]/55">
                <tr>
                  <th className="px-4 py-2.5 sm:px-5">Name</th>
                  <th className="px-4 py-2.5">Student number</th>
                  <th className="px-4 py-2.5">Section</th>
                  <th className="px-4 py-2.5 sm:px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#005FD9]/10">
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td className="break-words px-4 py-2.5 font-semibold text-[#134687] sm:px-5">
                      {guest.fullName}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#134687]/70">
                      {guest.studentNumber}
                    </td>
                    <td className="px-4 py-2.5 text-[#134687]/70">
                      {guest.section || "—"}
                    </td>
                    <td className="px-4 py-2.5 sm:px-5">
                      <span
                        className={`${pill} ${guest.isActive ? tones.success : tones.neutral}`}
                      >
                        {guest.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-[#134687]/55">
            No students imported for this academic year.
          </p>
        )}
      </section>
    </div>
  );
}

function ImportField({
  label,
  name,
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  placeholder: string;
  inputMode?: "numeric";
}) {
  return (
    <label className="block min-w-0">
      <span className={fieldLabel}>{label}</span>
      <input
        name={name}
        required
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        className={input}
      />
    </label>
  );
}
