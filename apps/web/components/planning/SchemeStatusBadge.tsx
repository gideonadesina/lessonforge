import type { SchemeStatus } from "@/lib/planning/types";
import { formatSchemeStatus } from "@/lib/planning/utils";

export default function SchemeStatusBadge({ status }: { status: SchemeStatus }) {
  const style =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "in_progress"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {formatSchemeStatus(status)}
    </span>
  );
}