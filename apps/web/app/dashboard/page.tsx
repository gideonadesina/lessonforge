"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/browser";

type LessonRow = {
  id: string;
  subject: string;
  topic: string;
  grade: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErrMsg(null);

      // Use session first (more reliable on client)
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      // ✅ IMPORTANT (recommended): only fetch this user's lessons
      const { data, error } = await supabase
        .from("lessons")
        .select("id, subject, topic, grade, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!alive) return;

      if (error) {
        setErrMsg(error.message);
      } else {
        setLessons((data as LessonRow[]) ?? []);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Lessons</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-xl border"
            onClick={() => router.push("/")}
          >
            ➕ Generate New
          </button>
          <button className="px-3 py-2 rounded-xl border" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div className="opacity-70">Loading…</div>
      ) : errMsg ? (
        <div className="rounded-2xl border p-4">
          <div className="font-semibold text-red-600">Could not load lessons</div>
          <div className="text-sm opacity-80 mt-1">{errMsg}</div>
          <div className="text-sm opacity-80 mt-2">
            If this says “permission denied”, we’ll fix your Supabase RLS policy next.
          </div>
        </div>
      ) : lessons.length === 0 ? (
        <div className="opacity-70">No saved lessons yet. Generate one and save it.</div>
      ) : (
        <div className="grid gap-3">
          {lessons.map((l) => (
            <button
              key={l.id}
              onClick={() => router.push(`/lesson/${l.id}`)}
              className="text-left rounded-2xl border p-4 hover:bg-white/5 transition"
            >
              <div className="font-semibold">
                {l.subject}: {l.topic} (Grade {l.grade})
              </div>
              <div className="text-sm opacity-70">
                {new Date(l.created_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
