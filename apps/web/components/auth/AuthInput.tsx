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
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <input
        id={inputId}
        className={[
          "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition",
          "placeholder:text-slate-400",
          "focus:border-violet-400 focus:ring-4 focus:ring-violet-100",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
          className ?? "",
        ].join(" ")}
        {...props}
      />
    </div>
  );
}