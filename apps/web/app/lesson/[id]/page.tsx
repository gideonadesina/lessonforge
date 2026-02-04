"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/browser";
import { unsplashImageUrl } from "@/app/lib/unsplash";
import { youtubeSearchUrl } from "../../lib/media";

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;
  result_json: any;
};

export default function LessonPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const lessonId = params?.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [row, setRow] = useState<LessonRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: authData, error: authErr } = await supabase.auth.getUser();

        if (!alive) return;

        if (authErr) {
          setError(authErr.message);
          setLoading(false);
          return;
        }

        if (!authData?.user) {
          router.push("/login");
          return;
        }

        setUserEmail(authData.user.email ?? null);

        const { data, error } = await supabase
          .from("lessons")
          .select("id, subject, topic, grade, curriculum, result_json")
          .eq("id", lessonId)
          .single();

        if (!alive) return;

        if (error || !data) {
          setError(error?.message || "Lesson not found (or no access).");
          setRow(null);
        } else {
          setRow(data as LessonRow);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? String(e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [lessonId, router, supabase]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 md:p-10 text-slate-900">
        <div className="rounded-2xl border bg-white p-6">Loading lesson…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6 md:p-10 text-slate-900 space-y-4">
        <div className="rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-bold">Auth / Load error</h1>
          <p className="mt-2 text-slate-700">{error}</p>

          <div className="flex gap-2 mt-6">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 font-medium"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-medium"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="max-w-5xl mx-auto p-6 md:p-10 text-slate-900">
        <div className="rounded-2xl border bg-white p-6">
          Lesson not found.
          <div className="mt-4">
            <Link href="/dashboard" className="underline text-blue-600">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lesson = row.result_json ?? {};
  const slides = Array.isArray(lesson?.slides) ? lesson.slides : [];

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6 text-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {row.subject}
            {row.topic ? ` • ${row.topic}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-700">
            Grade: <span className="font-medium">{row.grade}</span>
            {row.curriculum ? (
              <>
                {" "}
                • Curriculum: <span className="font-medium">{row.curriculum}</span>
              </>
            ) : null}
            {userEmail ? (
              <span className="block mt-1 text-xs text-slate-500">
                Signed in as <span className="font-semibold">{userEmail}</span>
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 font-medium"
          >
            Back
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 font-medium"
          >
            New Lesson
          </Link>
        </div>
      </div>

      {/* Objectives */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold mb-3">Objectives</h2>
        {(lesson?.objectives ?? []).length ? (
          <ul className="list-disc pl-6 space-y-1">
            {(lesson.objectives ?? []).map((o: string, i: number) => (
              <li key={i} className="leading-relaxed">
                {o}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-700">No objectives found.</p>
        )}
      </section>

      {/* Lesson Notes */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold mb-3">Lesson Notes</h2>
        <div className="whitespace-pre-wrap leading-relaxed text-slate-900">
          {lesson?.lessonNotes || "No lesson notes found."}
        </div>
      </section>

      {/* Slides */}
<section className="rounded-2xl border bg-white p-5">
  <h2 className="text-xl font-semibold mb-4">Slides</h2>

  {slides.length ? (
    <div className="grid gap-4">
      {slides.map((s: any, i: number) => {
        const title = s?.title || `Slide ${i + 1}`;
        const bullets: string[] = Array.isArray(s?.bullets) ? s.bullets : [];

        const q = (s?.imageQuery || title || row.topic || "education") as string;
        
        return (
          <div key={i} className="rounded-xl border p-4 bg-slate-50">
            <div className="font-semibold mb-3">
              {i + 1}. {title}
            </div>

            <div className="rounded-xl overflow-hidden border bg-white mb-3">
          const q =
  (s?.imageQuery ||
    `${row.subject || ""} ${row.topic || ""} diagram` ||
    "education classroom") as string;

<img
  src={unsplashImageUrl(s?.imageQuery || s?.title || row.topic || "education")}
  alt={s?.title || "Lesson illustration"}
  className="w-full h-48 object-cover"
  loading="lazy"
  onError={(e) => {
    e.currentTarget.src = unsplashImageUrl("education classroom");
  }}
/>

<a
  href={youtubeSearchUrl(s?.videoQuery || s?.title || row.topic || "lesson")}
  target="_blank"
  rel="noreferrer"
  className="text-blue-600 underline text-sm"
>
  🎥 Watch video
</a>

            </div>

            {bullets.length ? (
              <ul className="list-disc pl-6 space-y-1">
                {bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-700">No bullet points.</p>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <p className="text-sm text-slate-700">No slides found.</p>
  )}
</section>
    </div>
  );
}
