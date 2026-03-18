import type { InputHTMLAttributes } from "react";

type AuthInputProps = {
  label: string;
} & InputHTMLAttributes<HTMLInputElement>;

export default function AuthInput({ label, className, ...props }: AuthInputProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200/80 ${className ?? ""}`}
        {...props}
      />
    </label>
  );
}
