import LoadingSpinner from "@/components/LoadingSpinner";

interface FormProcessingOverlayProps {
  active: boolean;
  label: string;
}

export default function FormProcessingOverlay({
  active,
  label,
}: FormProcessingOverlayProps) {
  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="absolute inset-0 z-20 flex cursor-wait items-center justify-center rounded-[inherit] bg-gray-300/55 px-4"
    >
      <div className="flex items-center gap-3 rounded-lg border border-[#134687]/15 bg-white px-5 py-3 text-sm font-semibold text-[#134687] shadow-md">
        <LoadingSpinner label={label} size="sm" />
        <span>{label}</span>
      </div>
    </div>
  );
}
