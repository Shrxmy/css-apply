// Animation utility functions for consistent styling

export const getScrollAnimationClasses = (
  isVisible: boolean,
  direction: "left" | "right" | "up" | "down" = "up",
  baseClasses: string = "",
) => {
  const directionClasses = {
    left: isVisible
      ? "opacity-100 transform translate-x-0"
      : "opacity-0 transform -translate-x-12 sm:-translate-x-16",
    right: isVisible
      ? "opacity-100 transform translate-x-0"
      : "opacity-0 transform translate-x-12 sm:translate-x-16",
    up: isVisible
      ? "opacity-100 transform translate-y-0"
      : "opacity-0 transform translate-y-8 sm:translate-y-12",
    down: isVisible
      ? "opacity-100 transform translate-y-0"
      : "opacity-0 transform -translate-y-8 sm:-translate-y-12",
  };

  return `${baseClasses} transition-all duration-700 sm:duration-1000 ease-out will-change-transform ${directionClasses[direction]}`;
};

export const getScrollAnimationStyles = (
  isVisible: boolean,
  direction: "left" | "right" | "up" | "down" = "up",
  delay: string = "0s",
) => {
  const directionStyles = {
    left: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateX(0)" : "translateX(-48px)",
    },
    right: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateX(0)" : "translateX(48px)",
    },
    up: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(32px)",
    },
    down: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(-32px)",
    },
  };

  return {
    ...directionStyles[direction],
    transitionDelay: delay,
    willChange: "opacity, transform",
  };
};

export const getStaggeredAnimationStyles = (
  isVisible: boolean,
  index: number,
  baseDelay: number = 0.1,
) => {
  const delay = `${baseDelay + index * 0.1}s`;
  return {
    opacity: isVisible ? 1 : 0,
    transform: isVisible
      ? "scale(1) translateY(0)"
      : "scale(0.75) translateY(32px)",
    transitionDelay: delay,
    willChange: "opacity, transform",
  };
};

// Image carousel scroll animation
export const getImageScrollAnimationClasses = (
  duration: number = 20,
  direction: "left" | "right" = "left",
) => {
  return `animate-scroll-${direction} transition-transform duration-[${duration * 1000}ms] linear infinite`;
};

export const getImageScrollAnimationStyles = (
  duration: number = 20,
  direction: "left" | "right" = "left",
) => {
  return {
    animation: `scroll-${direction} ${duration}s linear infinite`,
    willChange: "transform",
  };
};
