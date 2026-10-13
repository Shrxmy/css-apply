"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";
import LoadingSpinner from "@/components/LoadingSpinner";
import AdminEmptyState from "@/components/AdminEmptyState";
import TechDevExamEditor from "@/components/TechDevExamEditor";

interface ReviewQuestion {
  id: string;
  section: string;
  prompt: string;
  kind: "choice" | "code";
  code?: string;
  answer: string;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  manualScore: number | null;
}

interface ExamReview {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  startedAt: string;
  submittedAt: string | null;
  focusLossCount: number;
  totalAwayMilliseconds: number;
  reviewedAt: string | null;
  updatedAt: string;
  user: {
    name: string;
    email: string;
    studentNumber: string | null;
    section: string | null;
  };
  score: {
    choiceCorrect: number;
    choiceTotal: number;
    writtenPoints: number;
    writtenMax: number;
    writtenGraded: number;
    writtenTotal: number;
    total: number;
    max: number;
  };
  questions: ReviewQuestion[];
}

const statusLabels: Record<ExamReview["status"], string> = {
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  EXPIRED: "Time expired",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] focus-visible:ring-offset-2";

export default function TechDevExamReviewPage() {
  const { status: sessionStatus } = useSession();
  const [attempts, setAttempts] = useState<ExamReview[]>([]);
  const [schoolYear, setSchoolYear] = useState("");
  const [maxPoints, setMaxPoints] = useState(5);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [view, setView] = useState<"results" | "questions">("results");

  const fetchAttempts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/techdev-exam", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load TechDev exam results");
      }
      setAttempts(Array.isArray(data.attempts) ? data.attempts : []);
      setOpenId(null);
      setDraftScores({});
      setSchoolYear(data.schoolYear || "");
      setMaxPoints(data.writtenMaxPoints || 5);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load TechDev exam results",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus !== "loading") void fetchAttempts();
  }, [fetchAttempts, sessionStatus]);

  const toggleAttempt = (attempt: ExamReview) => {
    if (openId === attempt.id) {
      setOpenId(null);
      return;
    }
    setOpenId(attempt.id);
    setDraftScores(
      Object.fromEntries(
        attempt.questions
          .filter((question) => question.kind === "code")
          .map((question) => [
            question.id,
            question.manualScore?.toString() ?? "",
          ]),
      ),
    );
  };

  const saveScores = async (attempt: ExamReview) => {
    const scores: Record<string, number | null> = {};
    for (const [questionId, value] of Object.entries(draftScores)) {
      // An emptied input clears that question's saved score.
      if (value.trim() === "") {
        scores[questionId] = null;
        continue;
      }
      const points = Number(value);
      if (!Number.isInteger(points) || points < 0 || points > maxPoints) {
        toast.error(`Scores must be whole numbers from 0 to ${maxPoints}`);
        return;
      }
      scores[questionId] = points;
    }

    setSavingId(attempt.id);
    try {
      const response = await fetch("/api/admin/techdev-exam", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          expectedUpdatedAt: attempt.updatedAt,
          scores,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) void fetchAttempts();
        throw new Error(data.error || "Failed to save scores");
      }
      setAttempts((current) =>
        current.map((item) => (item.id === attempt.id ? data.attempt : item)),
      );
      toast.success("Scores saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save scores",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-repeat">
      <MobileSidebar>
        <SidebarContent activePage="techdev-exam" />
      </MobileSidebar>

      <main className="h-screen flex-1 overflow-y-auto p-6 pt-16 md:p-8 md:pt-12">
        <header className="mb-8 mt-12 text-center md:mt-8 md:text-left">
          <div className="mb-4 w-fit max-w-full rounded-[45px] px-6 py-2 text-center text-lg font-poppins font-medium text-white [background:linear-gradient(90deg,_#2F7EE3_0%,_#0349A2_100%)] lg:py-4 lg:text-4xl">
            TechDev Exam
          </div>
          <p className="mb-4 text-xs font-light leading-5 text-black md:mb-6 lg:text-lg">
            {view === "results"
              ? `Review TechDev examinations for AY ${schoolYear || "—"}. Multiple choice is scored automatically; give each written answer 0–${maxPoints} points.`
              : "Each A.Y. has its own question set. Questions lock once the first applicant starts the exam."}
          </p>
          <hr className="border-[#005FD9]" />
        </header>

        <div
          role="tablist"
          aria-label="TechDev exam views"
          className="mb-4 flex gap-2"
        >
          {(
            [
              ["results", "Results"],
              ["questions", "Questions"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${focusRing} ${
                view === key
                  ? "bg-[#134687] text-white"
                  : "border border-[#005FD9]/15 bg-white text-[#134687] hover:bg-[#F3F8FF]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="mb-5 min-h-[calc(100vh-180px)] rounded-xl border border-[#005FD9]/10 bg-white p-5 md:min-h-[calc(100vh-280px)]">
          {/* Stays mounted so switching tabs keeps unsaved edits. */}
          <div hidden={view !== "questions"}>
            <TechDevExamEditor />
          </div>
          {view !== "results" ? null : loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner label="Loading exam results" size="md" />
              <p className="mt-3 text-sm text-[#134687]/60">
                Loading exam results...
              </p>
            </div>
          ) : loadError ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-sm text-red-700">{loadError}</p>
              <button
                type="button"
                onClick={() => void fetchAttempts()}
                className={`rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3a6b] ${focusRing}`}
              >
                Retry
              </button>
            </div>
          ) : attempts.length === 0 ? (
            <AdminEmptyState
              title="No TechDev examinations yet"
              description="Attempts appear here once applicants who finished their interview start the exam."
            />
          ) : (
            <div className="space-y-3">
              {attempts.map((attempt) => {
                const isOpen = openId === attempt.id;
                const canGrade = attempt.status !== "IN_PROGRESS";
                const awayMinutes = Math.round(
                  attempt.totalAwayMilliseconds / 60_000,
                );
                return (
                  <article
                    key={attempt.id}
                    className="rounded-lg border border-[#005FD9]/10 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => toggleAttempt(attempt)}
                      aria-expanded={isOpen}
                      className={`flex w-full flex-col gap-2 rounded-lg text-left lg:flex-row lg:items-center lg:justify-between ${focusRing}`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-semibold text-[#134687]">
                            {attempt.user.name}
                          </h2>
                          <span className="rounded-full bg-[#044FAF]/10 px-2 py-0.5 text-xs font-semibold text-[#044FAF]">
                            {statusLabels[attempt.status]}
                          </span>
                        </div>
                        <p className="break-all text-xs text-[#134687]/60 font-mono">
                          {attempt.user.studentNumber || "No student number"} ·{" "}
                          {attempt.user.section || "No section"} ·{" "}
                          {attempt.user.email}
                        </p>
                        <p className="text-xs text-[#134687]/60">
                          Left the exam tab {attempt.focusLossCount} time
                          {attempt.focusLossCount === 1 ? "" : "s"} · about{" "}
                          {awayMinutes} min away
                        </p>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="font-poppins text-lg font-bold text-[#134687]">
                          {attempt.score.total} / {attempt.score.max}
                        </p>
                        <p className="text-xs text-[#134687]/60">
                          Choice {attempt.score.choiceCorrect}/
                          {attempt.score.choiceTotal} · Written{" "}
                          {attempt.score.writtenGraded}/
                          {attempt.score.writtenTotal} graded
                        </p>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-4 space-y-3 border-t border-[#005FD9]/10 pt-4">
                        {!canGrade && (
                          <p className="rounded-lg bg-[#F3F8FF] p-3 text-sm text-[#134687]">
                            This applicant is still taking the exam. Scores can
                            be entered once it is submitted or time runs out.
                          </p>
                        )}
                        {attempt.questions.map((question, index) => (
                          <div
                            key={question.id}
                            className="rounded-lg bg-[#F3F8FF] p-3"
                          >
                            <p className="text-xs font-semibold text-[#044FAF]">
                              {index + 1}. {question.section}
                            </p>
                            <p className="mt-1 text-sm font-medium text-[#134687]">
                              {question.prompt}
                            </p>
                            {question.code && (
                              <pre className="mt-2 overflow-x-auto rounded-lg bg-[#0B1E3B] p-3 font-mono text-xs text-blue-100">
                                <code>{question.code}</code>
                              </pre>
                            )}
                            {question.kind === "choice" ? (
                              <div className="mt-2 text-sm text-[#134687]">
                                <p>
                                  Answer:{" "}
                                  {question.answer || <em>No answer</em>}{" "}
                                  <span
                                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      question.isCorrect
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {question.isCorrect
                                      ? "Correct"
                                      : "Incorrect"}
                                  </span>
                                </p>
                                {!question.isCorrect && (
                                  <p className="mt-1 text-xs text-[#134687]/70">
                                    Correct answer: {question.correctAnswer}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 space-y-2">
                                <pre className="whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs text-[#134687]">
                                  {question.answer || "No answer"}
                                </pre>
                                <label className="flex items-center gap-2 text-sm text-[#134687]">
                                  Points (0–{maxPoints})
                                  <input
                                    type="number"
                                    min={0}
                                    max={maxPoints}
                                    step={1}
                                    inputMode="numeric"
                                    disabled={
                                      !canGrade || savingId === attempt.id
                                    }
                                    value={draftScores[question.id] ?? ""}
                                    onChange={(event) =>
                                      setDraftScores((current) => ({
                                        ...current,
                                        [question.id]: event.target.value,
                                      }))
                                    }
                                    className={`w-20 rounded-lg border border-[#005FD9]/15 bg-white px-2 py-1 text-sm disabled:opacity-60 ${focusRing}`}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                        {canGrade && (
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            {attempt.reviewedAt && (
                              <p className="text-xs text-[#134687]/60">
                                Last scored{" "}
                                {new Date(attempt.reviewedAt).toLocaleString()}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => void saveScores(attempt)}
                              disabled={savingId === attempt.id}
                              className={`rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3a6b] disabled:opacity-50 ${focusRing}`}
                            >
                              {savingId === attempt.id
                                ? "Saving…"
                                : "Save scores"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
