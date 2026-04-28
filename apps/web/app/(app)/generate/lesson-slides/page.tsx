"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import SlideViewer from "@/components/slides/SlideViewer";
import type { SlideDeck } from "@/lib/slideRenderer";
import { getInvalidJsonMessage, readJsonResponse } from "@/lib/http/safe-json";
import { track } from "@/lib/analytics";
import { enrichGeneratedLessonImages } from "@/lib/generation/enrich-images-client";

// ─────────────────────────────────────────────────────────────
// OPTIONS — Nigerian curriculum aligned
// ─────────────────────────────────────────────────────────────

const CURRICULUM_OPTIONS = [
  { value: "Nigerian National Curriculum", label: "🇳🇬 Nigerian National Curriculum" },
  { value: "WAEC / NECO Aligned", label: "📋 WAEC / NECO Aligned" },
  { value: "Cambridge International", label: "🌍 Cambridge International" },
  { value: "IB (International Baccalaureate)", label: "🎓 IB Curriculum" },
  { value: "American Common Core", label: "🇺🇸 American Common Core" },
];

const SCHOOL_LEVEL_OPTIONS = [
  { value: "Eyfs", label: "Early Years Foundation Stage" },
  { value: "Primary", label: "Primary School" },
  { value: "JSS", label: "Junior Secondary (JSS)" },
  { value: "SSS", label: "Senior Secondary (SSS)" },
  { value: "College", label: "College / University" },
];

const GRADE_BY_LEVEL: Record<string, string[]> = {
  Eyfs: [ "Playclass", "Nursery 1", "Nursery 2", "Nursery 3"],
  Primary: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  JSS: ["JSS 1", "JSS 2", "JSS 3"],
  SSS: ["SSS 1", "SSS 2", "SSS 3"],
  College: ["100 Level", "200 Level", "300 Level", "400 Level"],
};

const SUBJECT_OPTIONS = [
  "Mathematics", "English Language", "Biology", "Chemistry", "Physics",
  "Agricultural Science", "Economics", "Government", "Literature in English",
  "History", "Geography", "Civic Education", "CRS", "IRS", "Further Mathematics",
  "Computer Science", "Technical Drawing", "Commerce", "Accounting",
  "French", "Yoruba", "Igbo", "Hausa", "Fine Arts", "Music", "Other",
  "Basic science", "Basic Technology", "Business Studies", "Health Education",
  "Physical and Health Education", "Social Studies", "Home Economics",
  "Financial Literacy", "Entrepreneurship", "Literature in Nigerian Languages",
  "Trade subject"
];

const DURATION_OPTIONS = [
  { value: "20min", label: "20 mins", desc: "~7 slides", credits: 2 },
  { value: "45min", label: "45 mins", desc: "~10 slides", credits: 2 },
  { value: "60min", label: "60 mins", desc: "~12 slides", credits: 2 },
];

const TONE_OPTIONS = [
  { value: "Engaging & Fun", label: "Engaging & Fun", icon: "🎉", desc: "Energetic, interactive, student-centred" },
  { value: "Formal & Academic", label: "Formal & Academic", icon: "📚", desc: "Structured, professional, exam-ready" },
  { value: "Socratic", label: "Socratic", icon: "💬", desc: "Question-led, discussion-focused" },
  { value: "Storytelling", label: "Storytelling", icon: "📖", desc: "Narrative-driven, memorable hooks" },
];

const BLOOM_OPTIONS = [
  { value: "Remember", icon: "🧠", desc: "Recall facts and basic concepts" },
  { value: "Understand", icon: "💡", desc: "Explain ideas and concepts" },
  { value: "Apply", icon: "🔧", desc: "Use knowledge in new situations" },
  { value: "Analyze", icon: "🔍", desc: "Draw connections, break down info" },
  { value: "Evaluate", icon: "⚖️", desc: "Justify decisions and positions" },
  { value: "Create", icon: "✨", desc: "Produce original work or ideas" },
];

const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  Mathematics: ["Quadratic Equations", "Fractions", "Statistics", "Trigonometry", "Probability"],
  Biology: ["Photosynthesis", "Cell Structure", "Genetics", "Ecology", "Reproduction"],
  Chemistry: ["Atomic Structure", "Chemical Bonding", "Electrolysis", "Acids & Bases"],
  Physics: ["Newton's Laws", "Electricity", "Wave Motion", "Light & Optics"],
  Economics: ["Supply and Demand", "Inflation", "Market Structures", "National Income"],
  English: ["Essay Writing", "Comprehension", "Speech Writing", "Literary Devices"],
  Geography: ["Population Distribution", "Climate Change", "Map Reading", "Rivers"],
  History: ["Pre-colonial Nigeria", "Independence Movement", "World War II"],
};

// Loading steps shown during generation
const LOADING_STEPS = [
  { id: "outline", label: "Planning lesson structure", icon: "📋" },
  { id: "objectives", label: "Writing learning objectives", icon: "🎯" },
  { id: "content", label: "Building slide content", icon: "📝" },
  { id: "examples", label: "Crafting worked examples", icon: "✏️" },
  { id: "activities", label: "Adding classroom activities", icon: "👩‍🏫" },
  { id: "images", label: "Sourcing real images", icon: "🖼️" },
  { id: "review", label: "Reviewing for accuracy", icon: "✅" },
];

type FormData = {
  topic: string;
  grade: string;
  subject: string;
  duration: "20min" | "45min" | "60min";
  tone: string;
  bloom: string;
  curriculum: string;
  schoolLevel: string;
};

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

export default function LessonSlidesPage() {
  const supabase = createBrowserSupabase();

  const [formData, setFormData] = useState<FormData>({
    topic: "",
    grade: "",
    subject: "",
    duration: "45min",
    tone: "Engaging & Fun",
    bloom: "Understand",
    curriculum: "Nigerian National Curriculum",
    schoolLevel: "SSS",
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const SLIDES_CREDIT_COST = 2;
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<SlideDeck | null>(null);

  useEffect(() => {
    // reset grade when school level changes
    setFormData((prev) => ({ ...prev, grade: "" }));
  }, [formData.schoolLevel]);

  // Animate loading steps during generation
  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const interval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const gradeOptions = GRADE_BY_LEVEL[formData.schoolLevel] ?? [];
  const topicSuggestions = TOPIC_SUGGESTIONS[formData.subject] ?? [];
  const selectedDuration = DURATION_OPTIONS.find((d) => d.value === formData.duration)!;
  const canSubmit = !loading && !!formData.topic && !!formData.subject && !!formData.grade;

  const getDeckFromResponse = (payload: unknown): SlideDeck | null => {
    if (!isRecord(payload)) return null;

    const data = payload.data;
    const candidate = payload.deck ?? (isRecord(data) ? data.deck ?? data : data);

    return isRecord(candidate) && Array.isArray(candidate.slides) && candidate.slides.length
      ? (candidate as SlideDeck)
      : null;
  };

  const getLessonIdFromResponse = (payload: unknown): string => {
    if (!isRecord(payload)) return "";
    if (typeof payload.lessonId === "string") return payload.lessonId;

    const data = payload.data;
    return isRecord(data) && typeof data.lessonId === "string" ? data.lessonId : "";
  };

  const getResponseError = (payload: unknown): string | null => {
    if (!isRecord(payload)) return null;
    if (typeof payload.message === "string") return payload.message;
    return typeof payload.error === "string" ? payload.error : null;
  };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  setDeck(null);
  setLoadingStep(0);

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

    const parsedResponse = await readJsonResponse(res);
    const json: unknown = parsedResponse.data ?? {};
    if (parsedResponse.parseError) {
      setError(getInvalidJsonMessage(res));
      return;
    }

    if (!res.ok) {
      const status = res.status;

      if (status === 402 && isRecord(json) && json.errorCode === "needs_personal_confirmation") {
        setLoading(false);
        const cost = typeof json.cost === "number" ? json.cost : "the required";
        const personalCreditsAvailable =
          typeof json.personalCreditsAvailable === "number"
            ? json.personalCreditsAvailable
            : "available";
        const confirmed = window.confirm(
          `Your school has run out of credits.\n\nUse your personal credits instead?\n\nThis will use ${cost} of your ${personalCreditsAvailable} personal credits.`
        );

        if (!confirmed) {
          setError("Generation cancelled.");
          return;
        }

        setLoading(true);
        setError(null);

        const retryRes = await fetch("/api/generate-slides", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...formData,
            usePersonalCredits: true,
          }),
        });

        const retryParsedResponse = await readJsonResponse(retryRes);
        if (retryParsedResponse.parseError) {
          throw new Error(getInvalidJsonMessage(retryRes));
        }
        const retryJson = retryParsedResponse.data ?? {};

        if (!retryRes.ok) {
          throw new Error(getResponseError(retryJson) || "Failed to generate slides");
        }

        const retryDeck = getDeckFromResponse(retryJson);
        if (!retryDeck) {
          throw new Error("Slides generated but preview failed to load. Check your library.");
        }

        try { sessionStorage.removeItem("lessonforge_library_cache"); } catch {}
        const retryLessonId = getLessonIdFromResponse(retryJson);
        const enrichedRetryDeck = await enrichGeneratedLessonImages(
          session.access_token,
          retryLessonId,
          retryDeck,
          "lesson-slides"
        );
        setDeck(enrichedRetryDeck);
        track("lesson_slides_generated", {
          user_role: "teacher",
          active_role: "teacher",
          credit_source: "personal",
          credits_cost: SLIDES_CREDIT_COST,
          subject: formData.subject,
          school_level: formData.schoolLevel,
          curriculum: formData.curriculum,
          generation_type: "lesson_slides",
        });
        return;
      }

      if (status === 402) {
        throw new Error("Not enough credits. Please upgrade your plan.");
      }

      if (status === 401) {
        throw new Error("Session expired. Please login again.");
      }

      throw new Error(getResponseError(json) || "Failed to generate slides");
    }

    try { sessionStorage.removeItem("lessonforge_library_cache"); } catch {}
    const generatedDeck = getDeckFromResponse(json);
    if (!generatedDeck) {
      throw new Error("Slides generated but preview failed to load. Check your library.");
    }

    const lessonId = getLessonIdFromResponse(json);
    const enrichedDeck = await enrichGeneratedLessonImages(
      session.access_token,
      lessonId,
      generatedDeck,
      "lesson-slides"
    );
    setDeck(enrichedDeck);
    track("lesson_slides_generated", {
      user_role: "teacher",
      active_role: "teacher",
      credits_cost: SLIDES_CREDIT_COST,
      subject: formData.subject,
      school_level: formData.schoolLevel,
      curriculum: formData.curriculum,
      generation_type: "lesson_slides",
    });

  } catch (err) {
    const message =
      err instanceof DOMException && err.name === "AbortError"
        ? "Slide generation timed out in the browser. Please try again or check your library."
        : err instanceof Error
        ? err.message
        : "Something went wrong";
    setError(message);
  } finally {
    setLoading(false);
  }
};

  // ── Loading screen ──────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#FAF9F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'Trebuchet MS', sans-serif",
        }}
      >
        <div style={{ maxWidth: "440px", width: "100%", textAlign: "center" }}>
          {/* Pulsing graduation cap */}
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #534AB7, #3D35A0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              margin: "0 auto 24px",
              boxShadow: "0 8px 32px rgba(83,74,183,0.3)",
              animation: "lf-pulse 2s ease-in-out infinite",
            }}
          >
            🎓
          </div>

          <h2
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "22px",
              fontWeight: "700",
              color: "#1E1B4B",
              marginBottom: "6px",
            }}
          >
            Building your lesson deck
          </h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "36px" }}>
            {formData.topic} · {formData.subject} · {formData.grade}
          </p>

          {/* Progress steps */}
          <div style={{ textAlign: "left", marginBottom: "32px" }}>
            {LOADING_STEPS.map((step, i) => {
              const done = i < loadingStep;
              const active = i === loadingStep;
              return (
                <div
                  key={step.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 16px",
                    borderRadius: "10px",
                    marginBottom: "4px",
                    background: active
                      ? "rgba(83,74,183,0.08)"
                      : done
                      ? "rgba(5,150,105,0.05)"
                      : "transparent",
                    transition: "all 0.3s ease",
                    opacity: i > loadingStep + 1 ? 0.35 : 1,
                  }}
                >
                  <span style={{ fontSize: "16px", minWidth: "20px" }}>
                    {done ? "✅" : step.icon}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: active ? "600" : "400",
                      color: done ? "#059669" : active ? "#534AB7" : "#94A3B8",
                      transition: "all 0.3s",
                    }}
                  >
                    {step.label}
                    {active && (
                      <span
                        style={{
                          display: "inline-block",
                          marginLeft: "6px",
                          animation: "lf-dots 1.2s infinite",
                        }}
                      >
                        ...
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: "5px",
              borderRadius: "100px",
              background: "#EEEDFE",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: "100px",
                background: "linear-gradient(90deg, #534AB7, #7C75D4)",
                width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%`,
                transition: "width 0.8s ease",
              }}
            />
          </div>
          <p style={{ fontSize: "11px", color: "#CBD5E1", marginTop: "10px" }}>
            This usually takes 15–25 seconds
          </p>
        </div>

        <style>{`
          @keyframes lf-pulse {
            0%, 100% { box-shadow: 0 8px 32px rgba(83,74,183,0.3); transform: scale(1); }
            50% { box-shadow: 0 8px 48px rgba(83,74,183,0.5); transform: scale(1.05); }
          }
          @keyframes lf-dots {
            0%, 20% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ── Deck result ─────────────────────────────────────────
  if (deck) {
    return <SlideViewer deck={deck} />;
  }

  // ── Form ────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAF9F6",
        fontFamily: "'Trebuchet MS', sans-serif",
        padding: "40px 20px 80px",
      }}
    >
      <style>{`
        @keyframes lf-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lf-card { animation: lf-slide-up 0.45s ease both; }
        .lf-card:nth-child(2) { animation-delay: 0.05s; }
        .lf-card:nth-child(3) { animation-delay: 0.1s; }
        .lf-card:nth-child(4) { animation-delay: 0.15s; }
        .lf-card:nth-child(5) { animation-delay: 0.2s; }
        .lf-input { transition: all 0.18s ease; }
        .lf-input:focus {
          border-color: #534AB7 !important;
          box-shadow: 0 0 0 3px rgba(83,74,183,0.14) !important;
          outline: none;
        }
        .lf-tone-btn { transition: all 0.18s ease; cursor: pointer; }
        .lf-tone-btn:hover { border-color: #534AB7 !important; background: #FAFAFE !important; }
        .lf-bloom-btn { transition: all 0.18s ease; cursor: pointer; }
        .lf-bloom-btn:hover { border-color: #534AB7 !important; background: #FAFAFE !important; }
        .lf-duration-btn { transition: all 0.18s ease; cursor: pointer; }
        .lf-duration-btn:hover { border-color: #534AB7 !important; }
        .lf-tag { transition: all 0.15s ease; cursor: pointer; }
        .lf-tag:hover { background: #EEEDFE !important; color: #534AB7 !important; border-color: #534AB7 !important; }
        .lf-submit { transition: all 0.2s ease; }
        .lf-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(83,74,183,0.45) !important; }
        .lf-submit:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      <div style={{ maxWidth: "660px", margin: "0 auto" }}>

        {/* ── Page header ─────────────────────────────── */}
        <div className="lf-card" style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#EEEDFE",
              border: "1px solid rgba(83,74,183,0.2)",
              borderRadius: "100px",
              padding: "4px 12px",
              marginBottom: "14px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#534AB7", letterSpacing: "1.5px" }}>
              LESSON SLIDES · 2 CREDITS
            </span>
          </div>

          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(24px, 4vw, 32px)",
              fontWeight: "700",
              color: "#1E1B4B",
              lineHeight: "1.2",
              marginBottom: "8px",
            }}
          >
            Create Lesson Slides
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B", maxWidth: "480px", lineHeight: "1.6" }}>
            Generate a complete, classroom-ready slide deck with teacher notes, 
            differentiation, real images, and exit tickets — in under 30 seconds.
          </p>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── SECTION 1: Curriculum ────────────────── */}
          <Section
            number="01"
            title="Curriculum & Level"
            subtitle="We align every slide to your specific curriculum"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Curriculum</FieldLabel>
                <select
                  value={formData.curriculum}
                  onChange={(e) => update("curriculum", e.target.value)}
                  className="lf-input"
                  style={selectStyle}
                >
                  {CURRICULUM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>School Level</FieldLabel>
                <select
                  value={formData.schoolLevel}
                  onChange={(e) => update("schoolLevel", e.target.value)}
                  className="lf-input"
                  style={selectStyle}
                >
                  {SCHOOL_LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Grade / Class</FieldLabel>
                <select
                  value={formData.grade}
                  onChange={(e) => update("grade", e.target.value)}
                  required
                  className="lf-input"
                  style={selectStyle}
                >
                  <option value="">Select class...</option>
                  {gradeOptions.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          {/* ── SECTION 2: Topic & Subject ───────────── */}
          <Section
            number="02"
            title="Topic & Subject"
            subtitle="What are you teaching today?"
          >
            <div style={{ marginBottom: "14px" }}>
              <FieldLabel>Subject</FieldLabel>
              <select
                value={formData.subject}
                onChange={(e) => update("subject", e.target.value)}
                required
                className="lf-input"
                style={selectStyle}
              >
                <option value="">Select subject...</option>
                {SUBJECT_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Lesson Topic</FieldLabel>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => update("topic", e.target.value)}
                placeholder="e.g., Photosynthesis, Quadratic Equations, Supply and Demand"
                required
                className="lf-input"
                style={{
                  ...inputStyle,
                  fontSize: "15px",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontWeight: formData.topic ? "600" : "400",
                  color: formData.topic ? "#1E1B4B" : undefined,
                }}
              />

              {/* Topic suggestions */}
              {topicSuggestions.length > 0 && (
                <div style={{ marginTop: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#94A3B8", marginRight: "8px" }}>
                    Quick picks:
                  </span>
                  {topicSuggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update("topic", t)}
                      className="lf-tag"
                      style={{
                        display: "inline-block",
                        margin: "0 4px 4px 0",
                        padding: "3px 10px",
                        borderRadius: "100px",
                        border: "1px solid #E2E8F0",
                        background: formData.topic === t ? "#EEEDFE" : "#fff",
                        color: formData.topic === t ? "#534AB7" : "#475569",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: "pointer",
                        borderColor: formData.topic === t ? "#534AB7" : "#E2E8F0",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── SECTION 3: Duration ──────────────────── */}
          <Section
            number="03"
            title="Lesson Duration"
            subtitle="We'll generate the right number of slides for your period"
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {DURATION_OPTIONS.map((d) => {
                const active = formData.duration === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => update("duration", d.value as FormData["duration"])}
                    className="lf-duration-btn"
                    style={{
                      padding: "16px 12px",
                      borderRadius: "14px",
                      border: active ? "2px solid #534AB7" : "1.5px solid #E2E8F0",
                      background: active ? "#EEEDFE" : "#fff",
                      textAlign: "center",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      fontSize: "18px",
                      fontWeight: "800",
                      color: active ? "#534AB7" : "#1E1B4B",
                      fontFamily: "Georgia, serif",
                    }}>
                      {d.label}
                    </div>
                    <div style={{ fontSize: "11px", color: active ? "#534AB7" : "#94A3B8", marginTop: "3px" }}>
                      {d.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── SECTION 4: Tone ──────────────────────── */}
          <Section
            number="04"
            title="Teaching Tone"
            subtitle="How should your slides feel and sound?"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {TONE_OPTIONS.map((t) => {
                const active = formData.tone === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => update("tone", t.value)}
                    className="lf-tone-btn"
                    style={{
                      padding: "14px 16px",
                      borderRadius: "14px",
                      border: active ? "2px solid #534AB7" : "1.5px solid #E2E8F0",
                      background: active ? "#EEEDFE" : "#fff",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "20px", flexShrink: 0, marginTop: "1px" }}>{t.icon}</span>
                    <div>
                      <div style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: active ? "#534AB7" : "#1E1B4B",
                      }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: "11px", color: active ? "#7C75D4" : "#94A3B8", marginTop: "2px" }}>
                        {t.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── SECTION 5: Bloom's level ─────────────── */}
          <Section
            number="05"
            title="Bloom's Taxonomy Level"
            subtitle="Set the cognitive depth of the lesson"
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {BLOOM_OPTIONS.map((b) => {
                const active = formData.bloom === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => update("bloom", b.value)}
                    className="lf-bloom-btn"
                    style={{
                      padding: "12px 10px",
                      borderRadius: "12px",
                      border: active ? "2px solid #534AB7" : "1.5px solid #E2E8F0",
                      background: active ? "#EEEDFE" : "#fff",
                      textAlign: "center",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "18px", marginBottom: "4px" }}>{b.icon}</div>
                    <div style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      color: active ? "#534AB7" : "#1E1B4B",
                    }}>
                      {b.value}
                    </div>
                    <div style={{ fontSize: "10px", color: active ? "#7C75D4" : "#94A3B8", marginTop: "2px", lineHeight: "1.3" }}>
                      {b.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── What you'll get preview ───────────────── */}
          {formData.topic && formData.subject && formData.grade && (
            <div
              className="lf-card"
              style={{
                background: "linear-gradient(135deg, #EEEDFE, #F5F3FF)",
                border: "1px solid rgba(83,74,183,0.2)",
                borderRadius: "16px",
                padding: "20px 22px",
                marginBottom: "20px",
                animation: "lf-slide-up 0.35s ease both",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#534AB7", letterSpacing: "1.5px", marginBottom: "12px" }}>
                YOUR DECK WILL INCLUDE
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { icon: "📋", text: "Lesson plan slide" },
                  { icon: "🎯", text: "Learning objectives" },
                  { icon: "📖", text: "Vocabulary terms" },
                  { icon: "✏️", text: "Worked examples" },
                  { icon: "❓", text: "Check for understanding" },
                  { icon: "💬", text: "Discussion prompt" },
                  { icon: "🌍", text: "Real-world connection" },
                  { icon: "🖼️", text: "Real stock images" },
                  { icon: "👩‍🏫", text: "Teacher notes per slide" },
                  { icon: "🎟️", text: "Exit ticket" },
                ].map((item) => (
                  <div key={item.text} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px" }}>{item.icon}</span>
                    <span style={{ fontSize: "12px", color: "#534AB7", fontWeight: "500" }}>{item.text}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "14px",
                  borderTop: "1px solid rgba(83,74,183,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "12px", color: "#7C75D4" }}>
                  <strong style={{ color: "#534AB7" }}>{formData.topic}</strong>
                  {" · "}{formData.subject}
                  {" · "}{formData.grade}
                  {" · "}{selectedDuration.desc}
                </span>
              </div>
            </div>
          )}

          {/* ── Error ────────────────────────────────── */}
          {error && (
            <div
              style={{
                background: "#FFF5F5",
                border: "1px solid #FCA5A5",
                borderRadius: "12px",
                padding: "14px 18px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                animation: "lf-slide-up 0.3s ease",
              }}
            >
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <span style={{ fontSize: "13px", color: "#B91C1C", fontWeight: "500" }}>{error}</span>
            </div>
          )}

          {/* ── Submit ───────────────────────────────── */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="lf-submit"
            style={{
              width: "100%",
              padding: "16px 24px",
              borderRadius: "14px",
              border: "none",
              background: canSubmit
                ? "linear-gradient(135deg, #534AB7, #3D35A0)"
                : "#E2E8F0",
              color: canSubmit ? "#fff" : "#94A3B8",
              fontSize: "15px",
              fontWeight: "700",
              fontFamily: "'Trebuchet MS', sans-serif",
              cursor: canSubmit ? "pointer" : "not-allowed",
              boxShadow: canSubmit ? "0 4px 16px rgba(83,74,183,0.35)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "18px" }}>🎓</span>
            Generate Lesson Slides
            <span
              style={{
                background: "rgba(255,255,255,0.2)",
                borderRadius: "100px",
                padding: "2px 10px",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              2 credits
            </span>
          </button>

          <p style={{ textAlign: "center", fontSize: "11px", color: "#CBD5E1", marginTop: "12px" }}>
            🔒 Secured · Images sourced from Pexels · Teacher notes included on every slide
          </p>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="lf-card"
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: "20px",
        padding: "24px",
        marginBottom: "16px",
        boxShadow: "0 2px 12px rgba(83,74,183,0.05)",
      }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #534AB7, #3D35A0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "800", color: "#fff", letterSpacing: "0.5px" }}>
            {number}
          </span>
        </div>
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: "700",
              color: "#1E1B4B",
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>{subtitle}</div>
        </div>
      </div>

      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: "700",
        color: "#64748B",
        letterSpacing: "1px",
        marginBottom: "6px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

// Shared styles
const baseFieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1.5px solid #E2E8F0",
  background: "#FAFAFA",
  color: "#1E1B4B",
  fontSize: "14px",
  fontFamily: "'Trebuchet MS', sans-serif",
  boxSizing: "border-box",
};

const inputStyle: React.CSSProperties = { ...baseFieldStyle };
const selectStyle: React.CSSProperties = { ...baseFieldStyle, cursor: "pointer" };
