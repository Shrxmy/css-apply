"use client";

// STEP 1: Correct the import to use the .module.css file
import styles from "./quiz-styles.module.css";
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import Image from "next/image";
import {
  committeeImagePaths,
  committeeFitReasons,
  committeeDescriptions,
} from "./data/quizData";
import { CommitteeName } from "./types/quiz";

interface CommitteeData {
  committee: CommitteeName;
  score: number;
}

interface ResultCardProps {
  committee: CommitteeData | undefined;
  isPrimary?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({
  committee,
  isPrimary = false,
}) => {
  const [view, setView] = useState<"fit" | "duties">("fit");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<HTMLDivElement | null>(null);
  const dutiesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setView("fit");
  }, [committee]);

  // Helper to update container height based on current view
  const updateHeight = () => {
    const active = view === "fit" ? fitRef.current : dutiesRef.current;
    if (!active) return;
    const next = active.getBoundingClientRect().height;
    if (bodyRef.current) {
      bodyRef.current.style.setProperty("--rc-body-h", `${next}px`);
    }
  };

  // Update height after mount and when view changes
  useLayoutEffect(() => {
    updateHeight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Update on window resize
  useEffect(() => {
    const onResize = () => updateHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  if (!committee) {
    return null;
  }

  const committeeName = committee.committee;

  // STEP 2: Convert all class names, handling static, dynamic, and conditional cases
  return (
    <div
      className={`${styles["result-card-container"]} ${isPrimary ? styles["is-primary"] : ""}`}
    >
      <div className={styles["result-card-header"]}>
        <div
          className={`${styles["result-image-wrapper"]} ${isPrimary ? styles["is-primary"] : ""}`}
        >
          <Image
            src={committeeImagePaths[committeeName]}
            alt={`${committeeName} committee illustration`}
            width={250}
            height={250}
          />
        </div>
        <div className={styles["result-title-wrapper"]}>
          {isPrimary && <h3>Your Primary Committee Fit is...</h3>}
          <h1
            className={
              isPrimary
                ? styles["result-title-main"]
                : styles["result-title-other"]
            }
          >
            {committeeName}
          </h1>
        </div>
      </div>
      <div
        ref={bodyRef}
        className={`${styles["result-card-body"]} ${isPrimary ? styles["is-primary"] : ""}`}
      >
        <div
          className={`${styles["result-card-slider"]} ${view === "fit" ? styles["show-fit"] : styles["show-duties"]}`}
        >
          <div ref={fitRef} className={styles["result-card-slide"]}>
            <p>{committeeFitReasons[committeeName]}</p>
          </div>
          <div
            ref={dutiesRef}
            className={`${styles["result-card-slide"]} ${styles["committee-duties"]}`}
          >
            <h4>Key Responsibilities:</h4>
            <ul>
              {committeeDescriptions[committeeName].map((duty, index) => (
                <li key={index}>{duty}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className={styles["result-card-nav"]}>
        <button
          onClick={() => setView("fit")}
          disabled={view === "fit"}
          aria-label="Show fit reason"
        >
          <span className={styles["nav-arrow"]} aria-label="Previous">
            &#60;
          </span>
        </button>
        <div className={styles["nav-dots"]}>
          <span
            className={`${styles["nav-dot"]} ${view === "fit" ? styles.active : ""}`}
          ></span>
          <span
            className={`${styles["nav-dot"]} ${view === "duties" ? styles.active : ""}`}
          ></span>
        </div>
        <button
          onClick={() => setView("duties")}
          disabled={view === "duties"}
          aria-label="Show key responsibilities"
        >
          <span className={styles["nav-arrow"]} aria-label="Next">
            &#62;
          </span>
        </button>
      </div>
    </div>
  );
};

export default ResultCard;
