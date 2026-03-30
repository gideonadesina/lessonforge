"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";
import { LESSON_PACK_CREDIT_COST } from "@/lib/billing/pricing";

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

  const initial = name.charAt(0).toUpperCase();

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">
            {getGreeting()}
          </div>

          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {name} <span className="align-middle">👋</span>
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Welcome to your teaching workspace. Plan faster, generate stronger
            lessons, and stay organized across your school workflow.
          </p>

          {email ? (
            <div className="mt-3 text-xs font-medium text-slate-500">
              Signed in as{" "}
              <span className="font-semibold text-slate-700">{email}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 xl:min-w-[380px] xl:max-w-[420px]">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Credits
              </div>
              <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                {creditsRemaining}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Available for generation
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                Current Plan
              </div>
              <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                {planLabel}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Manage from settings
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/generate"
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              Generate Lesson
            </Link>

            <Link
              href="/library"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Open Library
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              Upgrade
            </Link>

            <div className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-md">
              {initial}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            1 lesson pack uses {LESSON_PACK_CREDIT_COST} credits.
          </p>
        </div>
      </div>
    </section>
  );
}