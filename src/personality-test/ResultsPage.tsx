"use client";

import styles from "./quiz-styles.module.css";
import React, { useMemo, useEffect, useRef } from "react";
import { Answers, CommitteeName } from "./types/quiz";
import { COMMITTEES, questions, SCORE_MAP } from "./data/quizData";
import ResultCard from "./ResultCard";
import BackgroundIcons from "./BackgroundIcons";
import Link from "next/link";

interface ResultsPageProps {
  answers: Answers;
  attemptId: string;
  onRetake: () => void;
}

const ResultsPage: React.FC<ResultsPageProps> = ({
  answers,
  attemptId,
  onRetake,
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const quizData = useMemo(() => {
    // This calculation logic is purely client-side and is safe to keep.
    const rawScores: Record<CommitteeName, number> = COMMITTEES.reduce(
      (acc, c) => ({ ...acc, [c]: 0 }),
      {} as Record<CommitteeName, number>,
    );

    questions.forEach((q) => {
      const answerValue = answers[q.id];
      if (answerValue && SCORE_MAP[answerValue as keyof typeof SCORE_MAP]) {
        const points = SCORE_MAP[answerValue as keyof typeof SCORE_MAP];

        if (Array.isArray(q.dominant)) {
          q.dominant.forEach((c: string) => {
            rawScores[c as CommitteeName] += points.dominant;
          });
        } else {
          rawScores[q.dominant as CommitteeName] += points.dominant;
        }

        (q.average || []).forEach((c: string) => {
          rawScores[c as CommitteeName] += points.average;
        });
        (q.less || []).forEach((c: string) => {
          rawScores[c as CommitteeName] += points.less;
        });
      }
    });

    const sortedResults: { committee: CommitteeName; score: number }[] =
      Object.entries(rawScores)
        .map(([committee, score]) => ({
          committee: committee as CommitteeName,
          score: Number(score),
        }))
        .sort((a, b) => (b.score as number) - (a.score as number));

    return { rawScores, sortedResults };
  }, [answers]);

  // Submit results to Supabase once when results are computed
  const didSubmitRef = useRef(false);
  const submissionStorageKey = `css-apply-quiz-submission:${attemptId}`;
  useEffect(() => {
    const submitResults = async () => {
      const { rawScores, sortedResults } = quizData;

      // Prevent duplicate inserts from React Strict Mode remounts, route refreshes,
      // and fast repeated renders for the same quiz attempt.
      if (didSubmitRef.current) return;
      didSubmitRef.current = true;

      if (window.sessionStorage.getItem(submissionStorageKey)) return;
      window.sessionStorage.setItem(submissionStorageKey, "pending");
      if (!sortedResults || sortedResults.length < 3) {
        console.error("Not enough results to submit.");
        return;
      }

      try {
        const formatColumnName = (name: string) =>
          `score_${name.toLowerCase().replace(/ & /g, "_and_").replace(/ /g, "_")}`;

        const scoresForDb = Object.entries(rawScores).reduce(
          (acc, [committee, score]) => {
            acc[formatColumnName(committee)] = score as number;
            return acc;
          },
          {} as Record<string, number>,
        );

        const submissionData = {
          top_committee: sortedResults[0].committee,
          second_committee: sortedResults[1].committee,
          third_committee: sortedResults[2].committee,
          ...scoresForDb,
          idempotencyKey: attemptId,
        } as Record<string, unknown>;

        // Send to a server API that uses service role to bypass RLS safely
        const resp = await fetch("/api/quiz-submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submission: submissionData }),
        });
        if (!resp.ok) {
          const payload = await resp.json().catch(() => ({}));
          throw new Error(payload?.error || `API error (${resp.status})`);
        }
        window.sessionStorage.setItem(submissionStorageKey, "submitted");
      } catch (error: unknown) {
        window.sessionStorage.removeItem(submissionStorageKey);

        const errObj = (error as { name?: string; message?: string }) || {};
        const name = errObj.name ?? "";
        const message: string = errObj.message ?? String(error);
        const msgLower = message.toLowerCase();
        // Treat typical dev-only interruptions as benign
        const isBenign =
          name === "TypeError" ||
          name === "AbortError" ||
          msgLower.includes("failed to fetch") ||
          msgLower.includes("abort") ||
          msgLower.includes("network");

        if (isBenign) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "Supabase request likely interrupted during dev (insert may have succeeded):",
              message,
            );
          }
          return;
        }
        console.error("Error submitting quiz results to Supabase:", message);
      }
    };

    submitResults();
  }, [quizData, attemptId, submissionStorageKey]);

  const { sortedResults } = quizData;
  const [topResult, secondResult, thirdResult] = sortedResults;

  if (!topResult) {
    return (
      <div className={styles["results-container"]}>
        <h2>Calculating your results...</h2>
      </div>
    );
  }

  return (
    <>
      <div className={styles["results-container"]}>
        <h2>Your Results Are In!</h2>

        <ResultCard committee={topResult} isPrimary={true} />

        <h4>Other Committees You Might Enjoy</h4>
        <div className={styles["other-results-grid"]}>
          <ResultCard committee={secondResult} />
          <ResultCard committee={thirdResult} />
        </div>

        <div className={styles["results-actions"]}>
          <Link
            href="/#join-section"
            className={`${styles.btn} ${styles["btn-primary"]}`}
          >
            Join CSS
          </Link>
          <button
            className={`${styles.btn} ${styles["btn-secondary"]}`}
            onClick={onRetake}
          >
            Retake the Test
          </button>
        </div>
      </div>
      <BackgroundIcons />
    </>
  );
};

export default ResultsPage;
