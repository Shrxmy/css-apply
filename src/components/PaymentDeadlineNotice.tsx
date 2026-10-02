"use client";

type PaymentDeadlineNoticeProps = {
  deadline: string | null;
  deadlinePassed: boolean;
  paymentsClosed: boolean;
};

function formatDeadline(deadline: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(deadline));
}

export default function PaymentDeadlineNotice({
  deadline,
  deadlinePassed,
  paymentsClosed,
}: PaymentDeadlineNoticeProps) {
  if (!deadline && !paymentsClosed) return null;

  const message = paymentsClosed
    ? "Payment submissions are closed. Please contact CSS if you need assistance."
    : deadlinePassed
      ? "The deadline has passed. Receipt submissions are still open, but outstanding payments will be marked late until CSS closes payments."
      : "Please submit your acknowledgement receipt by the deadline below.";

  return (
    <div
      className={`mb-4 rounded-lg border p-3 text-center text-sm ${
        paymentsClosed || deadlinePassed
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-[#005FD9]/20 bg-[#E8F2FF] text-[#134687]"
      }`}
      role="status"
    >
      {deadline && (
        <p className="font-semibold">
          Payment deadline: {formatDeadline(deadline)} Philippine Time
        </p>
      )}
      <p className={deadline ? "mt-1" : "font-semibold"}>{message}</p>
    </div>
  );
}
