"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseclient";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("lessons")
        .select("id, subject, topic, grade, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) setLessons(data);
      setLoading(false);
    })();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Lessons</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-xl border" onClick={() => router.push("/")}>
            ➕ Generate New
          </button>
          <button className="px-3 py-2 rounded-xl border" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div className="opacity-70">Loading…</div>
      ) : lessons.length === 0 ? (
        <div className="opacity-70">No saved lessons yet. Generate one and save it.</div>
      ) : (
        <div className="grid gap-3">
          {lessons.map((l) => (
            <button
              key={l.id}
              onClick={() => router.push(`/lesson/${l.id}`)}
              className="text-left rounded-2xl border p-4 hover:bg-black/5"
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
