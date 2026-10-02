"use client";

import useSWR from "swr";

export interface PaymentDeadlineData {
  cycle: { id: string; schoolYear: string } | null;
  deadline: string | null;
  closed: boolean;
  deadlinePassed: boolean;
}

async function fetchPaymentDeadline(url: string): Promise<PaymentDeadlineData> {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load payment deadline");
  return response.json();
}

export function usePaymentDeadline() {
  const { data, error, isLoading } = useSWR<PaymentDeadlineData>(
    "/api/payment-deadline",
    fetchPaymentDeadline,
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  return {
    deadline: data?.deadline ?? null,
    deadlinePassed: data?.deadlinePassed ?? false,
    paymentsClosed: data?.closed ?? false,
    isLoading,
    error,
  };
}
