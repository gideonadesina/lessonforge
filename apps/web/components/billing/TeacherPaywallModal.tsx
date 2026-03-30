"use client";

import Link from "next/link";
import {
  LESSON_PACK_CREDIT_COST,
  NEW_USER_FREE_CREDITS,
  estimateLessonPacks,
} from "@/lib/billing/pricing";

type TeacherPaywallModalProps = {
  open: boolean;
  onClose: () => void;
  remainingCredits?: number | null;
  title?: string;
  description?: string;
};

export default function TeacherPaywallModal({
  open,
  onClose,
  remainingCredits = null,
  title = "You need more credits to generate this lesson pack",
  description = "You are close. Upgrade your plan to continue creating complete, classroom-ready lesson packs in seconds.",
}: TeacherPaywallModalProps) {
  if (!open) return null;

  const hasCreditsValue = typeof remainingCredits === "number";
  const remainingPacks = hasCreditsValue ? estimateLessonPacks(remainingCredits) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close paywall"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl rounded-3xl border border-violet-100 bg-[#FFFEFC] p-6 shadow-2xl">
        <div className="mb-4 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
          Teacher credits
        </div>

        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>

        <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {hasCreditsValue ? (
            <p>
              Remaining credits:{" "}
              <span className="font-bold text-slate-900">{remainingCredits}</span>
              {remainingPacks !== null ? (
                <span className="text-slate-500"> (about {remainingPacks} lesson packs)</span>
              ) : null}
            </p>
          ) : null}
          <p>
            1 Lesson Pack ={" "}
            <span className="font-bold text-violet-700">{LESSON_PACK_CREDIT_COST} credits</span>
          </p>
          <p className="text-slate-600">
            New users get {NEW_USER_FREE_CREDITS} free credits ({estimateLessonPacks(NEW_USER_FREE_CREDITS)}{" "}
            free lesson packs).
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Maybe later
          </button>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            View Pricing / Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}
