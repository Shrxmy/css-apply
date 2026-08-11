interface LoadingSpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
} as const;

export default function LoadingSpinner({
  label = "Loading",
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`inline-flex shrink-0 animate-spin rounded-full border-[#2F7EE3] border-t-transparent motion-reduce:animate-none ${sizeClasses[size]} ${className}`}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
