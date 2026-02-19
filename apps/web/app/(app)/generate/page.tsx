"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Generated = {
  meta?: {
    subject?: string;
    topic?: string;
    grade?: string;
    curriculum?: string;
    durationMins?: number;
  };
  objectives?: string[];
  lessonNotes?: string;
  slides?: Array<{
    title: string;
    bullets: string[];
    image?: string;
    imageQuery?: string;
    videoQuery?: string;
    interactivePrompt?: string;
  }>;
  quiz?: {
    mcq?: Array<{ q: string; options: string[]; answerIndex?: number }>;
    theory?: Array<{ q: string; markingGuide?: string }>;
  };
  liveApplications?: string[];
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

function youtubeSearchUrl(query: string) {
  const q = (query || "").trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function shuffleArray<T>(arr: T[]) {
  const copy = [...arr];
  // Fisher–Yates
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function GeneratePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [curriculum, setCurriculum] = useState("WAEC / NECO / Cambridge");
  const [durationMins, setDurationMins] = useState(40);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [result, setResult] = useState<Generated | null>(null);

  async function onGenerate() {
    setLoading(true);
    setSaving(false);
    setError(null);
    setSaveMsg(null);
    setResult(null);

    try {
      // 1) Session token (route.ts expects Bearer token)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }

      // 2) Generate
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          topic: topic.trim(),
          grade: grade.trim(),
          curriculum: curriculum.trim(),
          durationMins,
        }),
      });

      const json = await res.json();

if (!res.ok) {
  throw new Error(json?.error || json?.message || "Generation failed");
}

const generated = json.data as Generated;

setResult(generated);

// ✅ AUTO SAVE TO SUPABASE (THIS FIXES result_json error)
const { data: { user } } = await supabase.auth.getUser();

if (!user) throw new Error("User not authenticated");

const { error: insertError } = await supabase
  .from("lessons")
  .insert({
    user_id: user.id, // remove if not in your table
    subject: generated?.meta?.subject ?? subject,
    topic: generated?.meta?.topic ?? topic,
    grade: generated?.meta?.grade ?? grade,
    curriculum: generated?.meta?.curriculum ?? curriculum,

    // ⭐ THIS IS THE CRITICAL FIX
    result_json: generated,
  });

if (insertError) {
  console.error("Save failed:", insertError.message);
  throw insertError;
}

      setSaveMsg("✅ Auto-saved to Library");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
      setSaving(false);
      // refresh library/dashboard counts if needed
      router.refresh();
    }
  }

  const meta = result?.meta ?? {};
  const slides = Array.isArray(result?.slides) ? result!.slides! : [];
  const mcq = result?.quiz?.mcq ?? [];
  const theory = result?.quiz?.theory ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Generate Lesson Pack</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fill the details → generate instantly. Auto-saves to your Library.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Economics"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Grade / Class">
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g., 10"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Topic" full>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Inflation and Deflation"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Curriculum" full>
            <input
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Duration (mins)">
            <input
              type="number"
              min={20}
              max={120}
              value={durationMins}
              onChange={(e) => setDurationMins(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={onGenerate}
            disabled={loading || !subject.trim() || !grade.trim() || !topic.trim()}
            type="button"
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Lesson Pack"}
          </button>

          {saving ? (
            <span className="text-sm text-slate-700">Saving to Library…</span>
          ) : saveMsg ? (
            <span className="text-sm text-emerald-700">{saveMsg}</span>
          ) : null}

          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          🔒 Generation + saving happens securely under your account.
        </p>
      </div>

      {/* Result */}
      {!result ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
          Your generated lesson pack will show here.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Meta */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-500">Topic</div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {meta.topic ?? topic}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {meta.subject ?? subject} • Grade {meta.grade ?? grade} •{" "}
              {meta.curriculum ?? curriculum}
            </div>
          </section>

          {/* Lesson Notes */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Lesson Notes
            </h3>
            <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
              {result.lessonNotes || "No lesson notes generated."}
            </p>
          </section>

          {/* Slides */}
          <section className="space-y-4">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Slides
            </h3>

            {slides.length ? (
              <div className="grid gap-6">
                {slides.map((s, i) => {
                  const title = s?.title || "Untitled slide";
                  const bullets = Array.isArray(s?.bullets) ? s.bullets : [];
                  const videoQuery =
                    s?.videoQuery || title || `${subject} ${topic}`.trim();
                  const activity =
                    s?.interactivePrompt || "No interactive activity provided.";

                  return (
                    <div
                      key={i}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
                    >
                      {/* Title */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-lg font-bold text-slate-900">
                          {i + 1}. {title}
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full border bg-slate-50 text-slate-700">
                          Slide {i + 1}
                        </span>
                      </div>

                      {/* Image */}
                      <div className="rounded-xl overflow-hidden border bg-slate-100">
                        <img
                          src={s?.image || FALLBACK_IMG}
                          alt={title}
                          className="w-full h-52 object-cover"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_IMG;
                          }}
                        />
                      </div>

                      {/* Bullets */}
                      {bullets.length ? (
                        <ul className="list-disc pl-6 space-y-2 text-slate-800 font-medium">
                          {bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-600">No bullet points.</p>
                      )}

                      {/* Links */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <a
                          href={youtubeSearchUrl(videoQuery)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-semibold hover:underline"
                        >
                          🎥 Watch video
                        </a>
                      </div>

                      {/* Classroom activity */}
                      <div className="rounded-xl border bg-yellow-50 p-3 text-sm text-slate-900">
                        <span className="font-bold">👩🏽‍🏫 Classroom Activity:</span>{" "}
                        {activity}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No slides generated yet.</p>
            )}
          </section>

          {/* MCQ (Shuffled) */}
          {mcq.length ? (
            <section className="space-y-4">
              <h3 className="text-2xl font-bold text-slate-900">
                📝 Multiple Choice Questions
              </h3>

              <div className="space-y-6">
                {mcq.map((q, i) => {
                  const options = Array.isArray(q?.options) ? q.options : [];
                  const shuffledOptions = shuffleArray(options);

                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 p-5 bg-white shadow-sm"
                    >
                      <p className="font-semibold text-lg mb-3 text-slate-900">
                        {i + 1}. {q?.q || "Question text missing"}
                      </p>
                      <ul className="space-y-2">
                        {shuffledOptions.map((opt, j) => (
                          <li key={j} className="flex items-start gap-3 text-slate-800">
                            <span className="font-bold text-indigo-600 min-w-[24px]">
                              {String.fromCharCode(65 + j)}.
                            </span>
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Theory */}
          {theory.length ? (
            <section className="space-y-4">
              <h3 className="text-2xl font-bold text-slate-900">✍️ Theory Questions</h3>

              <div className="space-y-4">
                {theory.map((q, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 p-5 bg-white shadow-sm"
                  >
                    <p className="font-semibold text-lg mb-2 text-slate-900">
                      {i + 1}. {q?.q || "Question text missing"}
                    </p>

                    {q?.markingGuide ? (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-semibold text-slate-700 mb-1">
                          Marking Guide:
                        </p>
                        <p className="text-sm text-slate-600">{q.markingGuide}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      {children}
    </div>
  );
}
