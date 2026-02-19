"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
 import { youtubeSearchUrl } from "@/lib/media";


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
  const params = useParams();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const lessonId = Array.isArray((params as any)?.id) ? (params as any).id[0] : (params as any)?.id;

  const [loading, setLoading] = useState(true);
   const [row, setRow] = useState<LessonRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setMsg(null);

        const { data: auth } = await supabase.auth.getUser();
        if (!alive) return;

        if (!auth?.user) {
          router.push("/login");
          return;
        }

        if (!lessonId) {
          setMsg("Missing lesson id.");
          setLoading(false);
          return;
       }

        const { data, error } = await supabase
          .from("lessons")
          .select("id, subject, topic, grade, curriculum,created_at, result_json")
          .eq("id", lessonId)
          .single();

        if (!alive) return;

        if (error) {
          setMsg(`Failed to load lesson: ${error.message}`);
          setRow(null);
        } else {
          setRow(data as LessonRow);
        }
      } catch (e: any) {
        setMsg(e?.message ?? "Unknown error");
      } finally {
        if (alive) setLoading(false);
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

  if (!row) {
    return (
      <div className="max-w-5xl mx-auto p-6 md:p-10 text-slate-900 space-y-4">
        <div className="rounded-2xl border bg-white p-6">
          <div className="font-bold text-lg">Couldn’t load lesson</div>
          <div className="text-sm text-slate-700 mt-1">{msg ?? "Unknown error"}</div>

          <div className="mt-4 flex gap-2">
            <Link href="/dashboard" className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 font-medium">
              Back to Dashboard
            </Link>
            <Link href="/" className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 font-medium">
              New Lesson
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const result = row.result_json ?? {};
  const objectives: string[] = Array.isArray(result?.objectives) ? result.objectives : [];
  const slides: any[] = Array.isArray(result?.slides) ? result.slides : [];

  const quiz = result?.quiz ?? {};
  const mcq: any[] = Array.isArray(quiz?.mcq) ? quiz.mcq : [];
  const theory: any[] = Array.isArray(quiz?.theory) ? quiz.theory : [];
const chunk = <T,>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

// 4 MCQs per slide → 10 MCQs becomes 3 slides (Slides 10–12 if you have 9 normal slides)
const mcqSlides = chunk(mcq, 4).map((group, idx) => ({
  title: `📝 MULTIPLE CHOICE QUESTIONS (${idx + 1}/${Math.ceil(mcq.length / 4)})`,
  bullets: [] as string[],
  mcqGroup: group,
}));

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
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard" className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 font-medium">
            Back
          </Link>
          <Link href="/" className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 font-medium">
            New Lesson
          </Link>
        </div>
      </div>

      {/* Objectives */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold mb-3">Objectives</h2>
        {objectives.length ? (
          <ul className="list-disc pl-6 space-y-1">
            {objectives.map((o, i) => (
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
          {result?.lessonNotes || "No lesson notes found."}
        </div>
      </section>

      {/* Slides */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold mb-4">Slides</h2>

        {slides.length ? (
          <div className="grid gap-4">
           {slides.map((s: any, i: number) => {
  // ✅ MCQ slide rendering
  if (s.kind === "mcq") {
    return (
      <div key={`mcq-${i}`} className="rounded-xl border p-4 bg-slate-50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-semibold text-slate-900">
            {i + 1}. {s.title}
          </div>
          <span className="text-xs px-2 py-1 rounded-full border bg-white text-slate-700">
            Slide {i + 1}
          </span>
        </div>

        <ol className="space-y-4">
          {(s.mcqGroup ?? []).map((q: any, qi: number) => (
            <li key={qi} className="text-slate-900">
              <div className="font-medium">
                {q?.q || "Question"}
              </div>

              <div className="mt-2 space-y-1">
                {(Array.isArray(q?.options) ? q.options : []).map(
                  (opt: string, oi: number) => (
                    <div key={oi}>
                      <span className="font-semibold">
                        {String.fromCharCode(65 + oi)}.
                      </span>{" "}
                      {opt}
                    </div>
                  )
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // ✅ Normal slide rendering (your existing UI)
  const title = s?.title || `Slide ${i + 1}`;
  const bullets: string[] = Array.isArray(s?.bullets) ? s.bullets : [];
  const imgQuery = s?.imageQuery || title || row.topic || "education";
  const videoQuery = s?.videoQuery || title || row.topic || "";

  return (
    <div key={i} className="rounded-xl border p-4 bg-slate-50">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-semibold text-slate-900">
          {i + 1}. {title}
        </div>
        <span className="text-xs px-2 py-1 rounded-full border bg-white text-slate-700">
          Slide {i + 1}
        </span>
      </div>

      <div className="rounded-xl overflow-hidden border bg-white mb-3">
  {s?.image ? (
    <img
      src={s.image}
      alt={title}
      className="w-full h-48 object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className="w-full h-48 flex items-center justify-center text-sm text-slate-600 bg-slate-100">
      No image saved for this slide
    </div>
  )}
</div>

      {bullets.length ? (
        <ul className="list-disc pl-6 space-y-1">
          {bullets.map((b: string, j: number) => (
            <li key={j}>{b}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-700">No bullet points.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {videoQuery ? (
          <a
            href={youtubeSearchUrl(videoQuery)}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline font-semibold"
          >
            🎥 Watch video
          </a>
        ) : null}
      </div>

      {s?.interactivePrompt ? (
        <div className="mt-3 p-3 rounded-xl border bg-yellow-50 text-sm">
          <b>👩🏽‍🏫 Classroom Activity:</b> {s.interactivePrompt}
        </div>
      ) : null}
    </div>
  );
})}

          </div>
        ) : (
          <p className="text-sm text-slate-700">No slides found.</p>
        )}
      </section>

      {/* Student Questions */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold mb-4">Student Questions</h2>

        {mcq.length ? (
          <div className="space-y-4">
            {mcq.map((q: any, i: number) => (
              <div key={i} className="rounded-xl border p-4 bg-slate-50">
                <div className="font-semibold mb-2">
                  {i + 1}. {q?.q || "Question"}
                </div>
                <ul className="list-disc pl-6 space-y-1">
                  {(Array.isArray(q?.options) ? q.options : []).map((opt: string, j: number) => (
                    <li key={j}>{opt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-700">No multiple choice questions found.</p>
        )}

        {theory.length ? (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Theory</h3>
            {theory.map((t: any, i: number) => (
              <div key={i} className="rounded-xl border p-4 bg-slate-50">
                <div className="font-semibold">{i + 1}. {t?.q || "Theory question"}</div>
                {t?.answerGuide ? (
                  <div className="mt-2 text-sm text-slate-700">
                    <b>Marking guide:</b> {t.answerGuide}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
