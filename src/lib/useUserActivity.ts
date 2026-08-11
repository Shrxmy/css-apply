import { useState, useEffect, useCallback, useRef } from "react";

interface UserActivityState {
  isActive: boolean;
  lastActivity: number;
  isIdle: boolean;
}

interface UseUserActivityOptions {
  idleTimeout?: number; // milliseconds before considered idle
  activityEvents?: string[]; // events to track for activity
  enableReload?: boolean; // whether to enable automatic reloading
  reloadInterval?: number; // milliseconds between reloads when idle
  excludedPages?: string[]; // pages that should never auto-reload
}

export function useUserActivity(options: UseUserActivityOptions = {}) {
  const {
    idleTimeout = 300000, // 5 minutes default
    activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ],
    enableReload = false,
    reloadInterval = 60000, // 1 minute default
    excludedPages = ["/user/apply", "/admin", "/personality-test"],
  } = options;

  const [activityState, setActivityState] = useState<UserActivityState>({
    isActive: false,
    lastActivity: Date.now(),
    isIdle: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isExcludedPage = useRef<boolean>(false);
  const lastUpdateTime = useRef<number>(0);

  // Check if current page should be excluded from auto-reload
  const checkExcludedPage = useCallback(() => {
    const currentPath = window.location.pathname;
    isExcludedPage.current = excludedPages.some((excludedPath) =>
      currentPath.startsWith(excludedPath),
    );
  }, [excludedPages]);

  // Update activity state - use ref to avoid dependency issues
  const updateActivityRef = useRef<(() => void) | undefined>(undefined);

  const updateActivity = useCallback(() => {
    updateActivityRef.current?.();
  }, []);

  // Start reload timer for idle users - use ref to avoid dependency issues
  const startReloadTimerRef = useRef<(() => void) | undefined>(undefined);

  // Handle page visibility change - use ref to avoid dependency issues
  const handleVisibilityChangeRef = useRef<(() => void) | undefined>(undefined);

  // Initialize the refs immediately to avoid race conditions
  updateActivityRef.current = () => {
    const now = Date.now();

    // Throttle updates to prevent excessive re-renders (max once per 500ms)
    if (now - lastUpdateTime.current < 500) {
      return;
    }
    lastUpdateTime.current = now;

    setActivityState((prev) => {
      // Only update if there's actually a change (avoid unnecessary re-renders)
      if (prev.isActive && !prev.isIdle) {
        return {
          ...prev,
          lastActivity: now,
        };
      }
      return {
        isActive: true,
        lastActivity: now,
        isIdle: false,
      };
    });

    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    // Start idle timeout
    timeoutRef.current = setTimeout(() => {
      setActivityState((prev) => ({
        ...prev,
        isIdle: true,
      }));

      // Start reload timer if enabled
      if (enableReload && !isExcludedPage.current) {
        startReloadTimerRef.current?.();
      }
    }, idleTimeout);
  };

  // Set up event listeners - single effect with no dependencies
  useEffect(() => {
    // Initial setup
    const initializeActivity = () => {
      checkExcludedPage();

      // Use the ref-based update to avoid infinite loops
      updateActivityRef.current?.();
    };

    initializeActivity();

    // Create stable event handlers
    const handleActivityEvent = () => {
      updateActivityRef.current?.();
    };

    const handleVisibilityChangeEvent = () => {
      handleVisibilityChangeRef.current?.();
    };

    const handleRouteChange = () => {
      checkExcludedPage();
      // If moving to excluded page, clear reload timer
      if (isExcludedPage.current && reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };

    // Add event listeners for user activity
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivityEvent, { passive: true });
    });

    // Listen for page visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChangeEvent);

    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      // Cleanup event listeners
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivityEvent);
      });
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChangeEvent,
      );
      window.removeEventListener("popstate", handleRouteChange);

      // Clear timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, [activityEvents, checkExcludedPage]); // Include dependencies used in the effect

  // Update refs when options change
  useEffect(() => {
    // Silent ref updates - no logging in production

    // Update the ref functions with latest values (updateActivityRef is already initialized above)

    startReloadTimerRef.current = () => {
      if (!enableReload || isExcludedPage.current) return;

      reloadTimeoutRef.current = setTimeout(() => {
        // Check if still idle before reloading
        setActivityState((prev) => {
          if (prev.isIdle && Date.now() - prev.lastActivity > idleTimeout) {
            // Check if auto-reload is disabled for this page
            if (window.__DISABLE_AUTO_RELOAD__) {
              if (process.env.NODE_ENV === "development") {
              }
              return prev;
            }

            // Silent reload - no console logs in production
            if (process.env.NODE_ENV === "development") {
            }
            window.location.reload();
          }
          return prev;
        });
      }, reloadInterval);
    };

    handleVisibilityChangeRef.current = () => {
      if (document.hidden) {
        // Page is hidden, don't reload
        if (reloadTimeoutRef.current) {
          clearTimeout(reloadTimeoutRef.current);
        }
      } else {
        // Page is visible again, check if we should resume reload timer
        if (activityState.isIdle && enableReload && !isExcludedPage.current) {
          startReloadTimerRef.current?.();
        }
      }
    };
  }, [
    idleTimeout,
    enableReload,
    reloadInterval,
    activityState.isIdle,
    activityEvents,
    checkExcludedPage,
  ]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (!isExcludedPage.current) {
      window.location.reload();
    }
  }, []);

  // Force activity update (useful for programmatic activity)
  const markActive = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  return {
    ...activityState,
    refresh,
    markActive,
    isExcludedPage: isExcludedPage.current,
  };
}
