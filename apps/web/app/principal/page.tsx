import Link from "next/link";
import { redirect } from "next/navigation";

import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import { getRoleHomePath, roleFromUserMetadata } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function PrincipalPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/select-role");
  }

  const role = roleFromUserMetadata(user.user_metadata, "teacher");
  if (role !== "principal") {
    redirect(getRoleHomePath(role ?? "teacher"));
  }

  return (
    <div className="min-h-screen bg-[#f7f2ea] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <LessonForgeWordmark href="/principal" />

        <main className="rounded-[2rem] border border-violet-100/80 bg-white/95 p-8 shadow-[0_30px_70px_-46px_rgba(30,41,59,0.6)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-700/80">
            Principal Workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Principal workspace coming next
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            We are preparing a dedicated school leadership experience for academic
            operations, curriculum visibility, and teacher oversight. Your role has already
            been saved, and this area will become your principal command center.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="text-sm font-semibold text-slate-900">
                School planning dashboards
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Leadership-focused analytics and planning tools are in progress.
              </p>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Teacher oversight tools
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Visibility into lessons, pacing, and curriculum implementation is planned.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/select-role"
              className="rounded-2xl border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:text-slate-900"
            >
              Change role
            </Link>
            <Link
              href="/"
              className="rounded-2xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
