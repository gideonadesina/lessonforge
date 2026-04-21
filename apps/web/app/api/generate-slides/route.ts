import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { LESSON_SLIDES_CREDIT_COST } from "@/lib/billing/pricing";
import { consumeGenerationCredits } from "@/lib/credits/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Duration = "20min" | "45min" | "60min";

type GenerateSlidesBody = {
  topic: string;
  grade: string;
  subject: string;
  duration: Duration;
  tone: string;
  bloom: string;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

function buildSystemPrompt({
  grade,
  bloom,
  duration,
  tone,
  subject,
}: {
  grade: string;
  bloom: string;
  duration: Duration;
  tone: string;
  subject: string;
}): string {
  const slideCountRule =
    duration === "20min"
      ? "Generate 6 to 8 slides total."
      : duration === "45min"
      ? "Generate 10 to 13 slides total."
      : "Generate 14 to 18 slides total.";

  return `
You are an expert instructional designer, teacher trainer, and classroom presentation designer.

Your task is to generate a complete, classroom-ready lesson slide deck as a SINGLE valid JSON object.

ABSOLUTE OUTPUT RULES:
- Return ONLY valid JSON.
- Do NOT return markdown.
- Do NOT wrap the JSON in code fences.
- Do NOT include explanations, notes, or any text before or after the JSON.
- The response must be directly parseable with JSON.parse.

GOAL:
Create a premium, teacher-first lesson slide deck for ${subject}, designed for projection in a classroom.
The deck should feel structured, visually intentional, and pedagogically strong.

TOP-LEVEL JSON SHAPE:
{
  "deck_title": "string",
  "subject": "${subject}",
  "grade": "${grade}",
  "bloom_level": "${bloom}",
  "slides": Slide[]
}

SUPPORTED SLIDE TYPES:
- title
- learning_objectives
- concept
- vocabulary
- worked_example
- check_for_understanding
- discussion
- summary
- exit_ticket

REQUIRED SLIDE SCHEMAS:

1. title
{
  "type": "title",
  "title": "string",
  "subtitle": "string",
  "hook_question": "string",
  "visual_suggestion": "string",
  "visual_type": "hero"
}

2. learning_objectives
{
  "type": "learning_objectives",
  "title": "string",
  "objectives": ["string"],
  "bloom_level": "string",
  "visual_suggestion": "string",
  "visual_type": "support"
}

3. concept
{
  "type": "concept",
  "title": "string",
  "explanation": "string",
  "key_point": "string",
  "analogy": "string",
  "visual_suggestion": "string",
  "visual_type": "diagram"
}

4. vocabulary
{
  "type": "vocabulary",
  "title": "string",
  "terms": [
    {
      "word": "string",
      "definition": "string",
      "example": "string"
    }
  ],
  "visual_suggestion": "string",
  "visual_type": "support"
}

5. worked_example
{
  "type": "worked_example",
  "title": "string",
  "steps": [
    {
      "step_num": 1,
      "instruction": "string",
      "tip": "string"
    }
  ],
  "visual_suggestion": "string",
  "visual_type": "diagram"
}

6. check_for_understanding
{
  "type": "check_for_understanding",
  "question": "string",
  "choices": [
    { "label": "A", "text": "string", "is_correct": false },
    { "label": "B", "text": "string", "is_correct": true },
    { "label": "C", "text": "string", "is_correct": false }
  ],
  "explanation": "string",
  "visual_suggestion": "string",
  "visual_type": "support"
}

7. discussion
{
  "type": "discussion",
  "prompt": "string",
  "guiding_questions": ["string"],
  "think_pair_share": true,
  "visual_suggestion": "string",
  "visual_type": "support"
}

8. summary
{
  "type": "summary",
  "title": "string",
  "takeaways": ["string"],
  "connection_to_next": "string",
  "visual_suggestion": "string",
  "visual_type": "support"
}

9. exit_ticket
{
  "type": "exit_ticket",
  "title": "string",
  "prompt": "string",
  "sentence_starters": ["string"],
  "self_rating": true,
  "visual_suggestion": "string",
  "visual_type": "support"
}

STRUCTURAL RULES (MUST FOLLOW):
1. The FIRST slide must be type "title".
2. The SECOND slide must be type "learning_objectives".
3. The LAST slide must be type "exit_ticket".
4. ${slideCountRule}
5. Include at least:
   - 1 concept slide
   - 1 check_for_understanding slide
   - 1 summary slide
6. Use slide types only from the supported list above.
7. Keep the teaching flow logical: hook -> objectives -> teach -> practice/check -> recap -> exit ticket.
8. Match all content to Bloom's taxonomy level: "${bloom}".
9. Adjust vocabulary, examples, and sentence complexity to suit grade level: "${grade}".
10. Apply the tone consistently: "${tone}".
11. Keep slide content presentation-ready: concise, clear, and readable on a classroom screen.

VISUAL RULES (VERY IMPORTANT):
1. EVERY slide must include a non-empty "visual_suggestion".
2. Include at least 2 to 3 visual-first slides in the deck.
3. The title slide MUST be visual-first with "visual_type": "hero".
4. At least one concept or worked_example slide MUST be visual-first with "visual_type": "diagram".
5. Visual suggestions must be vivid, specific, and presentation-quality.
6. Avoid vague suggestions like:
   - "an image of a classroom"
   - "a picture of the topic"
7. Prefer detailed visual directions such as:
   - subject/object clearly described
   - composition
   - angle or framing
   - diagram style if educational
   - classroom-safe, age-appropriate imagery
8. If the topic benefits more from explanation than photography, prefer diagram/illustration-style visuals.
9. Visuals should support learning, not just decoration.

VISUAL WRITING EXAMPLES:
- GOOD hero visual:
  "Close-up of a bright green leaf with sunlight rays passing through it, warm natural glow, clean educational style, high clarity, classroom-friendly composition"
- GOOD diagram visual:
  "Simple labeled diagram showing sunlight, water, and carbon dioxide entering a leaf, with arrows leading to glucose and oxygen, clean textbook-style illustration"
- BAD visual:
  "An image about photosynthesis"

CHECK-FOR-UNDERSTANDING RULES:
- Every check_for_understanding slide must include EXACTLY 3 answer choices.
- EXACTLY 1 choice must have "is_correct": true.
- Use labels A, B, C.

VOCABULARY RULES:
- Every vocabulary slide must include 3 to 5 terms only.
- Each term must have:
  - word
  - definition
  - example

WORKED EXAMPLE RULES:
- Steps must be sequential.
- Each step should be short and presentation-friendly.
- Each step should include a useful "tip" where appropriate.

QUALITY STANDARDS:
- The deck must be immediately usable by a real teacher.
- The learning objectives must be measurable.
- The explanations must be academically accurate.
- The questions must be age-appropriate.
- The deck should feel polished, clear, and purposeful.

FINAL REMINDER:
Return ONLY the JSON object. No markdown. No extra text.
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    let body: GenerateSlidesBody;

    try {
      body = (await req.json()) as GenerateSlidesBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { topic, grade, subject, duration, tone, bloom } = body ?? {};

    if (!topic || !grade || !subject || !duration || !tone || !bloom) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: topic, grade, subject, duration, tone, bloom",
        },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creditResult = await consumeGenerationCredits(
      supabase,
      user.id,
      LESSON_SLIDES_CREDIT_COST
    );

    if (!creditResult.ok) {
      if (creditResult.error === "No credits") {
        return NextResponse.json(
          { error: "Insufficient credits" },
          { status: 402 }
        );
      }

      return NextResponse.json(
        { error: creditResult.error || "Credit deduction failed" },
        { status: 500 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const systemPrompt = buildSystemPrompt({
      grade,
      bloom,
      duration,
      tone,
      subject,
    });

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Create a complete lesson slide deck about "${topic}" for ${subject}, ${grade}. Duration: ${duration}. Tone: ${tone}. Bloom level: ${bloom}. Make it classroom-ready, visually intentional, and teacher-friendly.`,
      },
    ];

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: "OpenAI request failed",
          status: openaiRes.status,
          detail: errText,
        },
        { status: 500 }
      );
    }

    const data = (await openaiRes.json()) as OpenAIChatResponse;

    if (data.error) {
      return NextResponse.json(
        { error: "OpenAI API error", detail: data.error.message },
        { status: 500 }
      );
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "No content returned from OpenAI" },
        { status: 500 }
      );
    }

    let deck: unknown;

    try {
      deck = JSON.parse(content);
    } catch (parseErr) {
      const message =
        parseErr instanceof Error ? parseErr.message : "Unknown parse error";

      return NextResponse.json(
        {
          error: "Failed to parse slide deck JSON",
          detail: message,
          raw: content,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ deck });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error";

    return NextResponse.json(
      { error: "Failed to generate slides", detail: message },
      { status: 500 }
    );
  }
}