"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/browser";
import { track } from "@/lib/analytics";
import SchoolCodeInput from "../components/SchoolCodeInput";
import AccountMenu from "../components/AccountMenu";
import { useProfile } from "@/app/lib/useProfile";





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

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [credits, setCredits] = useState(0);
  const [open, setOpen] = useState(false)
  const { profile, } = useProfile();


  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
   const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);


  useEffect(() => {
  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, credits_balance")
      .eq("id", user.id)
      .single();

    if (!data) return;

    setName(data.full_name?.split(" ")[0] || "");
    setCredits(data.credits_balance || 0);
  }

  loadProfile();
}, [supabase]);

  useEffect(() => {
  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    if (data?.full_name) {
      setName(data.full_name.split(" ")[0]);
    }
  }

  loadProfile();
}, [supabase]);


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
          .limit(100);

        if (!alive) return;

        if (error) {
          setMsg(`Failed to load lessons: ${error.message}`);
          setLessons([]);
        } else {
          setLessons((rows as LessonRow[]) ?? []);
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
    const ok = window.confirm("Delete this lesson? This cannot be undone.");
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

  const filtered = lessons.filter((l) => {
    const hay = `${l.subject ?? ""} ${l.topic ?? ""} ${l.grade ?? ""} ${l.curriculum ?? ""}`
      .toLowerCase()
      .trim();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
<header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
  <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

    {/* LEFT — Logo */}
    <Link href="/" className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md" />
      <div>
        <div className="font-semibold text-slate-900">LessonForge</div>
        <div className="text-[11px] text-slate-600">Teacher Dashboard</div>
      </div>
    </Link>

    {/* RIGHT — Actions */}
    <div className="flex items-center gap-4 relative">

      {/* Greeting */}
      <span className="text-sm font-semibold text-slate-700 hidden sm:block">
        Welcome{ name ? `, ${name}` : "" } 👋
      </span>

      {/* Credits */}
      <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
        ⚡ {credits}
      </span>

      {/* Upgrade */}
     <button
  onClick={async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;

    const res = await fetch("/api/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        email: user.email,
        currency: "NGN",
        tier: "basic", // ✅ BASIC
      }),
    });

    const json = await res.json();
    if (!res.ok) {
  console.log(json); // 👈 show real error
  throw new Error(json?.error || "Paystack init failed");
}

    window.location.href = json.authorization_url;
  }}
  className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
>
  Basic ₦2,000/mo
</button>

<button
  onClick={async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;

    const res = await fetch("/api/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        email: user.email,
        currency: "NGN",
        tier: "pro", // ✅ PRO
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Paystack init failed");

    window.location.href = json.authorization_url;
  }}
  className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
>
  Pro ₦5,000/mo
</button>

     
<AccountMenu />

     
      {/* Dropdown */}
     {open && (
  <div className="absolute right-0 top-12 w-44 bg-white border rounded-xl shadow-lg p-2 text-sm animate-in fade-in zoom-in-95">

    <div className="px-3 py-2 text-slate-600 text-xs">
      Signed in as
      <div className="font-semibold text-slate-900">{name}</div>
    </div>

    <hr className="my-2" />

    <button
      onClick={logout}
      className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 rounded-lg"
    >
      Logout
    </button>
  </div>
)}
    </div>
  </div>
</header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Main column */}
          <section className="flex-1 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  My Lesson Library
                </h1>
                <p className="text-sm text-slate-700 mt-1">
                  Search, reuse, and review your saved lessons.
                  {userEmail ? (
                    <span className="block mt-1 text-xs text-slate-600">
                      Signed in as{" "}
                      <span className="font-semibold text-slate-900">{userEmail}</span>
                    </span>
                  ) : null}
                </p>
              </div>

              <Link
                href="/"
                className="sm:hidden inline-flex px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                + New
              </Link>
            </div>

            {/* Search */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by subject, topic, grade, or curriculum…"
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                {/* Optional filters: keep disabled for now */}
                <select
                  disabled
                  className="rounded-xl border border-slate-300 px-3 py-3 bg-white text-sm text-slate-700 opacity-60"
                >
                  <option>All subjects</option>
                </select>
                <select
                  disabled
                  className="rounded-xl border border-slate-300 px-3 py-3 bg-white text-sm text-slate-700 opacity-60"
                >
                  <option>All grades</option>
                </select>
                <select
                  disabled
                  className="rounded-xl border border-slate-300 px-3 py-3 bg-white text-sm text-slate-700 opacity-60"
                >
                  <option>Newest first</option>
                </select>
              </div>
            </div>

            {msg && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
                {msg}
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                    <div className="h-5 w-3/4 bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded mb-6" />
                    <div className="h-9 w-full bg-slate-200 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <span className="text-2xl">📚</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">No saved lessons yet</h2>
                <p className="text-sm text-slate-700 mt-2">
                  Generate a lesson and click “Save to Library” to see it here.
                </p>
                <Link
                  href="/"
                  className="inline-flex mt-5 px-5 py-3 rounded-2xl bg-slate-900 text-white font-semibold hover:bg-slate-800"
                >
                  Generate your first lesson
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100 font-semibold">
                        {l.subject || "Subject"}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200 font-semibold">
                        Grade {l.grade || "-"}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900">
                      {l.topic || "Untitled topic"}
                    </div>

                    <div className="text-xs text-slate-600 mt-2">
                      <span title={formatDate(l.created_at)}>{relativeTime(l.created_at)}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link
                        href={`/lesson/${l.id}`}
                        className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-center text-slate-900"
                      >
                        View
                      </Link>

                      <button
                        onClick={() => deleteLesson(l.id)}
                        disabled={deletingId === l.id}
                        className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-red-50 text-sm font-semibold text-slate-900 disabled:opacity-60"
                      >
                        {deletingId === l.id ? "Deleting…" : "Delete"}
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Trust / Tips panel */}
          <aside className="w-full lg:w-[360px] space-y-4">
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
                    <section className="max-w-6xl mx-auto px-6 py-6">
                     <SchoolCodeInput />
                     </section>
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
