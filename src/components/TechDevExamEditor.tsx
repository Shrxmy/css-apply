"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";

interface EditableQuestion {
  id: string;
  section: string;
  prompt: string;
  kind: "choice" | "code";
  code?: string;
  options?: string[];
  answer?: string;
}

interface ExamSetPayload {
  schoolYear: string;
  set: { durationMinutes: number; questions: EditableQuestion[] };
  isCustom: boolean;
  updatedAt: string | null;
  locked: boolean;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] focus-visible:ring-offset-2";
const inputClass = `w-full rounded-lg border border-[#005FD9]/15 bg-white px-3 py-2 text-sm text-[#134687] disabled:bg-[#F8FAFF] disabled:opacity-70 ${focusRing}`;
const smallButton = `rounded-lg border border-[#005FD9]/15 px-3 py-1.5 text-xs font-semibold text-[#134687] hover:bg-[#F3F8FF] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

function newQuestion(section: string): EditableQuestion {
  return {
    id: `q-${crypto.randomUUID()}`,
    section,
    prompt: "",
    kind: "choice",
    options: ["", ""],
    answer: "",
  };
}

// Send only the fields that belong to each question kind.
function toSavedQuestion(question: EditableQuestion): EditableQuestion {
  const base = {
    id: question.id,
    section: question.section,
    prompt: question.prompt,
    kind: question.kind,
    ...(question.code?.trim() ? { code: question.code } : {}),
  };
  return question.kind === "choice"
    ? {
        ...base,
        options: (question.options ?? []).map((option) => option.trim()),
        answer: question.answer?.trim(),
      }
    : base;
}

export default function TechDevExamEditor() {
  const [data, setData] = useState<ExamSetPayload | null>(null);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [duration, setDuration] = useState("45");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const apply = (payload: ExamSetPayload) => {
    setData(payload);
    setQuestions(payload.set.questions);
    setDuration(String(payload.set.durationMinutes));
    setDirty(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/techdev-exam/questions", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load exam questions");
      }
      apply(payload);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load exam questions",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (index: number, patch: Partial<EditableQuestion>) => {
    setQuestions((current) =>
      current.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    );
    setDirty(true);
  };

  const move = (index: number, offset: number) => {
    setQuestions((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
    setDirty(true);
  };

  const remove = (index: number) => {
    setQuestions((current) => current.filter((_, i) => i !== index));
    setDirty(true);
  };

  const add = () => {
    setQuestions((current) => [
      ...current,
      newQuestion(current.at(-1)?.section ?? ""),
    ]);
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/techdev-exam/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: data.updatedAt,
          set: {
            durationMinutes: Number(duration),
            questions: questions.map(toSavedQuestion),
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save exam questions");
      }
      apply(payload);
      toast.success(`Exam questions saved for AY ${payload.schoolYear}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save exam questions",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner label="Loading exam questions" size="md" />
      </div>
    );
  }
  if (loadError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-sm text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className={`rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3a6b] ${focusRing}`}
        >
          Retry
        </button>
      </div>
    );
  }

  const locked = data.locked;
  const disabled = locked || saving;
  const choiceCount = questions.filter((q) => q.kind === "choice").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg bg-[#F3F8FF] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-sm text-[#134687]">
          <p className="font-semibold">
            AY {data.schoolYear} · {questions.length} questions ({choiceCount}{" "}
            multiple choice, {questions.length - choiceCount} written)
          </p>
          <p className="mt-1 text-xs text-[#134687]/70">
            {locked
              ? "Applicants have started this exam, so its questions are locked for this A.Y."
              : data.isCustom
                ? `Last saved ${new Date(data.updatedAt ?? "").toLocaleString()}.`
                : "This A.Y. is using the default question bank. Edit and save to make it this A.Y.'s own set."}
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (!dirty || window.confirm("Discard your unsaved draft and reload the saved exam questions?")) {
              void load();
            }
          }}
          className={smallButton}
        >
          Reload saved questions
        </button>
        <label className="flex items-center gap-2 text-sm text-[#134687]">
          Duration (minutes)
          <input
            type="number"
            min={5}
            max={240}
            inputMode="numeric"
            value={duration}
            disabled={disabled}
            onChange={(event) => {
              setDuration(event.target.value);
              setDirty(true);
            }}
            className={`${inputClass} w-24`}
          />
        </label>
      </div>

      {questions.map((question, index) => (
        <fieldset
          key={question.id}
          disabled={disabled}
          className="rounded-lg border border-[#005FD9]/10 p-4"
        >
          <legend className="px-1 text-xs font-semibold text-[#044FAF]">
            Question {index + 1}
          </legend>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="text-xs font-semibold text-[#134687]">
              Topic
              <input
                value={question.section}
                maxLength={60}
                placeholder="e.g. JavaScript"
                onChange={(event) =>
                  update(index, { section: event.target.value })
                }
                className={`${inputClass} mt-1 font-normal`}
              />
            </label>
            <label className="text-xs font-semibold text-[#134687]">
              Type
              <select
                value={question.kind}
                onChange={(event) =>
                  update(
                    index,
                    event.target.value === "code"
                      ? { kind: "code", options: undefined, answer: undefined }
                      : { kind: "choice", options: ["", ""], answer: "" },
                  )
                }
                className={`${inputClass} mt-1 font-normal`}
              >
                <option value="choice">Multiple choice (auto-scored)</option>
                <option value="code">Written (0–5 points)</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold text-[#134687]">
            Question
            <textarea
              value={question.prompt}
              maxLength={2000}
              rows={2}
              onChange={(event) => update(index, { prompt: event.target.value })}
              className={`${inputClass} mt-1 font-normal`}
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-[#134687]">
            Code snippet (optional)
            <textarea
              value={question.code ?? ""}
              maxLength={5000}
              rows={3}
              onChange={(event) => update(index, { code: event.target.value })}
              className={`${inputClass} mt-1 font-mono font-normal`}
            />
          </label>

          {question.kind === "choice" && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-[#134687]">
                Choices — select the correct answer
              </p>
              {(question.options ?? []).map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`answer-${question.id}`}
                    aria-label={`Mark choice ${optionIndex + 1} as correct`}
                    checked={option !== "" && question.answer === option}
                    onChange={() => update(index, { answer: option })}
                    className="accent-[#044FAF]"
                  />
                  <input
                    value={option}
                    maxLength={500}
                    aria-label={`Choice ${optionIndex + 1}`}
                    onChange={(event) => {
                      const options = [...(question.options ?? [])];
                      options[optionIndex] = event.target.value;
                      update(index, {
                        options,
                        // Keep the answer pointing at the edited choice.
                        answer:
                          question.answer === option
                            ? event.target.value
                            : question.answer,
                      });
                    }}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    aria-label={`Remove choice ${optionIndex + 1}`}
                    disabled={(question.options?.length ?? 0) <= 2}
                    onClick={() =>
                      update(index, {
                        options: question.options?.filter(
                          (_, i) => i !== optionIndex,
                        ),
                        answer:
                          question.answer === option ? "" : question.answer,
                      })
                    }
                    className={smallButton}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={(question.options?.length ?? 0) >= 8}
                onClick={() =>
                  update(index, { options: [...(question.options ?? []), ""] })
                }
                className={smallButton}
              >
                Add choice
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#005FD9]/10 pt-3">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className={smallButton}
            >
              Move up
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === questions.length - 1}
              className={smallButton}
            >
              Move down
            </button>
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={questions.length <= 1}
              className={`${smallButton} text-red-700`}
            >
              Delete question
            </button>
          </div>
        </fieldset>
      ))}

      {!locked && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#005FD9]/10 bg-white/95 p-3 backdrop-blur">
          <button
            type="button"
            onClick={add}
            disabled={saving || questions.length >= 100}
            className={smallButton}
          >
            Add question
          </button>
          <div className="flex items-center gap-3">
            {dirty && (
              <span className="text-xs text-[#134687]/60">Unsaved changes</span>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || (!dirty && data.isCustom)}
              className={`rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3a6b] disabled:opacity-50 ${focusRing}`}
            >
              {saving ? "Saving…" : "Save questions"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
