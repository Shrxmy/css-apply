"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useUserActivity } from "@/lib/useUserActivity";

interface UserActivityContextType {
  isActive: boolean;
  lastActivity: number;
  isIdle: boolean;
  refresh: () => void;
  markActive: () => void;
  isExcludedPage: boolean;
}

const UserActivityContext = createContext<UserActivityContextType | undefined>(
  undefined,
);

interface UserActivityProviderProps {
  children: ReactNode;
  enableReload?: boolean;
  idleTimeout?: number;
  reloadInterval?: number;
}

export function UserActivityProvider({
  children,
  enableReload = false,
  idleTimeout = 300000, // 5 minutes
  reloadInterval = 60000, // 1 minute
}: UserActivityProviderProps) {
  const activityState = useUserActivity({
    enableReload,
    idleTimeout,
    reloadInterval,
    excludedPages: [
      "/user/apply", // Application forms
      "/admin", // Admin pages
      "/personality-test", // Quiz pages
      "/auth", // Authentication pages
    ],
  });

  return (
    <UserActivityContext.Provider value={activityState}>
      {children}
    </UserActivityContext.Provider>
  );
}

export function useUserActivityContext(): UserActivityContextType {
  const context = useContext(UserActivityContext);
  if (context === undefined) {
    throw new Error(
      "useUserActivityContext must be used within a UserActivityProvider",
    );
  }
  return context;
}
