import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;


type GeneratePayload = {
  subject: string;
  topic: string;
  grade: string;
  curriculum?: string;
  durationMins?: number;
  user_id?: string;
};

function buildUserInstructions(input: GeneratePayload) {
  const curriculum = input.curriculum ?? "General (Nigeria-friendly)";
  const durationMins = input.durationMins ?? 40;

  return `
Return STRICT JSON only. No markdown. No backticks. No extra text.

Audience: Grade ${input.grade}
Subject: ${input.subject}
Topic: ${input.topic}
Curriculum: ${curriculum}
Duration: ${durationMins} minutes

You MUST output JSON with exactly this shape:
{
  "meta": { "subject": "", "topic": "", "grade": "", "curriculum": "", "durationMins": 40 },
  "objectives": ["..."],
  "lessonNotes": "....",
  "slides": [
    { "title": "", "bullets": ["","","",""], "imageQuery": "", "videoQuery": "", "interactivePrompt": "" }
  ],
  "quiz": {
    "mcq": [
      { "q": "What is photosynthesis?", "options": ["Process plants use to make food", "Animal respiration", "Water absorption", "Soil formation"], "answerIndex": 0 }
    ],
    "theory": [
      { "q": "Explain ...", "markingGuide": "..." }
    ]
  },
  "liveApplications": ["..."]
}

Hard requirements:
- objectives: 6–10 items.
- slides: 8–12 slides (content slides).
- each slide bullets: 4–8 bullets, short & learner-friendly.
- each slide MUST include:
  * imageQuery: 2-3 words for finding educational images (e.g., "photosynthesis diagram", "cell structure", "math fractions")
  * videoQuery: search terms for educational videos
  * interactivePrompt: engaging question or activity
- quiz.mcq: exactly 10 multiple choice questions
  * Each question MUST have:
    - q: the question text
    - options: array of EXACTLY 4 option strings (full sentences, not just "A", "B", "C", "D")
    - answerIndex: number 0-3 indicating correct answer (0=first option, 1=second, etc.)
  * Example: {"q": "What is the powerhouse of the cell?", "options": ["Mitochondria", "Nucleus", "Ribosome", "Chloroplast"], "answerIndex": 0}
- quiz.theory: exactly 2 questions, each with a markingGuide.
- liveApplications: 3–6 items.

LessonNotes requirements (VERY IMPORTANT):
- 900–1400 words (do NOT write less).
- Use these plain-text headings exactly:
  1) Introduction
  2) Key Concepts
  3) Teacher Script (what teacher says + what learners do)
  4) Worked Examples (at least 2, step-by-step)
  5) Common Misconceptions (at least 3) + corrections
  6) Real-life Applications (at least 3, Nigeria-friendly where possible)
  7) Differentiation (Support / Core / Stretch)
  8) Summary (5–8 bullet points)
  9) Exit Ticket (3 short questions)
  10) Homework/Practice (10 questions)
  11) Key Vocabulary (at least 8 terms with meanings)

Keep it classroom-ready, Cambridge/WAEC friendly, and Nigeria-relevant.

Return JSON only.
`.trim();
}

async function fetchUnsplashImage(
  query: string,
  subject: string,
  topic: string,
  slideIndex: number = 0
): Promise<string> {
  const key = process.env.UNSPLASH_ACCESS_KEY;

  const fallbackImages = [
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200",
    "https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=1200",
    "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=1200",
    "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200",
    "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=1200",
    "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1200",
    "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200",
    "https://images.unsplash.com/photo-1582719471137-c3967ffb1c42?w=1200",
    "https://images.unsplash.com/photo-1581595220892-b0739db3ba8c?w=1200",
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200",
  ];

  const fallback = fallbackImages[slideIndex % fallbackImages.length];

  if (!key) {
    console.warn("⚠️  UNSPLASH_ACCESS_KEY missing, using fallback");
    return fallback;
  }

  try {
    // Build query: subject + slide-specific hint + extra bias words
    const raw = `${subject} ${query || topic} classroom education`.trim();

    const cleaned = raw
      .toLowerCase()
      .replace(/\b(with|of|the|a|an|in|on|at)\b/gi, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 7)
      .join(" ");

    console.log(`🔍 Slide ${slideIndex + 1}: Unsplash query="${cleaned}"`);

    const url =
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleaned)}` +
      `&per_page=1&page=${slideIndex + 1}&orientation=landscape&content_filter=high&order_by=relevant`;

    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`❌ Unsplash error ${res.status}: ${text}`);
      return fallback;
    }

    const data = await res.json();
    const imageUrl: string | undefined = data?.results?.[0]?.urls?.regular;

    if (!imageUrl) {
      console.warn(`⚠️  Slide ${slideIndex + 1}: No image URL, using fallback`);
      return fallback;
    }

    return imageUrl;
  } catch (e) {
    console.error(`❌ Slide ${slideIndex + 1}: Unsplash fetch failed`, e);
    return fallback;
  }
}


export async function POST(req: NextRequest) {
  try {
    // 1) Auth header
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized (no token)" }, { status: 401 });
    }
// 2) Supabase client that carries the JWT (so rpc/auth.uid works)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  }
);

// 3) Verify token (now uses header)
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json(
    { error: "Unauthorized (invalid token)", message: authError?.message },
    { status: 401 }
  );
}

    // 4) Parse JSON body safely (no req.text)
    let body: GeneratePayload;
    try {
      body = (await req.json()) as GeneratePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body?.subject || !body?.topic || !body?.grade) {
      return NextResponse.json(
        { error: "Missing required fields: subject, topic, grade" },
        { status: 400 }
      );
    }
   const { data: creditData, error: creditErr } =
  await supabase.rpc("consume_generation_credit");

if (creditErr) {
  // RPC error (rare)
  return NextResponse.json({ error: "Credit check failed", detail: creditErr.message }, { status: 500 });
}

if (!creditData?.ok) {
  const msg = creditData?.error || "No credits";
  const status =
    msg.toLowerCase().includes("not authenticated") ? 401 : 402;

  return NextResponse.json({ error: msg }, { status });
}

// ✅ optional: you can use this to return to UI
const newBalance = creditData.credits_balance as number;


    if (!body?.subject || !body?.topic || !body?.grade) {
      return Response.json(
        { error: "Missing required fields: subject, topic, grade" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log("🎯 Generating lesson for:", body.topic);

   const resp = await client.responses.create({
  model: "gpt-4.1-mini",
  input: [
    {
      role: "system",
      content:
        "Return STRICT valid JSON only. No markdown. No backticks. No explanation text.",
    },
    { role: "user", content: buildUserInstructions(body) },
  ],
  temperature: 0.2,
  max_output_tokens: 6500,

  // ⭐⭐ THIS IS THE CRITICAL FIX ⭐⭐
  text: { format: { type: "json_object" } },
});

    const raw = resp.output_text ?? "";

let data: any;

try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("❌ BAD JSON FROM MODEL:", raw);

  return NextResponse.json(
    { error: "Model returned invalid JSON" },
    { status: 502 }
  );
}



    // ✅ Basic guardrails
    data.meta ??= {};
    data.meta.subject ??= body.subject;
    data.meta.topic ??= body.topic;
    data.meta.grade ??= body.grade;
    data.meta.curriculum ??= body.curriculum ?? "General (Nigeria-friendly)";
    data.meta.durationMins ??= body.durationMins ?? 40;

    // ✅ Ensure slides exists
    data.slides ??= [];

    // ✅ Assign per-slide image
    if (Array.isArray(data.slides) && data.slides.length > 0) {
      for (let i = 0; i < data.slides.length; i++) {
        const slide = data.slides[i];

        // Best available text to guide the image search
        const q =
          slide.imageQuery ||
          slide.image_prompt ||
          slide.title ||
          slide.heading ||
          slide.subtitle ||
          slide.topic ||
          body.topic;

        slide.image = await fetchUnsplashImage(String(q), body.subject, body.topic, i);
      }
    }

    return Response.json({ data }, { status: 200 });
  } catch (err: any) {
    console.error("❌ Generation error:", err);
    return Response.json(
      { error: "Generation failed", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}