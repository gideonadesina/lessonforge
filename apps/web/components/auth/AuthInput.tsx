"use client";

import type { InputHTMLAttributes } from "react";

type AuthInputProps = {
  label: string;
} & InputHTMLAttributes<HTMLInputElement>;

export default function AuthInput({
  label,
  id,
  className,
  ...props
}: AuthInputProps) {
  const inputId =
    id || `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-[#475569]"
        style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
      >
        {label}
      </label>

      <input
        id={inputId}
        className={[
          "w-full rounded-[10px] border-[1.5px] border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#1E1B4B] outline-none transition-all duration-200",
          "placeholder:text-[#94A3B8]",
          "focus:border-[#534AB7] focus:ring-[3px] focus:ring-[rgba(83,74,183,0.15)]",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
          className ?? "",
        ].join(" ")}
        style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        {...props}
      />
    </div>
  );
}