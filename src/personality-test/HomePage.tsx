"use client";

// STEP 1: Import the .module.css file.
// The name 'styles' is a convention, but it can be anything.
import styles from "./quiz-styles.module.css";
import React from "react";
import Image from "next/image";
import { committeeImagePaths } from "./data/quizData";
import BackgroundIcons from "./BackgroundIcons";

// Define props type
interface HomePageProps {
  onStartQuiz: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onStartQuiz }) => {
  const leftCommittees = [
    "Academics",
    "Community Development",
    "Creatives & Technical",
    "Publicity",
    "External Affairs",
  ];
  const rightCommittees = [
    "Documentation",
    "Technology Development",
    "Finance",
    "Logistics",
    "Sports & Talent",
  ];

  const simplifyName = (name: string) => {
    if (name === "Creatives & Technical") return "Creatives";
    return name;
  };

  const CommitteeItem = ({ name }: { name: string }) => (
    // STEP 2: Use the styles object for all class names
    <div className={styles["committee-item"]}>
      <div className={styles["committee-circle"]}>
        <Image
          src={committeeImagePaths[name as keyof typeof committeeImagePaths]}
          alt={name}
          width={150}
          height={150}
        />
      </div>
      <p>{simplifyName(name)}</p>
    </div>
  );

  return (
    <>
      {/* The root class name here was incorrect in your original file, it should be homeContainer */}
      <div className={styles["home-container"]}>
        {/* For multiple classes, use a template literal */}
        <div className={`${styles["committee-column"]} ${styles.left}`}>
          {leftCommittees.map((name) => (
            <CommitteeItem key={name} name={name} />
          ))}
        </div>

        <div className={styles["home-central-content"]}>
          <Image
            src="https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/committee_test/Questions CSAR.png"
            alt="An illustration with a question mark, representing the quiz"
            className={styles["home-main-image"]}
            width={400}
            height={400}
          />
          <div className={styles["home-text-content"]}>
            <h1 className={styles["home-title"]}>
              Not Sure Which Committee You Belong To?
            </h1>
            <p className={styles["home-subtitle"]}>
              The best way to find your passion and skills is to get involved
              and try things out!
            </p>
            <button
              className={`${styles.btn} ${styles["btn-primary"]} ${styles["btn-find-out"]}`}
              onClick={onStartQuiz}
            >
              Find out my committee
            </button>
          </div>
        </div>

        <div className={`${styles["committee-column"]} ${styles.right}`}>
          {rightCommittees.map((name) => (
            <CommitteeItem key={name} name={name} />
          ))}
        </div>
      </div>
      <BackgroundIcons />
    </>
  );
};

export default HomePage;
