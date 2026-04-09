import { useEffect } from "react";
import { useUserActivityContext } from "@/contexts/UserActivityContext";

// Extend Window interface to include our custom property
declare global {
  interface Window {
    __DISABLE_AUTO_RELOAD__?: boolean;
  }
}

interface UsePageReloadOptions {
  disableReload?: boolean;
  customIdleTimeout?: number;
  customReloadInterval?: number;
}

/**
 * Hook to control page reload behavior on specific pages
 * Use this in pages where you want to disable auto-reload or customize timing
 */
export function usePageReload(options: UsePageReloadOptions = {}) {
  const { disableReload = false } = options;
  const { markActive } = useUserActivityContext();

  useEffect(() => {
    if (disableReload) {
      // Mark as active to prevent idle detection and reload
      markActive();

      // Set a flag to prevent auto-reload on this page
      // This is a safer approach than trying to override window.location.reload
      window.__DISABLE_AUTO_RELOAD__ = true;
    }

    return () => {
      // Clear the flag when component unmounts
      if (disableReload) {
        window.__DISABLE_AUTO_RELOAD__ = false;
      }
    };
  }, [disableReload, markActive]);

  return {
    disableReload,
    markActive,
  };
}
