"use client";

import { useState } from "react";

export default function Home() {
  const [subject, setSubject] = useState("Chemistry");
  const [topic, setTopic] = useState("Solutions");
  const [grade, setGrade] = useState("11");
  const [curriculum, setCurriculum] = useState("Cambridge / WAEC-friendly");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic, grade, curriculum, durationMins: 40 }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "Request failed");
      } else {
        setResult(json.data);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">LessonForge MVP</h1>
      <p className="text-sm opacity-80">
        Type a topic → get lesson plan, notes, slides, quiz + media queries.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Subject</span>
          <input
            className="w-full border rounded-xl p-3"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Grade/Class</span>
          <input
            className="w-full border rounded-xl p-3"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Topic</span>
          <input
            className="w-full border rounded-xl p-3"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Curriculum</span>
          <input
            className="w-full border rounded-xl p-3"
            value={curriculum}
            onChange={(e) => setCurriculum(e.target.value)}
          />
        </label>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        className="px-5 py-3 rounded-2xl border shadow-sm hover:shadow disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate Lesson Pack"}
      </button>

      {error && (
        <div className="border rounded-2xl p-4 text-red-600">
          <b>Error:</b> {error}
        </div>
      )}

      {result && (
        <div className="border rounded-2xl p-4 space-y-4">
          <h2 className="text-xl font-semibold">
            {result?.meta?.subject}: {result?.meta?.topic} (Grade {result?.meta?.grade})
          </h2>

          <section>
            <h3 className="font-semibold">Objectives</h3>
            <ul className="list-disc pl-6">
              {(result.objectives || []).map((x: string, i: number) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Lesson Notes (copy-ready)</h3>
            <p className="whitespace-pre-wrap">{result.lessonNotes}</p>
          </section>

          <section>
            <h3 className="font-semibold">Slides (preview)</h3>
            <div className="grid gap-3">
              {(result.slides || []).map((s: any, i: number) => (
                <div key={i} className="rounded-2xl border p-3">
                  <div className="font-semibold">
                    {i + 1}. {s.title}
                  </div>
                  <ul className="list-disc pl-6">
                    {(s.bullets || []).map((b: string, j: number) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                  <div className="text-xs opacity-80 mt-2">
                    <div><b>Image Query:</b> {s.imageQuery}</div>
                    <div><b>Video Query:</b> {s.videoQuery}</div>
                    <div><b>Interactive:</b> {s.interactivePrompt}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
