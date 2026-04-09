"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";

export default function SessionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          fetcher: swrFetcher,
          revalidateOnFocus: false,
          dedupingInterval: 5000,
          errorRetryCount: 2,
        }}
      >
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
