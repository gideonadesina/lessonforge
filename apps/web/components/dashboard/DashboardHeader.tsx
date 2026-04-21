"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";

type ProfileMeta = {
  full_name?: string | null;
  name?: string | null;
};

export default function DashboardHeader() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { creditsRemaining, planLabel } = useProfile();

  const [name, setName] = useState("Teacher");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      const meta = (user.user_metadata ?? {}) as ProfileMeta;

      const displayName =
        meta.full_name ||
        meta.name ||
        user.email?.split("@")[0] ||
        "Teacher";

      setName(displayName);
      setEmail(user.email ?? null);
    })();
  }, [supabase]);

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  const lessonsRemaining = Math.floor(creditsRemaining / 4);
  const isLowCredits = creditsRemaining <= 10;

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white px-6 py-6 shadow-sm bg-white dark:bg-[#0B1530] border-slate-200 dark:border-[#1A2847]">
      <div className="flex flex-col gap-6 xl:flex-row xl:gap-8">
        {/* LEFT SIDE: User info + Plan card */}
        <div className="flex-1 min-w-0">
          {/* Greeting + Name */}
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {getGreeting()}
          </div>

          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {name}
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Welcome to your teaching workspace. Plan faster, generate stronger
            lessons, and stay organized.
          </p>

          {/* Compact Plan + Usage Card */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:bg-[#101827] border-slate-200 dark:border-[#1A2847]">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Plan info */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Plan
                </div>
                <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                  {planLabel}
                </div>
                <Link
                  href="/settings"
                  className="mt-2 inline-flex text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                >
                  See plans →
                </Link>
              </div>

              {/* Right: Credits info */}
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1">
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {creditsRemaining}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    credits
                  </div>
                </div>

                {/* Thin progress bar */}
                <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-[#1A2847]">
                  <div
                    className={`h-full transition-all ${
                      isLowCredits ? "bg-amber-500" : "bg-violet-600"
                    }`}
                    style={{
                      width: `${Math.min((creditsRemaining / 100) * 100, 100)}%`,
                    }}
                  />
                </div>

                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  ~{lessonsRemaining} lesson packs
                </div>

                {isLowCredits && (
                  <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
                    Running low
                  </div>
                )}
              </div>
            </div>

            {/* CTA Link */}
            <Link
              href="/settings?tab=billing"
              className="mt-3 inline-flex text-xs font-semibold text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            >
              Upgrade for unlimited credits →
            </Link>
          </div>

          {/* Action buttons below card */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/generate"
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-700"
            >
              Generate Lesson
            </Link>

            <Link
              href="/library"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 border-slate-200 dark:border-[#1A2847] dark:bg-[#101827] dark:text-slate-300 bg-white dark:bg-[#0B1530]"
            >
              Open Library
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}