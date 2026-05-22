import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";

interface PaymentQrResponse {
  url: string;
}

export function usePaymentQr() {
  const { data, error, isLoading, mutate } = useSWR<PaymentQrResponse>(
    "/api/payment-qr",
    (url: string) => swrFetcher(url) as Promise<PaymentQrResponse>,
  );

  return {
    paymentQrUrl: data?.url?.trim() || "",
    error,
    isLoading,
    mutate,
  };
}
