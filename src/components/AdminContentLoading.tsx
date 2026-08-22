import LoadingSpinner from "@/components/LoadingSpinner";

interface AdminContentLoadingProps {
  description: string;
}

export default function AdminContentLoading({
  description,
}: AdminContentLoadingProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 px-3 text-center text-sm text-[#134687]">
      <LoadingSpinner label={description} size="lg" />
      <p>{description}</p>
    </div>
  );
}
