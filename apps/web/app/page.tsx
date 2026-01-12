"use client";

import { useState } from "react";
import { youtubeSearchUrl, wikimediaSearchUrl } from "./lib/media";

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
  <div className="border rounded-2xl p-4 space-y-6">
    <h2 className="text-xl font-semibold">
      {result?.meta?.subject}: {result?.meta?.topic} (Grade {result?.meta?.grade})
    </h2>

    {/* Objectives */}
    <section>
      <h3 className="font-semibold text-lg">Objectives</h3>
      <ul className="list-disc pl-6">
        {(result.objectives || []).map((x: string, i: number) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>

    {/* Lesson Notes */}
    <section>
      <h3 className="font-semibold text-lg">Lesson Notes (copy-ready)</h3>
      <div className="whitespace-pre-wrap leading-relaxed">
        {result.lessonNotes || "No lesson notes generated."}
        <button
  onClick={async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    const title = `${result?.meta?.subject || ""}: ${result?.meta?.topic || ""}`;
    doc.setFontSize(14);
    doc.text(title, 10, 15);

    doc.setFontSize(11);
    const text = result?.lessonNotes || "";
    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 10, 30);

    doc.save("lesson-notes.pdf");
  }}
  className="px-4 py-2 rounded-xl border"
>
  📄 Download Lesson Notes (PDF)
</button>
<button
  onClick={async () => {
    try {
      const res = await fetch("/api/export-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta: result?.meta,
          slides: result?.slides,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        alert(`PPTX export failed (${res.status}): ${text}`);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `LessonForge-${result?.meta?.subject || "Lesson"}-${Date.now()}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`PPTX export error: ${String(err?.message ?? err)}`);
    }
  }}
  className="px-4 py-2 rounded-xl border"
>
  📊 Download Slides (PPTX)
</button>

      </div>
    </section>

    {/* Slides */}
    <section>
      <h3 className="font-semibold text-lg">Slides (Interactive Preview)</h3>

      <div className="grid gap-4 mt-3">
        {(result.slides || []).map((s: any, i: number) => (
          <div key={i} className="rounded-2xl border p-4 space-y-2">
            <div className="font-semibold">
              {i + 1}. {s?.title || "Untitled slide"}
            </div>

            <ul className="list-disc pl-6">
              {(s?.bullets || []).map((b: string, j: number) => (
                <li key={j}>{b}</li>
              ))}
            </ul>

            {/* Media links */}
            <div className="flex flex-wrap gap-4 text-sm pt-2">
              <a
                href={youtubeSearchUrl(s?.videoQuery)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                🎥 Watch video
              </a>

              <a
                href={wikimediaSearchUrl(s?.imageQuery)}
                target="_blank"
                rel="noreferrer"
                className="text-green-600 underline"
              >
                🖼️ View image
              </a>
            </div>

            {/* Interactivity */}
            <div className="mt-2 p-3 rounded-xl border bg-yellow-50 text-sm">
              <b>👩🏽‍🏫 Classroom Activity:</b>{" "}
              {s?.interactivePrompt || "No interactive activity provided."}
            </div>

            {/* Optional: show queries for debugging */}
            <details className="text-xs opacity-80">
              <summary className="cursor-pointer">Show slide queries</summary>
              <div className="mt-2 space-y-1">
                <div>
                  <b>Image Query:</b> {s?.imageQuery || "-"}
                </div>
                <div>
                  <b>Video Query:</b> {s?.videoQuery || "-"}
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>
    </section>

    {/* Quiz */}
    <section className="space-y-3">
      <h3 className="font-semibold text-lg">Quiz</h3>

      {/* MCQ */}
      <div className="space-y-2">
        <h4 className="font-semibold">Multiple Choice Questions (MCQ)</h4>
        <div className="grid gap-3">
          {(result?.quiz?.mcq || []).map((q: any, i: number) => (
            <div key={i} className="rounded-2xl border p-3">
              <div className="font-medium">
                {i + 1}. {q?.question}
              </div>
              <ol className="list-decimal pl-6">
                {(q?.options || []).map((opt: string, j: number) => (
                  <li key={j}>{opt}</li>
                ))}
              </ol>
              <div className="text-xs opacity-80 mt-2">
                <b>Answer:</b>{" "}
                {typeof q?.answerIndex === "number"
                  ? `Option ${q.answerIndex + 1}`
                  : "Not provided"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Theory */}
      <div className="space-y-2">
        <h4 className="font-semibold">Theory Questions</h4>
        <div className="grid gap-3">
          {(result?.quiz?.theory || []).map((t: any, i: number) => (
            <div key={i} className="rounded-2xl border p-3">
              <div className="font-medium">
                {i + 1}. {t?.question}
              </div>
              <div className="text-sm mt-2 whitespace-pre-wrap">
                <b>Marking Guide:</b> {t?.markingGuide || "Not provided"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Live applications */}
    <section>
      <h3 className="font-semibold text-lg">Live Applications</h3>
      <ul className="list-disc pl-6">
        {(result.liveApplications || []).map((x: string, i: number) => (
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
