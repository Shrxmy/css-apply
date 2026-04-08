"use client";

// STEP 1: Correct the import to use the .module.css file
import styles from "./quiz-styles.module.css";
import React, { useState, useEffect } from "react";
import {
  questions,
  OPTIONS,
  TOTAL_PAGES,
  QUESTIONS_PER_PAGE,
} from "./data/quizData";
import { Answers } from "./types/quiz";
import ResultsPage from "./ResultsPage"; // This component will also need conversion

interface QuizAppProps {
  onGoHome: () => void;
}

const QuizApp: React.FC<QuizAppProps> = ({ onGoHome }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, showResults]);

  const handleAnswerChange = (questionId: number, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleReset = () => {
    setAnswers({});
    setCurrentPage(0);
    setShowResults(false);
  };

  const currentQuestions = questions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE,
  );

  const isPageComplete = currentQuestions.every(
    (q) => answers[q.id] !== undefined,
  );

  const handleNext = () => {
    if (currentPage < TOTAL_PAGES - 1) {
      setCurrentPage((prev) => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const progressPercent = showResults
    ? 100
    : (currentPage / (TOTAL_PAGES - 1)) * 100;
  const progressClass = (() => {
    const step = Math.round(progressPercent / 5) * 5; // nearest 5%
    const clamped = Math.max(0, Math.min(100, step));
    return `p${clamped}`; // matches CSS classes p0..p100
  })();

  const isQuestionAnswered = (id: number) => answers[id] !== undefined;
  let firstUnansweredFound = false;

  if (showResults) {
    // Remember to convert ResultsPage.tsx in the same way!
    return <ResultsPage answers={answers} onRetake={handleReset} />;
  }

  // STEP 2: Convert all class names to use the styles object
  return (
    <>
      <div className={styles["quiz-banner"]}>
        <div className={styles["quiz-header"]}>
          <h1>Committee Test</h1>
          <p>Find your perfect committee in CSS!</p>
        </div>
      </div>

      <div className={styles["progress-container"]}>
        <div className={styles["progress-bar"]}>
          <div
            className={`${styles["progress-bar-inner"]} ${styles[progressClass as keyof typeof styles]}`}
          ></div>
          <div
            className={`${styles["progress-bar-head"]} ${styles[progressClass as keyof typeof styles]}`}
          ></div>
        </div>
        <p className={styles["progress-text"]}>
          Page {currentPage + 1} of {TOTAL_PAGES}
        </p>
      </div>

      <div className={styles["questions-list"]}>
        {currentQuestions.map((q) => {
          const isAnswered = isQuestionAnswered(q.id);
          const isActive = !isAnswered && !firstUnansweredFound;
          if (isActive) {
            firstUnansweredFound = true;
          }

          // STEP 3: Handle dynamic class names with a template literal
          const questionWrapperClasses = [
            styles["question-wrapper"],
            isActive ? styles.active : "",
            isAnswered ? styles.answered : "",
          ].join(" ");

          return (
            <div key={q.id} className={questionWrapperClasses}>
              <h2 className={styles["question-text"]}>
                <span className={styles["question-number"]}>{q.id}.</span>
                {q.text}
              </h2>
              <div
                className={styles["answer-scale"]}
                role="radiogroup"
                aria-labelledby={`question-${q.id}`}
              >
                <span className={`${styles["scale-label"]} ${styles.agree}`}>
                  Agree
                </span>
                <div className={styles["scale-options"]}>
                  {OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={styles["scale-option"]}
                      data-value={opt.value}
                    >
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        value={opt.value}
                        checked={answers[q.id] === opt.value}
                        onChange={() => handleAnswerChange(q.id, opt.value)}
                      />
                      <span
                        className={styles["scale-circle"]}
                        aria-hidden="true"
                      ></span>
                    </label>
                  ))}
                </div>
                <span className={`${styles["scale-label"]} ${styles.disagree}`}>
                  Disagree
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles["navigation-buttons"]}>
        <button
          className={`${styles.btn} ${styles["btn-secondary"]}`}
          onClick={currentPage > 0 ? handleBack : onGoHome}
        >
          Back
        </button>
        <button
          className={`${styles.btn} ${styles["btn-primary"]}`}
          onClick={handleNext}
          disabled={!isPageComplete}
        >
          {currentPage === TOTAL_PAGES - 1 ? "See Results" : "Next"}
        </button>
      </div>
    </>
  );
};

export default QuizApp;
