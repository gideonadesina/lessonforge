"use client";

import { TeacherStatus } from "@/lib/principal/types";

const STATUS_STYLE: Record<TeacherStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  disabled: "bg-slate-100 text-slate-700 border-slate-200",
  removed: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function StatusPill({ status }: { status: TeacherStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}
