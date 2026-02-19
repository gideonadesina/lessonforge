"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import SchoolCodeInput from "@/components/SchoolCodeInput";
import { useProfile } from "@/lib/useProfile";

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;
  created_at: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  // ✅ Single source of truth for plan + credits
  const { profile, creditsRemaining, planLabel } = useProfile();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [worksheetsCount, setWorksheetsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auth + initial load
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!alive) return;

        if (!data?.user) {
          router.push("/login");
          return;
        }

        setUserEmail(data.user.email ?? null);

        const { data: rows, error } = await supabase
          .from("lessons")
          .select("id, subject, topic, grade, curriculum, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

        if (!alive) return;

        if (error) {
          setMsg(`Failed to load lessons: ${error.message}`);
          setLessons([]);
        } else {
          setLessons((rows as LessonRow[]) ?? []);
        }
        
       
        const { count: wsCount, error: wsErr } = await supabase
  .from("worksheets")
  .select("id", { count: "exact", head: true });

if (!alive) return;

if (wsErr) {
  console.warn("Failed to load worksheets count:", wsErr.message);
  setWorksheetsCount(0);
} else {
  setWorksheetsCount(wsCount ?? 0);
}

      } catch (e: any) {
        setMsg(`Dashboard error: ${e?.message ?? String(e)}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  async function logout() {
    setMsg(null);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function deleteLesson(id: string) {
    const ok = window.confirm("Delete this item? This cannot be undone.");
    if (!ok) return;

    setDeletingId(id);
    setMsg(null);
    try {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;

      setLessons((prev) => prev.filter((x) => x.id !== id));
      setMsg("Deleted ✅");
    } catch (e: any) {
      setMsg(`Delete failed: ${e?.message ?? String(e)}`);
    } finally {
      setDeletingId(null);
    }
  }

  // ----- Dashboard metrics (simple but useful) -----
  const stats = useMemo(() => {
    const totalLessons = lessons.length;
    const savedToLibrary = lessons.length;
    const worksheetsCreated = worksheetsCount;


    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent7d = lessons.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return !Number.isNaN(t) && t >= weekAgo;
    }).length;

    return {
      totalLessons,
      savedToLibrary,
      worksheetsCreated,
      recent7d,
    };
  }, [lessons, worksheetsCount]);


  // Chart-ish placeholder bars based on recent activity (last 7 days buckets)
  const activityBars = useMemo(() => {
    const days = 7;
    const buckets = Array.from({ length: days }, () => 0);
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    for (const l of lessons) {
      const t = new Date(l.created_at);
      if (Number.isNaN(t.getTime())) continue;
      const diffDays = Math.floor(
        (t.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (diffDays >= 0 && diffDays < days) buckets[diffDays] += 1;
    }

    const max = Math.max(1, ...buckets);
    return buckets.map((v) => ({
      value: v,
      heightPct: clamp(Math.round((v / max) * 100), 6, 100),
    }));
  }, [lessons]);

  const recent = useMemo(() => lessons.slice(0, 8), [lessons]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          {/* LEFT — Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md" />
            <div>
              <div className="font-semibold text-slate-900">LessonForge</div>
              <div className="text-[11px] text-slate-600">Teacher Workspace</div>
            </div>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Top heading + actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Dashboard Overview
            </h1>
            <p className="text-sm text-slate-700 mt-1">
              A quick view of your activity, credits, and recent lesson packs.
              {userEmail ? (
                <span className="block mt-1 text-xs text-slate-600">
                  Signed in as{" "}
                  <span className="font-semibold text-slate-900">{userEmail}</span>
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/generate"
              className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Generate Lesson Pack
            </Link>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Download Report
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-red-50 text-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {msg && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Lessons Generated"
            value={loading ? "—" : String(stats.totalLessons)}
            sub={`+${stats.recent7d} in last 7 days`}
          />
          <KpiCard
            title="Saved to Library"
            value={loading ? "—" : String(stats.savedToLibrary)}
            sub="Your saved lesson packs"
          />
          <KpiCard
            title="Worksheets Created"
            value={loading ? "—" : String(stats.worksheetsCreated)}
            sub="Coming online soon"
          />
          <KpiCard
            title="Credits Remaining"
            value={loading ? "—" : String(creditsRemaining)}
            sub="Used to generate content"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left side */}
          <section className="lg:col-span-8 space-y-4">
            {/* Activity chart panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Generation Activity
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Last 7 days</div>
                </div>
                <div className="text-xs text-slate-600">
                  Total:{" "}
                  <span className="font-semibold text-slate-900">
                    {stats.recent7d}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-2 items-end h-28">
                {activityBars.map((b, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div
                      className="w-full rounded-xl bg-slate-900/10 border border-slate-200"
                      style={{ height: `${b.heightPct}%` }}
                      title={`${b.value} generated`}
                    />
                    <div className="text-[10px] text-slate-500">
                      {i === 6 ? "Today" : "•"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Recent Lesson Packs
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Quick access to your latest saved lessons
                  </div>
                </div>
                <Link
                  href="/library"
                  className="text-sm font-semibold text-violet-700 hover:text-violet-800"
                >
                  View all →
                </Link>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-600">
                      <th className="py-2 pr-3">Topic</th>
                      <th className="py-2 pr-3">Subject</th>
                      <th className="py-2 pr-3">Grade</th>
                      <th className="py-2 pr-3">Created</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="border-t border-slate-200">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-3 pr-3">
                            <div className="h-4 w-40 bg-slate-200 rounded" />
                          </td>
                          <td className="py-3 pr-3">
                            <div className="h-4 w-24 bg-slate-200 rounded" />
                          </td>
                          <td className="py-3 pr-3">
                            <div className="h-4 w-14 bg-slate-200 rounded" />
                          </td>
                          <td className="py-3 pr-3">
                            <div className="h-4 w-20 bg-slate-200 rounded" />
                          </td>
                          <td className="py-3 text-right">
                            <div className="h-8 w-24 bg-slate-200 rounded-xl ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : recent.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-600">
                          No lessons yet. Click{" "}
                          <span className="font-semibold">Generate Lesson Pack</span>.
                        </td>
                      </tr>
                    ) : (
                      recent.map((l) => (
                        <tr key={l.id} className="border-b border-slate-100">
                          <td className="py-3 pr-3 font-semibold text-slate-900">
                            {l.topic || "Untitled topic"}
                          </td>
                          <td className="py-3 pr-3">
                            <span className="inline-flex text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100 font-semibold">
                              {l.subject || "Subject"}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-slate-700">
                            {l.grade ? `Grade ${l.grade}` : "—"}
                          </td>
                          <td className="py-3 pr-3 text-slate-600" title={formatDate(l.created_at)}>
                            {relativeTime(l.created_at)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex gap-2">
                              <Link
                                href={`/lesson/${l.id}`}
                                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold"
                              >
                                View
                              </Link>
                              <button
                                onClick={() => deleteLesson(l.id)}
                                disabled={deletingId === l.id}
                                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-red-50 text-xs font-semibold text-red-700 disabled:opacity-60"
                              >
                                {deletingId === l.id ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Right side */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-bold text-slate-900">Plan & Billing</div>
              <p className="text-sm text-slate-700 mt-2">
                Current plan:{" "}
                <span className="font-semibold text-slate-900">{planLabel}</span>
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Link
                  href="/settings"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 text-center"
                >
                  Manage subscription
                </Link>
                <Link
                  href="/generate"
                  className="rounded-xl bg-violet-600 text-white px-4 py-2 text-sm font-semibold hover:bg-violet-700 text-center"
                >
                  Generate now
                </Link>
              </div>
              <div className="mt-3 text-xs text-slate-600">
                Tip: Basic = ₦2,000 / Pro = ₦5,000. Credits power generation.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-bold text-slate-900">Join School License</div>
              <p className="text-sm text-slate-700 mt-2">
                Enter the code from your school admin to unlock school features.
              </p>
              <div className="mt-4">
                <SchoolCodeInput />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-bold text-slate-900">Data & Privacy</div>
              <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                Your lessons are private to your account. Avoid entering student names or
                sensitive personal information. We don’t sell your data.
              </p>
              <div className="mt-3 text-xs text-slate-600">
                🔒 Secure auth via Supabase • 📚 Saved lesson library
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-bold text-slate-900">Tips</div>
              <ul className="mt-2 text-sm text-slate-700 space-y-2 list-disc pl-5">
                <li>Use curriculum keywords (WAEC / NECO / Cambridge).</li>
                <li>Add duration for better pacing and activities.</li>
                <li>Save your best lessons to standardize teaching quality.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-2 text-xs text-slate-600">{sub}</div>
    </div>
  );
}
