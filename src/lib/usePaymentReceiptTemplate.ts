import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";

interface PaymentReceiptTemplateResponse {
  url: string;
}

export function usePaymentReceiptTemplate() {
  const { data, error, isLoading, mutate } = useSWR<PaymentReceiptTemplateResponse>(
    "/api/payment-receipt-template",
    (url: string) => swrFetcher(url) as Promise<PaymentReceiptTemplateResponse>,
  );

  return {
    receiptTemplateUrl: data?.url?.trim() || "",
    error,
    isLoading,
    mutate,
  };
}
