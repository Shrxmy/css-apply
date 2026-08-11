"use client";

import type { ChangeEvent, MouseEvent } from "react";

interface DateOfBirthInputProps {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export default function DateOfBirthInput({
  value,
  onChange,
  className = "",
}: DateOfBirthInputProps) {
  const openPicker = (event: MouseEvent<HTMLInputElement>) => {
    try {
      event.currentTarget.showPicker();
    } catch {
      // Browsers without showPicker still use their native date-input behavior.
    }
  };

  return (
    <input
      type="date"
      name="dateOfBirth"
      value={value}
      onChange={onChange}
      onClick={openPicker}
      required
      aria-label="Date of Birth"
      className={`cursor-pointer touch-manipulation ${className}`}
    />
  );
}
