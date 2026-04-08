"use client";

// STEP 1: Correct the import to use the .module.css file
import styles from "./quiz-styles.module.css";
import React from "react";
import Image from "next/image";
import Link from "next/link";

// Define the types for the component's props
interface AppHeaderProps {
  page: "home" | "quiz";
  onTakeTest: () => void;
  onGoHome: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ page, onTakeTest }) => {
  const isHomePage = page === "home";

  const Logo = () => (
    <Image
      src="https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/logos/Logo_CSS Apply.svg"
      alt="CSS Apply Logo"
      // STEP 2: Use the styles object for class names
      className={styles["header-logo"]}
      width={150}
      height={50}
      priority
    />
  );

  return (
    <header className={styles["app-header"]}>
      {isHomePage ? (
        <Link
          href="/"
          className={styles["header-logo-button"]}
          aria-label="Go to Landing Page"
          title="Go to Landing Page"
        >
          <Logo />
        </Link>
      ) : (
        <Link
          href="/"
          className={styles["header-logo-button"]}
          aria-label="Go to Landing Page"
          title="Go to Landing Page"
        >
          <Logo />
        </Link>
      )}
      {isHomePage && (
        <div className={styles["header-actions"]}>
          {/* STEP 3: Use template literals for multiple class names */}
          <Link
            href="/#join-section"
            className={`${styles.btn} ${styles["btn-primary"]} ${styles["btn-join"]}`}
          >
            Join CSS
          </Link>
          <button
            className={`${styles.btn} ${styles["btn-secondary"]} ${styles["btn-take-test"]}`}
            onClick={onTakeTest}
          >
            Take Test
          </button>
        </div>
      )}
    </header>
  );
};

export default AppHeader;
