"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingScreen from "@/components/LoadingScreen";
import { toast } from "sonner";
import type { TechDevExamQuestion } from "@/data/techdev-exam";

interface ExamAttempt {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  answers: Record<string, string>;
  focusLossCount: number;
  totalAwayMilliseconds: number;
}

interface ExamPayload {
  eligible: boolean;
  durationMinutes?: number;
  questionCount?: number;
  sections?: string[];
  attempt?: {
    attempt: ExamAttempt;
    questions: TechDevExamQuestion[];
  } | null;
  error?: string;
}

export default function TechDevExamPage() {
  const { status } = useSession();
  const router = useRouter();
  const [payload, setPayload] = useState<ExamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const hiddenAt = useRef<number | null>(null);
  const awayCount = useRef(0);
  const awayMilliseconds = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialize full snapshots: an older request must never land after a newer one.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const loadExam = useCallback(async () => {
    try {
      const response = await fetch("/api/user/techdev-exam");
      const data = (await response.json()) as ExamPayload;
      if (!response.ok) throw new Error(data.error || "Exam unavailable");
      setPayload(data);
      if (data.attempt) {
        setAnswers(data.attempt.attempt.answers || {});
        setSubmitted(data.attempt.attempt.status === "SUBMITTED");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The TechDev examination could not be loaded",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/user");
      return;
    }
    if (status === "authenticated") void loadExam();
  }, [loadExam, router, status]);

  const attempt = payload?.attempt?.attempt;
  const questions = useMemo(
    () => payload?.attempt?.questions || [],
    [payload?.attempt?.questions],
  );
  const question = questions[currentIndex];
  const answer = question ? answers[question.id] || "" : "";
  const answeredCount = useMemo(
    () => questions.filter((item) => Boolean(answers[item.id]?.trim())).length,
    [answers, questions],
  );

  const sendHeartbeat = useCallback(async () => {
    if (!attempt || submitted) return;
    await fetch("/api/user/techdev-exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "heartbeat",
        focusLossCount: awayCount.current,
        totalAwayMilliseconds: awayMilliseconds.current,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [attempt, submitted]);

  // Continue from the server's counts after a reload; the server only accepts increases.
  useEffect(() => {
    if (!attempt) return;
    awayCount.current = Math.max(awayCount.current, attempt.focusLossCount);
    awayMilliseconds.current = Math.max(
      awayMilliseconds.current,
      attempt.totalAwayMilliseconds,
    );
  }, [attempt]);

  useEffect(() => {
    if (!attempt || submitted) return;
    const updateVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        awayCount.current += 1;
      } else if (hiddenAt.current) {
        awayMilliseconds.current += Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        void sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("blur", updateVisibility);
    window.addEventListener("focus", updateVisibility);
    const interval = window.setInterval(() => void sendHeartbeat(), 30_000);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("blur", updateVisibility);
      window.removeEventListener("focus", updateVisibility);
      window.clearInterval(interval);
    };
  }, [attempt, sendHeartbeat, submitted]);

  useEffect(() => {
    if (!attempt || submitted) return;
    const expiresAt = new Date(attempt.expiresAt).getTime();
    const updateTimer = () =>
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    updateTimer();
    const interval = window.setInterval(updateTimer, 1_000);
    return () => window.clearInterval(interval);
  }, [attempt, submitted]);

  const startExam = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/user/techdev-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = (await response.json()) as {
        attempt?: { attempt: ExamAttempt; questions: TechDevExamQuestion[] };
        error?: string;
      };
      if (!response.ok || !data.attempt)
        throw new Error(data.error || "Exam could not be started");
      setPayload((current) => ({
        ...current,
        eligible: true,
        attempt: data.attempt,
      }));
      setAnswers(data.attempt.attempt.answers || {});
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Exam could not be started",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateAnswer = (value: string) => {
    if (!question || submitted || saving || secondsLeft === 0) return;
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveQueue.current = saveQueue.current.then(async () => {
        const response = await fetch("/api/user/techdev-exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", answers: nextAnswers }),
        }).catch(() => null);
        setSaveState(response?.ok ? "saved" : "failed");
      });
    }, 500);
  };

  const submitExam = async () => {
    if (
      !window.confirm(
        "Submit your TechDev examination? You will not be able to edit it afterward.",
      )
    )
      return;
    setSaving(true);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      // Submission carries the latest answers, including the cancelled debounce.
      await saveQueue.current;
      const response = await fetch("/api/user/techdev-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", answers }),
      });
      const data = (await response.json()) as ExamPayload;
      if (!response.ok)
        throw new Error(data.error || "Exam could not be submitted");
      setPayload(data);
      setSubmitted(true);
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Exam could not be submitted",
      );
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading)
    return <LoadingScreen message="Loading TechDev examination" />;

  if (error || !payload?.eligible) {
    return (
      <div className="min-h-screen bg-[#F3F3FD]">
        <Header />
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="font-poppins text-xl font-bold text-[#134687]">
              TechDev Examination
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#134687]/70">
              {error ||
                payload?.error ||
                "The examination is not available yet."}
            </p>
            {error && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  void loadExam();
                }}
                className="mt-6 rounded-xl bg-[#134687] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f3a6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] focus-visible:ring-offset-2"
              >
                Try again
              </button>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-[#F3F3FD]">
        <Header />
        <main className="mx-auto max-w-2xl px-5 py-16">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <span className="rounded-full bg-[#E8F2FF] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#044FAF]">
              Technology Development
            </span>
            <h1 className="mt-4 font-poppins text-2xl font-bold text-[#134687]">
              TechDev Examination
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#134687]/70">
              This examination contains {payload.questionCount} questions
              {payload.sections?.length
                ? ` covering ${payload.sections.join(", ")}`
                : ""}
              . You have {payload.durationMinutes} minutes.
              Your answers are saved automatically.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#134687]/70">
              You will have one attempt. Leaving the exam tab is recorded as an
              activity signal for review, but it is not an automatic failure.
            </p>
            <button
              type="button"
              onClick={() => void startExam()}
              disabled={saving}
              className="mt-6 rounded-xl bg-[#134687] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Starting…" : "Start examination"}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (submitted || attempt.status === "SUBMITTED") {
    return (
      <div className="min-h-screen bg-[#F3F3FD]">
        <Header />
        <main className="mx-auto max-w-2xl px-5 py-20 text-center">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="font-poppins text-2xl font-bold text-[#134687]">
              Examination submitted
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#134687]/70">
              Your TechDev examination has been recorded. Results will be
              reviewed by the CSS Executive Board.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!question) return <LoadingScreen message="Loading TechDev examination" />;

  const minutes = Math.floor((secondsLeft || 0) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = ((secondsLeft || 0) % 60).toString().padStart(2, "0");

  return (
    <div className="min-h-screen bg-[#F3F3FD]">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="sticky top-0 z-10 -mx-4 mb-5 flex flex-wrap items-start justify-between gap-3 bg-[#F3F3FD] px-4 py-2 sm:-mx-6 sm:px-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#044FAF]">
              Technology Development
            </p>
            <h1 className="font-poppins text-2xl font-bold text-[#134687]">
              TechDev Examination
            </h1>
          </div>
          <div
            className={`rounded-xl px-4 py-2 font-mono text-lg font-bold ${secondsLeft !== null && secondsLeft < 300 ? "bg-red-100 text-red-700" : "bg-white text-[#044FAF]"}`}
          >
            {minutes}:{seconds}
          </div>
          <p
            role="status"
            aria-live="polite"
            className="w-full text-right text-xs text-[#134687]/70"
          >
            {secondsLeft === 0
              ? "Time is up. Your saved answers will be reviewed."
              : saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "All answers saved"
                  : saveState === "failed"
                    ? "Save failed. Check your connection; your next change will retry."
                    : ""}
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#134687]/50">
                Questions
              </span>
              <span className="font-mono text-xs text-[#044FAF]">
                {answeredCount}/{questions.length}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2">
              {questions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  title={item.section}
                  aria-label={`Question ${index + 1}: ${item.section}`}
                  aria-current={currentIndex === index ? "step" : undefined}
                  className={`flex h-10 items-center justify-center rounded-lg border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] ${currentIndex === index ? "border-[#044FAF] bg-[#044FAF] text-white" : answers[item.id]?.trim() ? "border-green-200 bg-green-50 text-green-700" : "border-[#005FD9]/15 text-[#134687]"}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </aside>
          <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-5 border-b border-[#005FD9]/10 pb-4">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#044FAF]">
                {question.section}
              </span>
              <p className="mt-1 font-poppins font-semibold text-[#134687]">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </div>
            <h2 className="mb-5 text-base font-semibold leading-relaxed text-[#134687]">
              {question.prompt}
            </h2>
            {question.code && (
              <pre className="mb-5 overflow-x-auto rounded-xl bg-[#0B1E3B] p-4 font-mono text-xs leading-relaxed text-blue-100">
                <code>{question.code}</code>
              </pre>
            )}
            {question.kind === "choice" ? (
              <fieldset
                disabled={saving || secondsLeft === 0}
                className="space-y-2.5"
              >
                <legend className="sr-only">{question.prompt}</legend>
                {question.options?.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${answer === option ? "border-[#044FAF] bg-[#F3F8FF] text-[#044FAF]" : "border-[#005FD9]/15 text-[#134687]"}`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={answer === option}
                      onChange={() => updateAnswer(option)}
                      className="mt-0.5 accent-[#044FAF] focus-visible:ring-2 focus-visible:ring-[#044FAF]"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <textarea
                value={answer}
                onChange={(event) => updateAnswer(event.target.value)}
                disabled={saving || secondsLeft === 0}
                aria-label={`Answer for question ${currentIndex + 1}`}
                rows={9}
                placeholder="Write your answer here…"
                className="w-full rounded-xl border border-[#005FD9]/20 bg-[#FBFCFF] p-4 font-mono text-sm text-[#134687] focus:border-[#044FAF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] disabled:opacity-60"
              />
            )}
            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-[#005FD9]/10 pt-4">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() =>
                  setCurrentIndex((index) => Math.max(0, index - 1))
                }
                className="rounded-lg border border-[#005FD9]/15 px-4 py-2 text-sm font-semibold text-[#134687] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] disabled:opacity-40"
              >
                Previous
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() =>
                    setCurrentIndex((index) =>
                      Math.min(questions.length - 1, index + 1),
                    )
                  }
                  className="rounded-lg border border-[#005FD9]/15 px-4 py-2 text-sm font-semibold text-[#134687] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] disabled:opacity-40"
                >
                  Next
                </button>
                {currentIndex === questions.length - 1 && (
                  <button
                    type="button"
                    onClick={() => void submitExam()}
                    disabled={saving || secondsLeft === 0}
                    className="rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    {saving ? "Submitting…" : "Submit examination"}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
