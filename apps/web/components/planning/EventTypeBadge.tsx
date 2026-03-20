import type { AcademicEventType } from "@/lib/planning/types";
import { formatEventType } from "@/lib/planning/utils";

export default function EventTypeBadge({ type }: { type: AcademicEventType }) {
  const style =
    type === "exam" || type === "deadline"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : type === "holiday"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : type === "resumption"
          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {formatEventType(type)}
    </span>
  );
}