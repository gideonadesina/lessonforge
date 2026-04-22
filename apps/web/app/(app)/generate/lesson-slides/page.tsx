"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import SlideViewer from "@/components/slides/SlideViewer";
import type { SlideDeck } from "@/lib/slideRenderer";

const GRADE_OPTIONS = [
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "College",
];

const SUBJECT_OPTIONS = [
  "Science", "Math", "English", "History", "Art", "Geography",
  "Biology", "Chemistry", "Physics", "Economics", "Other",
];

const DURATION_OPTIONS = [
  { value: "20min", label: "20 minutes" },
  { value: "45min", label: "45 minutes" },
  { value: "60min", label: "60 minutes" },
];

const TONE_OPTIONS = [
  { value: "Engaging & Fun", label: "Engaging & Fun" },
  { value: "Formal & Academic", label: "Formal & Academic" },
  { value: "Socratic", label: "Socratic" },
];

const BLOOM_OPTIONS = [
  "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create",
];

type FormData = {
  topic: string;
  grade: string;
  subject: string;
  duration: "20min" | "45min" | "60min";
  tone: string;
  bloom: string;
};

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function LessonSlidesPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [formData, setFormData] = useState<FormData>({
    topic: "",
    grade: "",
    subject: "",
    duration: "45min",
    tone: "Engaging & Fun",
    bloom: "Understand",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<SlideDeck | null>(null);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDeck(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }

      const res = await fetch("/api/generate-slides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate slides");
      }

      setDeck(json.deck);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (deck) {
    return <SlideViewer deck={deck} />;
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-600">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Generate
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Lesson Slides
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Create premium presentation slides for your classroom.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Topic" full>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => updateField("topic", e.target.value)}
                  placeholder="e.g., Photosynthesis, The Water Cycle"
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </Field>

              <Field label="Subject">
                <select
                  value={formData.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                >
                  <option value="">Select subject...</option>
                  {SUBJECT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </Field>

              <Field label="Grade Level">
                <select
                  value={formData.grade}
                  onChange={(e) => updateField("grade", e.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                >
                  <option value="">Select grade...</option>
                  {GRADE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </Field>

              <Field label="Duration">
                <select
                  value={formData.duration}
                  onChange={(e) => updateField("duration", e.target.value as FormData["duration"])}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Tone">
                <select
                  value={formData.tone}
                  onChange={(e) => updateField("tone", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                >
                  {TONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Bloom's Level">
                <select
                  value={formData.bloom}
                  onChange={(e) => updateField("bloom", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                >
                  {BLOOM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || !formData.topic || !formData.subject || !formData.grade}
                className="rounded-xl bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "Crafting your slides..." : "Generate Slides"}
              </button>
              {error && (
                <span className="text-sm text-red-600">{error}</span>
              )}
            </div>
          </div>

          <p className="text-xs text-[var(--text-tertiary)]">
            🔒 Your slides are generated securely using AI.
          </p>
        </form>
      </div>
    </div>
  );
}