// main-app/src/app/personality-test/page.tsx
"use client";

// STEP 1: Correct the import to use the .module.css file.
// We use the '@/' alias to point to the correct location from the src root.
import styles from "@/personality-test/quiz-styles.module.css";
import React, { useState } from "react";

// Component imports are correct based on your new structure
import AppHeader from "@/personality-test/AppHeader";
import HomePage from "@/personality-test/HomePage";
import QuizApp from "@/personality-test/QuizApp";
import Footer from "@/components/Footer";

type Page = "home" | "quiz";

export default function PersonalityTestPage() {
  const [page, setPage] = useState<Page>("home");

  const handleStartQuiz = () => setPage("quiz");
  const handleGoHome = () => setPage("home");

  return (
    <div className={styles["pt-theme"]}>
      <AppHeader
        page={page}
        onTakeTest={handleStartQuiz}
        onGoHome={handleGoHome}
      />
      {/* Main content area for the personality test route */}
      <section
        role="main"
        className={`${styles["app-container"]} ${page === "home" ? styles["home-main-container"] : ""}`}
      >
        {page === "home" ? (
          <>
            <HomePage onStartQuiz={handleStartQuiz} />
            {/* BackgroundIcons is now correctly placed inside the 'home' condition */}
          </>
        ) : (
          <QuizApp onGoHome={handleGoHome} />
        )}
      </section>
      <Footer />
    </div>
  );
}
