"use client";

import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";

export type PlanningReminderType =
  | "no_topic"
  | "class_starting_soon"
  | "no_timetable"
  | "none";

type CompactPlanningReminderProps = {
  type: PlanningReminderType;
  message: string;
  onDismiss?: () => void;
};

export default function CompactPlanningReminder({
  type,
  message,
  onDismiss,
}: CompactPlanningReminderProps) {
  if (type === "none") return null;

  const isDark = type === "class_starting_soon";
  const bgClass = isDark
    ? "border-rose-200 bg-rose-50"
    : "border-amber-200 bg-amber-50";
  const textClass = isDark ? "text-rose-800" : "text-amber-800";
  const iconClass = isDark ? "text-rose-600" : "text-amber-600";

  return (
    <div className={`rounded-xl border ${bgClass} p-3 shadow-sm`}>
      <div className="flex gap-3">
        <AlertCircle className={`h-4 w-4 shrink-0 ${iconClass} mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${textClass}`}>{message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`text-xs font-medium ${textClass} hover:underline`}
            >
              Dismiss
            </button>
          )}
          <Link
            href="/planning"
            className={`inline-flex items-center gap-1 text-xs font-semibold ${textClass} hover:underline`}
          >
            View <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
