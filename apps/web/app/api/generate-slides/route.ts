import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeGenerationCredits, getGenerationCreditAvailability } from "@/lib/credits/server";
import { consumePersonalCreditsDirectly } from "@/lib/credits/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const SLIDES_CREDIT_COST = 2;
const OPENAI_MAX_TOKENS = 7000; // raised from 4000 — prevents truncation on long decks
const OPENAI_MODEL = "gpt-4o";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type Duration = "20min" | "45min" | "60min";

type GenerateSlidesBody = {
  topic: string;
  grade: string;
  subject: string;
  duration: Duration;
  tone: string;
  bloom: string;
  curriculum?: string;   // e.g. "Nigerian National Curriculum", "Cambridge", "WAEC"
  schoolLevel?: string;  // e.g. "Primary", "JSS", "SSS"
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string | null };
  }>;
  error?: { message?: string; type?: string; code?: string };
};

type PexelsPhoto = {
  src?: {
    large2x?: string;
    large?: string;
    medium?: string;
  };
  photographer?: string;
  alt?: string;
};

type PexelsResponse = {
  photos?: PexelsPhoto[];
};

// ─────────────────────────────────────────────────────────────
// PEXELS IMAGE FETCHER
// FREE API — register at pexels.com/api to get your key
// Set PEXELS_API_KEY in your .env file
// No purchase needed. Generous free tier.
// ─────────────────────────────────────────────────────────────

function compressPexelsQuery(input?: string | null, topic?: string, subject?: string) {
  const raw = `${input || ""} ${topic || ""} ${subject || ""}`.toLowerCase();

  const removeWords = new Set([
    "clear","colorful","beautiful","detailed","simple","clean",
    "showing","including","with","that","all","main",
    "visual","guide","picture","image","photo","diagram",
    "labeled","labelled","illustration","educational","real","life","of","the","a","an",
    "organs"
  ]);

  const cleanedWords = raw
    .replace(/[.,;:!?()[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !removeWords.has(w));

  const words = cleanedWords.slice(0, 5);

  return words.join(" ") || topic || subject || "classroom";
}

async function fetchPexelsImage(
  query: string,
  apiKey: string
): Promise<{ url: string; photographer: string; alt: string } | null> {
  try {
   const cleanQuery = query
  .replace(/classroom-?safe|classroom-?friendly|educational style/gi, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 100);

    if (!cleanQuery) return null;

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanQuery)}&per_page=5&orientation=landscape&size=large`;

    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as PexelsResponse;
    const photos = data?.photos;

    if (!Array.isArray(photos) || photos.length === 0) return null;

    const pick = photos[Math.floor(Math.random() * Math.min(3, photos.length))];
    const imageUrl = pick?.src?.large2x ?? pick?.src?.large ?? pick?.src?.medium ?? null;

    if (!imageUrl) return null;

    return {
      url: imageUrl,
      photographer: pick?.photographer ?? "Pexels",
      alt: pick?.alt ?? cleanQuery,
    };
  } catch {
    return null;
  }
}

async function enrichSlidesWithImages(
  slides: any[],
  pexelsKey: string,
  subject: string,
  topic: string
): Promise<any[]> {
  const results = await Promise.allSettled(
    slides.map(async (slide) => {
      const baseQuery = slide?.visual_suggestion ?? slide?.title ?? topic;

      if (!baseQuery) return slide;

      const pexelsQuery = compressPexelsQuery(
        slide.visual_suggestion || slide.imagePrompt || slide.visualPrompt || baseQuery,
        topic,
        subject
      );

      console.log("Original Pexels prompt:", slide.visual_suggestion);
      console.log("Pexels query:", pexelsQuery);

      const image = await fetchPexelsImage(pexelsQuery, pexelsKey);
      if (!image) return slide;

      return {
        ...slide,
        image_url: image.url,
        image_credit: image.photographer,
        image_alt: image.alt,
      };
    })
  );

  return results.map((result, i) =>
    result.status === "fulfilled" ? result.value : slides[i]
  );
}

// ─────────────────────────────────────────────────────────────
// SLIDE COUNT BY DURATION
// ─────────────────────────────────────────────────────────────

function slideCountByDuration(duration: Duration): {
  min: number;
  max: number;
  rule: string;
} {
  const map = {
    "20min": { min: 6, max: 8, rule: "Generate exactly 7 slides." },
    "45min": { min: 10, max: 13, rule: "Generate exactly 11 slides." },
    "60min": { min: 14, max: 18, rule: "Generate exactly 15 slides." },
  };
  return map[duration];
}

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT — EDUCATION-FIRST, OUTPERFORMS GAMMA
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt({
  grade,
  bloom,
  duration,
  tone,
  subject,
  curriculum,
  schoolLevel,
}: {
  grade: string;
  bloom: string;
  duration: Duration;
  tone: string;
  subject: string;
  curriculum?: string;
  schoolLevel?: string;
}): string {
  const { rule: slideCountRule } = slideCountByDuration(duration);
  const curriculumNote = curriculum
    ? `All content MUST align to the ${curriculum} curriculum.`
    : "Align to a standard national curriculum.";
  const schoolNote = schoolLevel ? `School level: ${schoolLevel}.` : "";

  return `
You are a master teacher, instructional designer, and curriculum expert with 20+ years of classroom experience.

Your ONLY job right now is to generate a COMPLETE, CLASSROOM-READY lesson slide deck as a single valid JSON object.

${curriculumNote} ${schoolNote}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE OUTPUT RULES — NEVER BREAK THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Return ONLY a valid JSON object.
2. Do NOT use markdown, code fences, or backticks.
3. Do NOT add explanations before or after the JSON.
4. The entire response must be parseable with JSON.parse().
5. Never truncate mid-object. Complete every slide fully.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT MAKES THIS DECK BETTER THAN ANY OTHER TOOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every slide must include:
- "teacher_notes": What the teacher says OUT LOUD on this slide (2-3 sentences). 
  This is the most important field. It transforms a static slide into a living lesson.
- "time_minutes": How many minutes to spend on this slide (integer).
- "differentiation": {
    "support": "What to do for struggling students on this slide",
    "extension": "What to do for advanced students on this slide"
  }
- "bloom_tag": The specific Bloom's verb this slide addresses (e.g. "recall", "apply", "analyse")
- "visual_suggestion": A vivid, specific description of the ideal image for this slide.
- "visual_type": One of "hero" | "diagram" | "support"

These fields make LessonForge decks UNMATCHED by any generic presentation tool.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOP-LEVEL DECK SHAPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "deck_title": "string",
  "subject": "${subject}",
  "grade": "${grade}",
  "duration_minutes": number,
  "bloom_level": "${bloom}",
  "curriculum": "${curriculum ?? "National Curriculum"}",
  "learning_objectives": ["string", "string", "string"],
  "total_slides": number,
  "slides": Slide[]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE TYPES — USE ONLY THESE 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. TITLE SLIDE
{
  "type": "title",
  "title": "string",
  "subtitle": "string — engaging one-liner about the topic",
  "hook_question": "string — a thought-provoking question to open the lesson",
  "real_world_hook": "string — a relatable real-life connection to grab attention",
  "visual_suggestion": "string",
  "visual_type": "hero",
  "teacher_notes": "string",
  "time_minutes": 2,
  "bloom_tag": "engage",
  "differentiation": { "support": "string", "extension": "string" }
}

2. LEARNING OBJECTIVES SLIDE
{
  "type": "learning_objectives",
  "title": "What You Will Learn Today",
  "objectives": ["By the end of this lesson, students will be able to..."],
  "success_criteria": ["I can...", "I can...", "I can..."],
  "prior_knowledge": "string — what students should already know coming in",
  "visual_suggestion": "string",
  "visual_type": "support",
  "teacher_notes": "string",
  "time_minutes": 2,
  "bloom_tag": "string",
  "differentiation": { "support": "string", "extension": "string" }
}

3. CONCEPT SLIDE
{
  "type": "concept",
  "title": "string",
  "explanation": "string — clear, academically accurate explanation (3-5 sentences)",
  "key_point": "string — single most important thing to remember",
  "analogy": "string — a real-world analogy to make the concept stick",
  "common_misconception": "string — a mistake students often make about this concept",
  "visual_suggestion": "string",
  "visual_type": "diagram",
  "teacher_notes": "string",
  "time_minutes": number,
  "bloom_tag": "string",
  "differentiation": { "support": "string", "extension": "string" }
}

4. VOCABULARY SLIDE
{
  "type": "vocabulary",
  "title": "Key Terms",
  "terms": [
    {
      "word": "string",
      "definition": "string — student-friendly definition",
      "example": "string — example sentence or real-life use",
      "etymology": "string — optional word origin if helpful"
    }
  ],
  "visual_suggestion": "string",
  "visual_type": "support",
  "teacher_notes": "string — how to deliver the vocabulary section",
  "time_minutes": number,
  "bloom_tag": "recall",
  "differentiation": { "support": "string", "extension": "string" }
}

5. WORKED EXAMPLE SLIDE
{
  "type": "worked_example",
  "title": "string",
  "problem_statement": "string — the full problem or scenario",
  "steps": [
    {
      "step_num": 1,
      "instruction": "string",
      "tip": "string — a teaching tip for this step",
      "common_error": "string — what students often get wrong here"
    }
  ],
  "final_answer": "string",
  "visual_suggestion": "string",
  "visual_type": "diagram",
  "teacher_notes": "string",
  "time_minutes": number,
  "bloom_tag": "apply",
  "differentiation": { "support": "string", "extension": "string" }
}

6. CHECK FOR UNDERSTANDING SLIDE
{
  "type": "check_for_understanding",
  "question": "string",
  "choices": [
    { "label": "A", "text": "string", "is_correct": false },
    { "label": "B", "text": "string", "is_correct": true },
    { "label": "C", "text": "string", "is_correct": false },
    { "label": "D", "text": "string", "is_correct": false }
  ],
  "explanation": "string — why the correct answer is right",
  "wrong_answer_guidance": "string — what to do if most students got it wrong",
  "visual_suggestion": "string",
  "visual_type": "support",
  "teacher_notes": "string",
  "time_minutes": 3,
  "bloom_tag": "string",
  "differentiation": { "support": "string", "extension": "string" }
}

7. DISCUSSION SLIDE
{
  "type": "discussion",
  "prompt": "string — the main discussion question",
  "guiding_questions": ["string", "string"],
  "think_pair_share": true,
  "expected_responses": ["string", "string"],
  "visual_suggestion": "string",
  "visual_type": "support",
  "teacher_notes": "string — how to facilitate this discussion",
  "time_minutes": number,
  "bloom_tag": "evaluate",
  "differentiation": { "support": "string", "extension": "string" }
}

8. REAL WORLD CONNECTION SLIDE
{
  "type": "real_world_connection",
  "title": "Where You See This in Real Life",
  "scenario": "string — a vivid, locally relevant scenario students can relate to",
  "connection_points": ["string", "string", "string"],
  "student_activity": "string — a quick task students do on this slide",
  "visual_suggestion": "string",
  "visual_type": "support",
  "teacher_notes": "string",
  "time_minutes": number,
  "bloom_tag": "analyse",
  "differentiation": { "support": "string", "extension": "string" }
}

9. SUMMARY SLIDE
{
  "type": "summary",
  "title": "What We Covered Today",
  "takeaways": ["string", "string", "string"],
  "connection_to_next": "string — what comes next in the curriculum",
  "memory_hook": "string — a memorable phrase or acronym to remember the lesson",
  "visual_suggestion": "string",
  "visual_type": "support",
  "teacher_notes": "string",
  "time_minutes": 3,
  "bloom_tag": "recall",
  "differentiation": { "support": "string", "extension": "string" }
}

10. EXIT TICKET SLIDE
{
  "type": "exit_ticket",
  "title": "Before You Go",
  "prompt": "string — the exit question or task",
  "sentence_starters": ["Today I learned...", "I am still confused about...", "This connects to..."],
  "self_rating": true,
  "self_rating_prompt": "On a scale of 1–5, how well do you understand today's topic?",
  "teacher_action": "string — what the teacher does with the exit ticket data",
  "visual_suggestion": "string",
  "visual_type": "support",
  "teacher_notes": "string",
  "time_minutes": 3,
  "bloom_tag": "evaluate",
  "differentiation": { "support": "string", "extension": "string" }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURAL RULES — MUST BE FOLLOWED EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ${slideCountRule}
2. Slide 1: MUST be type "title"
3. Slide 2: MUST be type "learning_objectives"
4. Last slide: MUST be type "exit_ticket"
5. Second to last: MUST be type "summary"
6. Include AT LEAST:
   - 2 concept slides
   - 1 vocabulary slide
   - 1 worked_example slide (for practical subjects) or 1 real_world_connection slide
   - 1 check_for_understanding slide
   - 1 discussion slide
7. Teaching flow: hook → objectives → vocabulary → teach → worked example → check → discuss → real world → summary → exit
8. time_minutes across all slides must add up to the lesson duration in minutes
9. bloom_tag must escalate through the deck (start at recall, build to analyse/evaluate by the end)
10. Tone: "${tone}" — apply consistently in teacher_notes and all student-facing text

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. EVERY slide must have a non-empty visual_suggestion.
2. The title slide MUST have visual_type "hero".
3. At least 2 slides must have visual_type "diagram".
4. Visual suggestions must be specific enough to find on a stock photo site.
5. Write visual_suggestion as a SHORT search-engine-style phrase (5–10 words):
   GOOD: "green leaf sunlight photosynthesis close-up"
   GOOD: "supply demand curve economics graph"
   GOOD: "Nigerian market traders buying selling"
   GOOD: "fractions pizza slices divided equal parts"
   BAD: "an image about the topic"
   BAD: "a picture showing learning"
6. Keep visuals age-appropriate and classroom-safe.
7. For abstract concepts, prefer diagrams over photos.
8. For real-world connections, prefer locally relevant imagery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY STANDARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Every explanation must be academically accurate.
- Learning objectives must be SMART and measurable.
- Teacher notes must be specific — not "explain the concept" but exactly WHAT to say.
- Differentiation must be actionable — not generic.
- Analogies must be locally relevant and age-appropriate.
- Common misconceptions must be real ones teachers encounter.
- Every check_for_understanding must have EXACTLY 4 choices and EXACTLY 1 correct answer.
- Grade level: "${grade}" — adjust complexity, vocabulary, and sentence length accordingly.
- Bloom's level: "${bloom}" — ALL content must target this cognitive level.

RETURN ONLY THE JSON. NO MARKDOWN. NO PREAMBLE. NO EXPLANATION.
`.trim();
}

// ─────────────────────────────────────────────────────────────
// DECK VALIDATOR
// ─────────────────────────────────────────────────────────────

function validateDeck(deck: unknown): {
  valid: boolean;
  reason?: string;
} {
  if (!deck || typeof deck !== "object") {
    return { valid: false, reason: "Deck is not an object" };
  }

  const d = deck as Record<string, unknown>;
  const slides = d?.slides;

  if (!Array.isArray(slides)) {
    return { valid: false, reason: "slides is not an array" };
  }

  if (slides.length < 4) {
    return {
      valid: false,
      reason: `Only ${slides.length} slides returned — deck is incomplete`,
    };
  }

  const first = (slides[0] as any)?.type;
  const last = (slides[slides.length - 1] as any)?.type;

  if (first !== "title") {
    return { valid: false, reason: "First slide is not type 'title'" };
  }

  if (last !== "exit_ticket") {
    return { valid: false, reason: "Last slide is not type 'exit_ticket'" };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized (no token)" },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized (invalid token)", message: authError?.message },
        { status: 401 }
      );
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please confirm your email before generating slides." },
        { status: 403 }
      );
    }
// ── Parse body ────────────────────────────────────────
    let body: GenerateSlidesBody;
    try {
      body = (await req.json()) as GenerateSlidesBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      topic,
      grade,
      subject,
      duration,
      tone,
      bloom,
      curriculum,
      schoolLevel,
    } = body ?? {};

    // Declare once here — used in both the early credit check and deduction
    const usePersonalCredits = (body as any)?.usePersonalCredits === true;

    if (!topic || !grade || !subject || !duration || !tone || !bloom) {
      return NextResponse.json(
        { error: "Missing required fields: topic, grade, subject, duration, tone, bloom" },
        { status: 400 }
      );
    }

    const creditAvailability = await getGenerationCreditAvailability(supabase, user.id);
    if (!creditAvailability.ok) {
      return NextResponse.json(
        { ok: false, error: "credit_check_failed", message: creditAvailability.error, upgrade_url: null },
        { status: 500 }
      );
    }

    if (!usePersonalCredits && creditAvailability.creditsRemaining <= 0) {
      if (creditAvailability.source === "school") {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("credits_balance")
          .eq("id", user.id)
          .maybeSingle();

        const personalBalance = Math.max(0, Number((profileData as any)?.credits_balance ?? 0));

        if (personalBalance >= SLIDES_CREDIT_COST) {
          return NextResponse.json(
            {
              ok: false,
              errorCode: "needs_personal_confirmation",
              personalCreditsAvailable: personalBalance,
              message: "Your school has run out of credits.",
              cost: SLIDES_CREDIT_COST,
            },
            { status: 402 }
          );
        }

        return NextResponse.json(
          {
            ok: false,
            error: "school_out_of_credits",
            message: "Your school has used all its credits. Your principal has been notified and will add more credits soon.",
            upgrade_url: null,
          },
          { status: 402 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "out_of_credits",
          message: "You have used all your credits. Purchase more to continue generating lessons.",
          upgrade_url: "/pricing",
        },
        { status: 402 }
      );
    }

    // ── Check API keys ────────────────────────────────────
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const pexelsKey = process.env.PEXELS_API_KEY ?? "";

    const systemPrompt = buildSystemPrompt({ grade, bloom, duration, tone, subject, curriculum, schoolLevel });

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Generate a complete classroom lesson slide deck.

Topic: "${topic}"
Subject: ${subject}
Grade: ${grade}
Duration: ${duration}
Tone: ${tone}
Bloom's Level: ${bloom}
${curriculum ? `Curriculum: ${curriculum}` : ""}
${schoolLevel ? `School Level: ${schoolLevel}` : ""}

Make this immediately usable by a real teacher. Every slide must have teacher_notes, differentiation, time_minutes, and a vivid visual_suggestion.`,
      },
    ];

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: OPENAI_MAX_TOKENS,
        response_format: { type: "json_object" },
        temperature: 0.7,
        messages,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => "");
      return NextResponse.json(
        { error: "OpenAI request failed", status: openaiRes.status, detail: errText },
        { status: 500 }
      );
    }

    const openaiData = (await openaiRes.json()) as OpenAIChatResponse;

    if (openaiData.error) {
      return NextResponse.json(
        { error: "OpenAI API error", detail: openaiData.error.message },
        { status: 500 }
      );
    }

    const rawContent = openaiData.choices?.[0]?.message?.content;

    if (!rawContent || typeof rawContent !== "string") {
      return NextResponse.json({ error: "No content returned from OpenAI" }, { status: 500 });
    }

    let deck: unknown;
    try {
      deck = JSON.parse(rawContent);
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : "Unknown parse error";
      return NextResponse.json(
        { error: "Failed to parse slide deck JSON", detail: message },
        { status: 500 }
      );
    }

    const validation = validateDeck(deck);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Generated deck is incomplete. Please try again.", detail: validation.reason },
        { status: 500 }
      );
    }

    const deckObj = deck as Record<string, unknown>;
    const rawSlides = deckObj.slides as any[];

   // ── 3. Deduct credits ─────────────────────────────────
    const deductionResult = usePersonalCredits
      ? await consumePersonalCreditsDirectly(supabase, user.id, SLIDES_CREDIT_COST)
      : await consumeGenerationCredits(supabase, user.id, SLIDES_CREDIT_COST);

    if (!deductionResult.ok) {
      if (deductionResult.errorCode === "needs_personal_confirmation") {
        return NextResponse.json(
          {
            ok: false,
            errorCode: "needs_personal_confirmation",
            personalCreditsAvailable: deductionResult.personalCreditsAvailable,
            message: "Your school has run out of credits.",
            cost: SLIDES_CREDIT_COST,
          },
          { status: 402 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "credit_deduction_failed",
          message: deductionResult.error,
        },
        { status: 402 }
      );
    }

    // ── 4. Fetch Pexels images ────────────────────────────
    const enrichedSlides = pexelsKey
      ? await enrichSlidesWithImages(rawSlides, pexelsKey, subject, topic)
      : rawSlides;

    // ── 5. Build final deck ───────────────────────────────
    const finalDeck = {
      ...deckObj,
      slides: enrichedSlides,
      meta: {
        topic, subject, grade, duration, bloom,
        curriculum: curriculum ?? null,
        schoolLevel: schoolLevel ?? null,
        total_slides: enrichedSlides.length,
        total_time_minutes: enrichedSlides.reduce((sum: number, s: any) => sum + (s?.time_minutes ?? 0), 0),
        has_images: enrichedSlides.some((s: any) => !!s?.image_url),
        generated_at: new Date().toISOString(),
      },
    };

    // ── Save to library ───────────────────────────────────
   const { data: savedLesson, error: saveErr } = await supabase.from("lessons").insert({
      user_id: user.id,
      subject,
      topic,
      grade,
      curriculum: curriculum ?? null,
      result_json: finalDeck,
      type: "slides",
    }).select("id").maybeSingle();

    if (saveErr) {
      console.error("[generate-slides] Failed to save to library:", saveErr.message);
    }

    return NextResponse.json({ deck: finalDeck, lessonId: savedLesson?.id ?? null, saved: !saveErr });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json(
      { error: "Failed to generate slides", detail: message },
      { status: 500 }
    );
  }
}
