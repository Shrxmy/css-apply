// Shared admin UI class tokens (first defined by the Email Composer).
export const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#044FAF] focus-visible:ring-offset-2";
export const button = `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
export const secondary = `${button} border border-[#005FD9]/20 bg-white text-[#134687] hover:bg-[#F3F8FF]`;
export const primary = `${button} bg-[#134687] px-4 py-2 text-white hover:bg-[#0F376B]`;
export const danger = `${button} border border-red-200 bg-white text-red-700 hover:bg-red-50`;
export const input = `w-full min-w-0 rounded-lg border border-[#005FD9]/15 bg-white px-3 py-2 text-sm text-[#134687] placeholder:text-[#134687]/40 disabled:bg-[#F8FAFF] disabled:opacity-70 ${focus}`;
export const checkbox = `h-4 w-4 shrink-0 accent-[#134687] ${focus}`;
export const card =
  "min-w-0 overflow-hidden rounded-2xl border border-[#005FD9]/10 bg-white";
export const cardHeader =
  "flex flex-wrap items-center justify-between gap-2 border-b border-[#005FD9]/10 px-4 py-3 sm:px-5";
export const fieldLabel = "mb-1 block text-xs font-semibold text-[#134687]/80";
export const hint = "text-xs leading-relaxed text-[#134687]/60";

// Small status pills, in the same muted tones the Email Composer uses.
export const pill =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
export const tones = {
  success: "bg-green-50 text-green-800",
  danger: "bg-red-50 text-red-700",
  warning: "bg-[#FFF8E7] text-[#8A5A00]",
  info: "bg-[#E8F2FF] text-[#044FAF]",
  neutral: "bg-[#F3F3FD] text-[#134687]/75",
} as const;
