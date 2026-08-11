import React from "react";
import styles from "./quiz-styles.module.css";

const bgIconIndices = Array.from({ length: 12 }, (_, i) => i);

const BackgroundIcons = () => {
  return (
    <div className={styles["background-icons"]} aria-hidden="true">
      {bgIconIndices.map((index) => (
        <div
          className={styles["icon-wrapper"]}
          key={`bg-icon-${index}`}
          style={{
            maskImage: `url(/icons/bg-icon-${index}.svg)`,
            WebkitMaskImage: `url(/icons/bg-icon-${index}.svg)`,
          }}
        />
      ))}
    </div>
  );
};

export default BackgroundIcons;
