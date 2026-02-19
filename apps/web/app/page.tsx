"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { youtubeSearchUrl } from "@/lib/media";
import SlideImage from "@/components/SlideImage";
import { track } from "@/lib/analytics";

type LessonResult = any;

export default function Home() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [subject, setSubject] = useState("Chemistry");
  const [topic, setTopic] = useState("Solutions");
  const [grade, setGrade] = useState("11");
  const [curriculum, setCurriculum] = useState("Cambridge / WAEC-friendly");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ===== EXPORT STATE =====
const [exporting, setExporting] = useState<null | "pdf" | "pptx">(null);
const [exportError, setExportError] = useState<string | null>(null);

// ===== EXPORT HELPERS =====
function filenameFromHeaders(res: Response, fallback: string) {
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

async function handleExport(kind: "pdf" | "pptx") {
  try {
    setExportError(null);
    setExporting(kind);

    if (!result) throw new Error("Generate a lesson first");

    const res = await fetch(`/api/export/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson: result }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Export failed (${res.status})`);
    }

    const blob = await res.blob();
    const filename = filenameFromHeaders(
      res,
      `LessonForge-${Date.now()}.${kind}`
    );
    function simplify(q: string) {
  return (q || "education classroom")
    .toLowerCase()
    .replace(/\b(diagram|labeled|labelled|with|of|showing|explain)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
}

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    setExportError(e?.message ?? "Export failed");
  } finally {
    setExporting(null);
  }
}

  // Auth state
  useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const { data, error } = await supabase.auth.getUser();

      // If refresh token is invalid, clear and continue as guest
      if (error?.message?.toLowerCase().includes("refresh token")) {
        await supabase.auth.signOut(); // clears bad tokens
      }

      if (!alive) return;
      setUser(data?.user ?? null);
    } catch (e) {
      // swallow errors and continue as guest
      if (!alive) return;
      setUser(null);
    } finally {
      if (!alive) return;
      setAuthChecked(true); // ✅ always ends loading
    }
  })();

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
    setAuthChecked(true);
  });

  return () => {
    alive = false;
    sub.subscription.unsubscribe();
  };
}, [supabase]);

  // Rocket animations replacement: nav-load + reveal on scroll
  useEffect(() => {
    // nav load
    const nav = document.querySelector(".nav-load");
    setTimeout(() => nav?.classList.add("loaded"), 80);

    // reveal
    const els = Array.from(document.querySelectorAll(".reveal"));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("active");
        });
      },
      { threshold: 0.15 }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

   if (!authChecked) {
  return <div className="min-h-screen grid place-items-center">Loading…</div>;
} 
  async function exportFile(kind: "pdf" | "pptx") {
  if (!result) return;

  try {
    const lesson = {
      meta: { subject, topic, grade, curriculum, durationMins: 40 },
      objectives: result.objectives ?? [],
      lessonNotes: result.lessonNotes ?? "",
      slides: result.slides ?? [],
      quiz: result.quiz ?? null,
      liveApplications: result.liveApplications ?? [],
    };

    const res = await fetch(`/api/export/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson,
        filename: `LessonForge-${subject}-${topic}.${kind}`,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(`Export failed (${res.status}): ${msg}`);
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `LessonForge-${subject}-${topic}.${kind}`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    alert(`Export error: ${e?.message ?? String(e)}`);
  }
}
async function downloadPdf() {
  if (!result) return;

  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lesson: result, // your PDF route expects { lesson: LessonPack }
      filename: `LessonForge-${Date.now()}.pdf`,
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => null);
    alert(j?.error || j?.message || "PDF export failed");
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `LessonForge-${Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
async function downloadPptx() {
  if (!result) return;

  const res = await fetch("/api/export/pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meta: result?.meta,
      slides: result?.slides, // your pptx route expects { meta, slides }
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => null);
    alert(j?.error || j?.message || "PPTX export failed");
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `LessonForge-${Date.now()}.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaveMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

const res = await fetch("/api/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  },
  body: JSON.stringify({ subject, topic, grade, curriculum, durationMins: 40 }),
});

     track("generate_lesson", { subject, topic, grade, curriculum });
      const json = await res.json();
      if (!res.ok) {
  const details =
    json?.message ||
    json?.rawPreview ||
    (typeof json === "string" ? json : JSON.stringify(json, null, 2));

  setError(`${json?.error || "Request failed"} (HTTP ${res.status})\n${details}`);
  return;
}
setResult(json.data);

// 🆕 DEBUG: Log what we got
console.log("📊 Total slides:", json.data?.slides?.length);
console.log("🖼️  Images per slide:", json.data?.slides?.map((s: any, i: number) => `Slide ${i + 1}: ${s.image?.substring(0, 50)}...`));
console.log("📝 MCQ count:", json.data?.quiz?.mcq?.length);
console.log("✍️  Theory count:", json.data?.quiz?.theory?.length);
console.log("📋 First MCQ:", json.data?.quiz?.mcq?.[0]);
console.log("📋 First Theory:", json.data?.quiz?.theory?.[0]);

setResult(json.data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }
  
  async function saveLesson() {
    setSaveMsg(null);

    if (!user) {
      setSaveMsg("Please log in first to save lessons.");
      return;
    }
    if (!result) {
      setSaveMsg("Generate a lesson first.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        subject,
        topic,
        grade,
        curriculum,
        result_json: result,
      };

      const { error } = await supabase.from("lessons").insert(payload);
      track("save_lesson", { subject, topic, grade });
      if (error) throw error;

      setSaveMsg("Saved to your library ✅");
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e?.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  }
  

  return (
    <div className="max-w-[1400px] mx-auto border-x border-slate-200 relative bg-slate-50">
      {/* Vertical grid lines */}
      <div className="absolute inset-0 flex justify-between pointer-events-none z-0 px-6 md:px-10 xl:px-12 w-full h-full">
        <div className="h-full w-[1px] bg-slate-950/5" />
        <div className="h-full w-[1px] bg-slate-950/5 hidden md:block" />
        <div className="h-full w-[1px] bg-slate-950/5 hidden lg:block" />
        <div className="h-full w-[1px] bg-slate-950/5 hidden xl:block" />
        <div className="h-full w-[1px] bg-slate-950/5" />
      </div>

      {/* Header */}
      <header className="flex md:mb-16 md:gap-0 z-10 mb-12 relative gap-x-6 gap-y-6 items-center justify-between px-6 md:px-10 xl:px-12 pt-6 pb-6 border-b border-slate-200 bg-slate-50/95 backdrop-blur-md sticky top-0 nav-load">
        <Link href="/" className="flex items-center gap-2 text-slate-900 group">
          <div className="flex text-white bg-gradient-to-br from-indigo-600 to-violet-600 w-8 h-8 rounded-lg items-center justify-center shadow-lg transition-transform duration-500 group-hover:rotate-[360deg]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">LessonForge</span>
        </Link>

        <nav className="hidden md:flex uppercase text-[10px] font-semibold text-slate-500 tracking-widest bg-white/50 border-slate-300 border rounded-full pt-2.5 pr-6 pb-2.5 pl-6 shadow-sm backdrop-blur-sm gap-x-8 items-center transition-all hover:shadow-md hover:bg-white/80">
          <a href="#features" className="hover:text-slate-900 transition-colors duration-300 relative group">
            Features
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-slate-900 transition-all duration-300 group-hover:w-full" />
          </a>
          <a href="#benefits" className="hover:text-slate-900 transition-colors duration-300 relative group">
            Benefits
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-slate-900 transition-all duration-300 group-hover:w-full" />
          </a>
          <a href="#generator" className="hover:text-slate-900 transition-colors duration-300 relative group">
            Try it
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-slate-900 transition-all duration-300 group-hover:w-full" />
          </a>
        </nav>

        {/* Single auth CTA (no duplicates) */}
        <div className="flex items-center gap-2">
          {!user ? (
            <Link
              href="/login"
              className="flex items-center gap-2 group hover:bg-slate-50 text-xs font-medium text-slate-700 tracking-wide bg-white border border-slate-200 rounded-lg pt-2.5 pr-4 pb-2.5 pl-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="uppercase tracking-wide text-[10px] font-semibold">Login</span>
            </Link>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 group hover:bg-slate-50 text-xs font-medium text-slate-700 tracking-wide bg-white border border-slate-200 rounded-lg pt-2.5 pr-4 pb-2.5 pl-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="uppercase tracking-wide text-[10px] font-semibold">Dashboard</span>
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                }}
                className="flex items-center gap-2 group hover:bg-red-50 text-xs font-medium text-slate-700 tracking-wide bg-white border border-slate-200 rounded-lg pt-2.5 pr-4 pb-2.5 pl-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="uppercase tracking-wide text-[10px] font-semibold">Logout</span>
              </button>
            </>
          )}

          <a
            href="#generator"
            className="flex items-center gap-2 group hover:bg-slate-50 text-xs font-medium text-slate-700 tracking-wide bg-white border border-slate-200 rounded-lg pt-2.5 pr-4 pb-2.5 pl-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="uppercase tracking-wide text-[10px] font-semibold">Get Started</span>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 px-6 md:px-10 xl:px-12 pb-24 pt-12">
        <div className="lg:col-span-7 flex flex-col pt-4 relative justify-center">
          <div className="animate-fade-up inline-flex bg-white/80 w-max rounded-full mb-8 pt-1.5 pr-4 pb-1.5 pl-1.5 shadow-sm backdrop-blur-sm items-center border border-slate-200">
            <div className="flex -space-x-2 mr-3">
              <div className="flex items-center justify-center bg-emerald-500 w-6 h-6 rounded-full border-2 border-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-600 tracking-wide">
              Trusted by <span className="text-slate-900 font-semibold">schools</span> & teachers
            </span>
          </div>
          
        
          <h1 className="animate-fade-up delay-200 leading-[0.95] lg:text-[4.5rem] text-5xl font-semibold text-slate-900 tracking-tighter mb-8">
            Create Curriculum-Aligned Lessons
            <span className="bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500 font-bold block">
              in Minutes
            </span>
          </h1>

          <p className="animate-fade-up delay-300 text-sm text-slate-600 font-normal max-w-lg mb-10 leading-relaxed tracking-wide border-l-2 border-slate-300 pl-6 hover:border-indigo-400 transition-colors duration-500">
            Generate complete lesson packs: objectives, lesson notes, slides, quizzes, and classroom activities.
            Built for Cambridge/WAEC/Nigeria-friendly teaching.
          </p>

          <div className="animate-fade-up delay-400 flex flex-col sm:flex-row gap-3 mb-16">
            <a
              href="#generator"
              className="hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-900/20 transition-all duration-300 flex group text-sm font-medium text-white bg-indigo-600 rounded-full pt-3.5 pr-6 pb-3.5 pl-6 shadow-xl items-center justify-center min-w-[200px]"
            >
              <span className="tracking-tight">Generate Your First Lesson</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform duration-300 ml-3">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>

            <a
              href="#how-it-works"
              className="hover:bg-slate-50 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full pt-3.5 pr-6 pb-3.5 pl-6 shadow-sm items-center justify-center"
            >
              <span className="tracking-tight">See How It Works</span>
            </a>
          </div>

          <div className="animate-fade-up delay-500 flex flex-wrap gap-2 md:gap-6 mt-auto items-center">
            <div className="flex items-center">
              <div className="px-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Time Saved</p>
                <p className="text-sm text-slate-900 font-medium">Fast output</p>
              </div>
              <div className="curve-separator opacity-60 ml-4 md:ml-8" />
            </div>

            <div className="flex items-center">
              <div className="px-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Export</p>
                <p className="text-sm text-slate-900 font-medium">PDF + PPTX</p>
              </div>
              <div className="curve-separator opacity-60 ml-4 md:ml-8" />
            </div>

            <div className="flex items-center">
              <div className="px-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Library</p>
                <p className="text-sm text-slate-900 font-medium">Save lessons</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right visuals (kept, no external assets) */}
        <div className="lg:col-span-5 h-full min-h-[500px] lg:min-h-0 relative group perspective-1000 animate-fade-scale delay-300">
          <div className="absolute inset-0 rounded-[2rem] overflow-hidden bg-gradient-to-br from-indigo-50 via-violet-50 to-slate-50 p-8 flex items-center justify-center">
            <div className="absolute top-8 left-8 w-64 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 p-4 animate-float">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center" />
                <span className="text-xs font-semibold text-slate-900">Lesson Notes</span>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-slate-200 rounded w-full" />
                <div className="h-2 bg-slate-200 rounded w-5/6" />
                <div className="h-2 bg-slate-200 rounded w-4/6" />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-500 font-mono">Objectives + Activities</span>
              </div>
            </div>

            <div className="absolute top-32 right-8 w-56 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 p-4 animate-float delay-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg" />
                <span className="text-xs font-semibold text-slate-900">Slides</span>
              </div>
              <div className="aspect-video bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg flex items-center justify-center">
                <span className="text-xs text-slate-500 font-mono">8–12 slides</span>
              </div>
            </div>

            <div className="absolute bottom-24 left-12 w-60 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 p-4 animate-float delay-500">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg" />
                <span className="text-xs font-semibold text-slate-900">Quiz</span>
              </div>
              <p className="text-xs text-slate-600 mb-3">Auto-generated questions</p>
              <div className="space-y-1">
                <div className="text-[10px] bg-slate-50 rounded px-2 py-1 text-slate-500">MCQ + Theory</div>
                <div className="text-[10px] bg-emerald-50 rounded px-2 py-1 text-emerald-700 border border-emerald-200">Marking guide ✓</div>
              </div>
            </div>

            <div className="absolute bottom-8 right-12 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200 px-4 py-2 animate-float delay-300 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-slate-900">Cambridge / WAEC</span>
            </div>
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-60" />

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 px-6 md:px-10 xl:px-12 py-24 scroll-mt-24">
        <div className="text-center mb-16 reveal">
          <span className="text-xs font-mono uppercase text-slate-500 tracking-widest mb-2 block">Simple Process</span>
          <h2 className="text-4xl md:text-5xl font-medium text-slate-900 tracking-tight mb-4">How It Works</h2>
          <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Three steps to generate a full lesson pack.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
          {[
            { n: 1, title: "Enter Topic & Class", desc: "Choose subject, topic, grade, and curriculum." },
            { n: 2, title: "AI Generates Pack", desc: "Objectives, notes, slides, quiz + activities." },
            { n: 3, title: "Export & Save", desc: "Download PDF/PPTX and save to your library." },
          ].map((x, i) => (
            <div key={i} className={`reveal delay-${(i + 1) * 100} flex flex-col items-center text-center`}>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-lg">
                {x.n}
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">{x.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{x.desc}</p>
            </div>
          ))}
        </div>
      </section>
      
      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-60" />

      {/* Features (kept minimal) */}
      <section id="features" className="relative z-10 px-6 md:px-10 xl:px-12 py-24 scroll-mt-24">
        <div className="mb-16 reveal">
          <span className="text-xs font-mono uppercase text-slate-500 tracking-widest mb-2 block">Everything You Need</span>
          <h2 className="text-4xl md:text-5xl font-medium text-slate-900 tracking-tight mb-4">Key Features</h2>
          <p className="text-slate-600 max-w-2xl leading-relaxed">Built for real classroom work, not just “AI text”.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-hidden shadow-slate-900/5 bg-slate-200 rounded-[2rem] gap-px border border-slate-200">
          <div className="bg-slate-50 p-8 md:col-span-2 hover:bg-white transition-all">
            <h3 className="text-2xl font-semibold text-slate-900 mb-3">Detailed Lesson Notes</h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md">
              Starter, main lesson, plenary, key vocabulary, misconceptions, and assessment prompts.
            </p>
          </div>

          <div className="bg-slate-50 p-8 hover:bg-white transition-all">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Slides</h3>
            <p className="text-sm text-slate-600 leading-relaxed">Auto slide outline + PPTX export.</p>
          </div>

          <div className="bg-slate-50 p-8 hover:bg-white transition-all">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Quiz + Marking Guide</h3>
            <p className="text-sm text-slate-600 leading-relaxed">10 MCQ + 2 theory with marking scheme.</p>
          </div>

          <div className="bg-slate-50 p-8 md:col-span-2 hover:bg-white transition-all">
            <h3 className="text-2xl font-semibold text-slate-900 mb-3">Library</h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md">
              Save lessons to your dashboard and reuse anytime.
            </p>
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-60" />

      {/* BENEFITS */}
      <section id="benefits" className="relative z-10 px-6 md:px-10 xl:px-12 py-24 scroll-mt-24">
        <div className="text-center mb-16 reveal">
          <span className="text-xs font-mono uppercase text-slate-500 tracking-widest mb-2 block">Why Schools Choose It</span>
          <h2 className="text-4xl md:text-5xl font-medium text-slate-900 tracking-tight mb-4">Benefits</h2>
          <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Better prep, faster planning, more consistency across teachers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            { k: "80%", t: "Time Saved", d: "Cut planning time, keep quality high." },
            { k: "PPTX/PDF", t: "Export Ready", d: "Take it straight to class or share with staff." },
            { k: "Library", t: "Reusable", d: "Save, duplicate, edit, and improve over time." },
          ].map((b, i) => (
            <div key={i} className={`reveal delay-${(i + 1) * 100} bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all`}>
              <div className="text-5xl font-bold text-indigo-600 mb-2">{b.k}</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">{b.t}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-60" />

      {/* Testimonials */}
<section id="testimonials" className="relative z-10 px-6 md:px-10 xl:px-12 pb-24 scroll-mt-24">
  <div className="text-center mb-12 reveal">
    <span className="text-xs font-mono uppercase text-slate-500 tracking-widest mb-2 block">
      Teachers Love It
    </span>
    <h2 className="text-4xl md:text-5xl font-medium text-slate-900 tracking-tight mb-4">
      What Educators Say
    </h2>
    <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
      Built with real classroom workflow in mind—speed, structure, and export-ready resources.
    </p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
    {/* Card 1 */}
    <div className="reveal delay-100 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500" />
        <div>
          <div className="font-semibold text-slate-900">Head Teacher</div>
          <div className="text-xs text-slate-500">Private School • Kaduna</div>
        </div>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">
        “The lesson pack is structured the way teachers actually teach. The objectives, notes, and quiz save me hours weekly.”
      </p>
      <div className="mt-4 text-xs text-slate-500">
        ✅ Faster planning • ✅ Better consistency
      </div>
    </div>

    {/* Card 2 */}
    <div className="reveal delay-200 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
        <div>
          <div className="font-semibold text-slate-900">Science Teacher</div>
          <div className="text-xs text-slate-500">Secondary • Cambridge/WAEC</div>
        </div>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">
        “The slide outline is clear and the classroom activities are practical. Exporting to PPTX makes presentation super easy.”
      </p>
      <div className="mt-4 text-xs text-slate-500">
        📊 Slides • 🧠 Activities • 📝 Marking guide
      </div>
    </div>

    {/* Card 3 */}
    <div className="reveal delay-300 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500" />
        <div>
          <div className="font-semibold text-slate-900">Administrator</div>
          <div className="text-xs text-slate-500">Academic Office</div>
        </div>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">
        “The saved lesson library is the best part. Teachers can reuse and improve lessons instead of starting from scratch.”
      </p>
      <div className="mt-4 text-xs text-slate-500">
        📚 Library • 🔁 Reuse • ⚡ Standardization
      </div>
    </div>
  </div>
</section>

      
    {/* Generator (your existing app) */}
<section id="generator" className="relative z-10 px-6 md:px-10 xl:px-12 py-24 scroll-mt-24">
  <div className="max-w-5xl mx-auto space-y-6">
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Generate a Lesson Pack</h2>
        <p className="text-sm text-slate-600 mt-1">
          Type a topic → get lesson plan, notes, slides, quiz + media queries.
        </p>
      </div>

      <div className="flex gap-2">
        {!user ? (
          <Link className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50" href="/login">
            Login to Save
          </Link>
        ) : (
          <Link className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50" href="/dashboard">
            Open Dashboard
          </Link>
        )}
      </div>
    </div>

   <div className="grid gap-4 md:grid-cols-2">
  <label className="space-y-2">
    <span className="text-sm font-medium text-slate-900">Subject</span>
    <input
      className="w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold text-slate-900 placeholder:font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
      placeholder="Chemistry"
      value={subject}
      onChange={(e) => setSubject(e.target.value)}
    />
  </label>

  <label className="space-y-2">
    <span className="text-sm font-medium text-slate-900">Grade / Class</span>
    <input
      className="w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold text-slate-900 placeholder:font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
      placeholder="11"
      value={grade}
      onChange={(e) => setGrade(e.target.value)}
    />
  </label>

  <label className="space-y-2 md:col-span-2">
    <span className="text-sm font-medium text-slate-900">Topic</span>
    <input
      className="w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold text-slate-900 placeholder:font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
      placeholder="Solutions"
      value={topic}
      onChange={(e) => setTopic(e.target.value)}
    />
  </label>

  <label className="space-y-2 md:col-span-2">
    <span className="text-sm font-medium text-slate-900">Curriculum</span>
    <input
      className="w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold text-slate-900 placeholder:font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
      placeholder="Cambridge / WAEC-friendly"
      value={curriculum}
      onChange={(e) => setCurriculum(e.target.value)}
    />
  </label>
</div>

    <button
      onClick={generate}
      disabled={loading}
      className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
    >
      {loading ? "Generating..." : "Generate Lesson Pack"}
    </button>

    <div className="text-xs text-slate-500 leading-relaxed">
      <span className="font-medium text-slate-700">Data privacy:</span>{" "}
      We don’t sell your data. Your saved lessons are stored securely in your private library.
      Avoid entering sensitive student information (names, addresses, results).
    </div>

    <div className="text-xs text-slate-500">
      🔒 Secure auth via Supabase • ✅ Export-ready (PDF/PPTX) • ⚡ Built for real classrooms
    </div>

    {error && (
      <div className="border rounded-2xl p-4 text-red-600 bg-white">
        <b>Error:</b> {error}
      </div>
    )}

    {result && (
      <div className="border rounded-2xl p-6 bg-white space-y-8">
       <section className="space-y-4">
  <h4 className="text-xl font-bold text-slate-900">
    Objectives
  </h4>

  <ul className="list-disc pl-6 space-y-2 text-slate-800">
    {(result.objectives || []).map((x: string, i: number) => (
      <li key={i} className="leading-relaxed font-medium">
        {x}
      </li>
    ))}
  </ul>
</section>

      <section>
  <h4 className="font-semibold text-lg text-slate-900 mb-2">
    Lesson Notes
  </h4>

  <div className="
    whitespace-pre-wrap
    leading-relaxed
    text-slate-800
    text-sm
    bg-white
    border
    border-slate-200
    rounded-xl
    p-4
  ">
    {result.lessonNotes || "No lesson notes generated."}
  </div>
</section>



    {/* Save */}
   <section className="space-y-2">
  <div className="flex flex-wrap gap-3 items-center">
    <button
      onClick={saveLesson}
      disabled={saving}
      type="button"
      className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
    >
      {saving ? "Saving..." : "Save to Library"}
    </button>



    {saveMsg && <div className="text-sm text-slate-700">{saveMsg}</div>}
  </div>

  {exportError && (
    <div className="text-sm text-red-600">{exportError}</div>
  )}

  <p className="text-xs text-slate-500">
    🔒 Exports are generated securely after lesson generation
  </p>
</section>
 
<section className="space-y-4">
  <h4 className="text-xl font-extrabold text-slate-900 tracking-tight">
    Slides (Preview)
  </h4>

  {(result?.slides ?? []).length ? (
    <div className="grid gap-6">
      {(result.slides ?? []).map((s: any, i: number) => {
        const title = s?.title || "Untitled slide";
        const bullets: string[] = Array.isArray(s?.bullets) ? s.bullets : [];
        const videoQuery = s?.videoQuery || title || `${subject} ${topic}`;
        const imageQuery = s?.imageQuery || title || `${subject} ${topic}`;
        const activity = s?.interactivePrompt || "No interactive activity provided.";

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
    src={s?.image || "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200"}
    alt={title}
     className="w-full h-48 object-cover"
    onError={(e) => {
      e.currentTarget.src = "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";
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
{/* ✅ Multiple Choice Questions - Shuffled */}
{result?.quiz?.mcq?.length ? (
  <section className="space-y-4">
    <h4 className="text-2xl font-bold text-slate-900">
      📝 Multiple Choice Questions
    </h4>

    <div className="space-y-6">
      {result.quiz.mcq.map((q: any, i: number) => {
        // 🆕 Shuffle options
        const shuffledOptions = [...(q.options || [])].sort(() => Math.random() - 0.5);
        
        return (
          <div key={i} className="rounded-xl border border-slate-200 p-5 bg-white shadow-sm">
            <p className="font-semibold text-lg mb-3 text-slate-900">
              {i + 1}. {q?.q || q?.question || "Question text missing"}
            </p>
            <ul className="space-y-2">
              {shuffledOptions.map((opt: string, j: number) => (
                <li key={j} className="flex items-start gap-3 text-slate-800">
                  <span className="font-bold text-indigo-600 min-w-[24px]">
                    {String.fromCharCode(65 + j)}.
                  </span>
                  <span>{opt}</span>
                </li>
              ))}
            </ul>
            {/* 🆕 REMOVED: Correct answer display */}
          </div>
        );
      })}
    </div>
  </section>
) : null}
              {/* Theory Questions */}
              {result?.quiz?.theory?.length ? (
                <section className="space-y-4">
                  <h4 className="text-2xl font-bold text-slate-900">
                    ✍️ Theory Questions
                  </h4>

                  <div className="space-y-4">
                    {result.quiz.theory.map((q: any, i: number) => (
                      <div key={i} className="rounded-xl border border-slate-200 p-5 bg-white shadow-sm">
                         <p className="font-semibold text-lg mb-2 text-slate-900">
                          {i + 1}. {q?.q || q?.question || "Question text missing"}
                            </p>
                        {/* 🆕 Only show marking guide if it exists */}
          {q?.markingGuide && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-1">Marking Guide:</p>
              <p className="text-sm text-slate-600">{q.markingGuide}</p>
                </div>
                  )}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
      </div>
    )}
  </div>
</section>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-10 xl:px-12 py-12 border-t border-slate-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex text-white bg-gradient-to-br from-indigo-600 to-violet-600 w-8 h-8 rounded-lg items-center justify-center shadow-lg" />
            <span className="text-sm font-semibold tracking-tight text-slate-900">LessonForge</span>
            <span className="text-xs text-slate-500 ml-2">© 2026</span>
          </div>

          <div className="flex items-center gap-8 text-sm">
            <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#benefits" className="text-slate-600 hover:text-slate-900 transition-colors">Benefits</a>
            <a href="#generator" className="text-slate-600 hover:text-slate-900 transition-colors">Try it</a>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-700 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-700 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
       </div>
  );
}

function setCheckingAuth(arg0: boolean) {
  throw new Error("Function not implemented.");
}
