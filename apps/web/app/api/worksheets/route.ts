import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  consumeGenerationCredits,
  consumePersonalCreditsDirectly,
  getGenerationCreditAvailability,
} from "@/lib/credits/server";
 
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
 
type WorksheetSource = "generated" | "uploaded";
type PrintLayout = "standard" | "exam" | "worksheet";
type ContentMode = "normal" | "diagram" | "coloring" | "practical" | "answer_key";
type VisualContentMode = "diagram" | "coloring" | "practical";
 
type WorksheetVisual = {
  label: string;
  imageDataUrl: string;
};
 
type WorksheetRequestBody = {
  subject: string;
  topic: string;
  grade: string;
  worksheetType?: string;
  difficulty?: string;
  numQuestions?: number;
  durationMins?: number;
 
  title?: string;
  instructions?: string[];
  worksheet?: string;
  answerKey?: string;
 
  schoolName?: string;
  className?: string;
  worksheetDate?: string | null;
 
  source?: WorksheetSource;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
 
  printLayout?: PrintLayout;
  contentMode?: ContentMode;
  usePersonalCredits?: boolean;
};
 
type WorksheetPatchBody = {
  id: string;
  title?: string;
  schoolName?: string | null;
  className?: string | null;
  worksheetDate?: string | null;
  instructions?: string[];
  worksheet?: string;
  answerKey?: string;
  printLayout?: PrintLayout;
  contentMode?: ContentMode;
  worksheetType?: string | null;
  difficulty?: string | null;
  numQuestions?: number | null;
  durationMins?: number | null;
};
 
function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
 
function jsonErr(error: string, status = 500) {
  return NextResponse.json({ ok: false, error }, { status });
}
 
function getErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}
 
function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}
 
function supabaseWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
 
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
 
function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}
 
function normalizeSource(value: unknown): WorksheetSource {
  return value === "uploaded" ? "uploaded" : "generated";
}
 
function normalizePrintLayout(value: unknown): PrintLayout {
  if (value === "exam" || value === "worksheet") return value;
  return "standard";
}
 
function normalizeContentMode(value: unknown): ContentMode {
  if (
    value === "diagram" ||
    value === "coloring" ||
    value === "practical" ||
    value === "answer_key"
  ) {
    return value;
  }
  return "normal";
}
 
function normalizeInstructions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}
 
function normalizeVisualPrompts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
 
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as { prompt?: unknown; label?: unknown };
      const p = String(obj.prompt ?? obj.label ?? "").trim();
      if (p) out.push(p);
    }
  }
 
  return out;
}
 
function dedupeKeepOrder(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
 
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
 
  return out;
}
 
function extractVisualPromptsFromWorksheet(worksheet: string): string[] {
  const found = new Set<string>();
  const text = worksheet || "";
  const regex = /\[(?:Coloring Picture|Diagram)\s*:\s*([^\]]+)\]/gi;
 
  let m: RegExpExecArray | null = regex.exec(text);
  while (m) {
    const label = String(m[1] ?? "").trim();
    if (label) found.add(label);
    m = regex.exec(text);
  }
 
  return [...found];
}
 
function getFallbackVisualPrompts(
  mode: VisualContentMode,
  subject: string,
  topic: string
): string[] {
  if (mode === "coloring") {
    return [
      `${topic} simple black-and-white coloring outline`,
      `${topic} large printable outline for pupils to color`,
      `${topic} child-friendly outline with wide empty spaces`,
    ];
  }
 
  return [
    `${topic} labeled black-and-white outline`,
    `${topic} practical activity setup labeled outline`,
    `${topic} specimen or apparatus observation diagram outline`,
    `${subject} practical visual for ${topic} outline`,
  ];
}

function buildTopicBoundVisualPrompts(
  mode: VisualContentMode,
  prompts: string[],
  subject: string,
  topic: string
) {
  const fallback = getFallbackVisualPrompts(mode, subject, topic);
  const source = prompts.length > 0 ? prompts : fallback;
  const cleaned = source
    .map((prompt) => prompt.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((prompt) => {
      if (mode === "coloring") {
        return `Topic: ${topic}. Draw only ${prompt} as a clean black-and-white printable outline for pupils to color. No color, no cartoon scene, no unrelated objects.`;
      }

      if (mode === "practical") {
        return `Topic: ${topic}. Draw a relevant practical/lab/activity visual for ${subject}: ${prompt}. Use a clean black-and-white educational outline tied to the topic. No unrelated specimen or apparatus.`;
      }

      return `Topic: ${topic}. Draw ${prompt} as a clean black-and-white educational outline tied to the topic. No unrelated objects.`;
    });

  return dedupeKeepOrder(cleaned);
}
 
function getVisualMode(mode: ContentMode, worksheetText: string): VisualContentMode | null {
  if (mode === "coloring" || mode === "diagram" || mode === "practical") return mode;
  if ((worksheetText || "").includes("[Coloring Picture:")) return "coloring";
  if ((worksheetText || "").includes("[Diagram:")) return "diagram";
  return null;
}
 
function hasBasicNumbering(text: string, count: number) {
  const t = text || "";
  return t.includes("1.") && (t.includes(`${count}.`) || t.includes(`${count})`));
}
 
function buildWorksheetPrompt(input: WorksheetRequestBody) {
  const count = clampInt(input.numQuestions, 3, 50, 10);
  const type = String(input.worksheetType ?? "Mixed").trim();
  const difficulty = String(input.difficulty ?? "Medium").trim();
  const duration = clampInt(input.durationMins, 10, 180, 30);
 
  const contentMode = normalizeContentMode(input.contentMode);
  const printLayout = normalizePrintLayout(input.printLayout);
 
  const specialRules = (() => {
    if (contentMode === "diagram" || contentMode === "practical") {
      return `
Special requirements:
- This is a ${contentMode === "diagram" ? "diagram-based" : "practical"} worksheet.
- Make it highly practical, classroom-ready, and easy for students to use during science/biology practicals.
- Follow the user's exact topic, specimen, apparatus, or experiment request.
- Include biology/science-friendly questions only where relevant to the requested topic.
- For practical mode, visuals must show the actual practical activity, specimen, apparatus, process, or observation setup implied by the topic.
- If diagrams are needed, generate diagram placeholders BASED ON THE USER'S REQUEST in this exact style:
  [Diagram: <topic-relevant black-and-white outline>]

- Examples (do not limit to these):
  If topic is "Human heart" → [Diagram: Human heart outline]
  If topic is "Leaf" → [Diagram: Leaf cross-section outline]
  If topic is "Microscope" → [Diagram: Microscope parts outline]
  If topic is "Bean seed" → [Diagram: Bean seed internal structure outline]

- Include a "visualPrompts" array (3 to 6 prompts) for black-and-white printable outline diagrams.
- Each visual prompt must be specific, label-ready, and directly tied to the user’s topic.
- Each visual prompt must name the requested topic, specimen, apparatus, or practical activity.
- Never request decorative photos, colorful images, cartoon scenes, random clipart, or generic stock images.
- Prefer prompts like:
  "Human heart labeled outline"
  "Longitudinal section of flower labeled outline"
  "Microscope parts labeled outline"
  "Bean seed internal structure labeled outline"

- Include practical tasks such as:
  - labeling parts
  - observation tables
  - drawing from specimen
  - short function/explanation questions
  - identification of structures
  - comparison tasks where relevant

- For practical worksheets, make the questions feel like real lab/practical class work, not generic theory questions.
- Include clear instruction lines such as:
  "Observe the specimen carefully."
  "Label the indicated parts."
  "State one function of each labeled part."
  "Record your observations."
  "Draw and label neatly."

- Where appropriate, include:
  - specimen/apparatus name
  - aim
  - materials needed
  - observation
  - inference
  - conclusion

- Keep wording clear, student-friendly, and exam-practical oriented.
- Never insert unrelated specimen, apparatus, or diagrams that were not requested by the user’s topic unless they are directly necessary for the practical activity.
`;
    }
 
    if (contentMode === "coloring") {
      return `
Special requirements:
- This is a nursery/early-years coloring worksheet.
- Keep language very simple and child-friendly.
- Use short instructions.
- Generate coloring placeholders BASED ON THE USER'S TOPIC.
- Coloring visuals must be black-and-white outline drawings only, with no color, no shading, no filled backgrounds, and no cartoon scene.
- Use this format:
  [Coloring Picture: <relevant object from topic> outline]

- Examples (DO NOT LIMIT TO THESE):
  If topic is "Fruits" → apple, banana, orange  
  If topic is "Animals" → lion, dog, fish  
  If topic is "Light" → sun, candle, bulb  

- Include a "visualPrompts" array (3 to 8 prompts) that match the topic for black-and-white printable outlines.
- Each visual prompt must name the requested topic or an object directly within that topic.
- Never request random colorful images, cartoon scenes, generic clipart, unrelated animals/objects, or decorative photos.

- Keep large spacing and fewer tasks.
- Focus on coloring, tracing, matching, or simple recognition.
- Never insert unrelated specimen, apparatus, or diagrams that were not requested by the user’s topic unless they are directly necessary for the practical activity.
`;
    }
 
    if (contentMode === "answer_key") {
      return `
Special requirements:
- Ensure the answer key is especially clear and complete.
- Match every question exactly.
- visualPrompts must be [].
`;
    }
 
    return `
Special requirements:
- Keep the worksheet neat, classroom-ready, and printable.
- Use Nigeria-relevant school style where appropriate.
- visualPrompts must be [].
`;
  })();
 
  return `
Return STRICT JSON only. No markdown. No backticks. No extra text.
 
Audience: ${input.grade}
Subject: ${input.subject}
Topic: ${input.topic}
 
Worksheet Type: ${type}
Difficulty: ${difficulty}
Questions Count: ${count}
Duration: ${duration} minutes
Print Layout: ${printLayout}
Content Mode: ${contentMode}
 
${specialRules}
 
You MUST output JSON with exactly this shape:
{
  "title": "",
  "instructions": ["...","..."],
  "worksheet": "A clean printable worksheet text with numbered questions 1..${count}.",
  "answerKey": "Answer key text that corresponds to questions 1..${count}.",
  "visualPrompts": ["..."]
}
 
Hard requirements:
- worksheet MUST contain EXACTLY ${count} numbered questions/tasks/items unless contentMode is coloring and very early-years style requires shorter child-friendly activity prompts; even then still number items 1..${count}
- The worksheet must be classroom-ready
- The answerKey must cover ALL questions/tasks meaningfully
- Keep formatting neat and printable
- Do not return markdown
- Return JSON only
`.trim();
}
 
async function generateOutlineImage(
  client: OpenAI,
  args: {
    prompt: string;
    mode: VisualContentMode;
    subject: string;
    topic: string;
    grade: string;
  }
): Promise<WorksheetVisual | null> {
  const baseInstruction =
    args.mode === "coloring"
      ? `
Create a black-and-white printable coloring outline image for children.
Use monochrome black line art on a plain white background.
No color, no grayscale shading, no filled areas, no watermark, no logo, no background scene.
Use clear thick outlines and large empty spaces for coloring.
Draw only the requested topic/object; do not add unrelated objects.
No text on the image.
`
      : args.mode === "practical"
      ? `
Create a black-and-white printable practical/lab/activity visual.
Use monochrome black line art on a plain white background.
Show the relevant specimen, apparatus, process, observation setup, or activity for the requested topic.
No color, no grayscale shading, no filled areas, no watermark, no logo, no decorative background scene.
Make it suitable for classroom observation, labeling, or practical work.
No text paragraphs on the image.
`
      : `
Create a black-and-white printable educational line diagram outline.
Use monochrome black line art on a plain white background.
No color, no grayscale shading, no filled areas, no watermark, no logo, no background scene.
Make it suitable for students to label in class.
Draw only the requested topic/object; do not add unrelated objects.
No text paragraphs on the image.
`;
 
  const prompt = `
${baseInstruction}
Subject: ${args.subject}
Topic: ${args.topic}
Grade: ${args.grade}
Image focus: ${args.prompt}
`.trim();
 
  try {
    const imageResp = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "medium",
    });
 
    const b64 = imageResp?.data?.[0]?.b64_json;
    if (!b64 || typeof b64 !== "string") return null;
 
    return {
      label: args.prompt,
      imageDataUrl: `data:image/png;base64,${b64}`,
    };
  } catch {
    return null;
  }
}
 
async function generateWorksheetVisuals(
  client: OpenAI,
  args: {
    mode: VisualContentMode;
    prompts: string[];
    subject: string;
    topic: string;
    grade: string;
  }
): Promise<WorksheetVisual[]> {
  const maxCount = args.mode === "coloring" ? 8 : 6;
  const uniquePrompts = buildTopicBoundVisualPrompts(
    args.mode,
    args.prompts,
    args.subject,
    args.topic
  ).slice(0, maxCount);
 
  const visuals: WorksheetVisual[] = [];
  for (const p of uniquePrompts) {
    const one = await generateOutlineImage(client, {
      prompt: p,
      mode: args.mode,
      subject: args.subject,
      topic: args.topic,
      grade: args.grade,
    });
    if (one) visuals.push(one);
  }
 
  return visuals;
}
 
async function authenticate(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false as const, error: "Unauthorized (no token)", status: 401 };
  }
 
  const supabase = supabaseWithToken(token);
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData?.user;
 
  if (authErr || !user) {
    return { ok: false as const, error: "Unauthorized (invalid token)", status: 401 };
  }
 
  return { ok: true as const, supabase, user };
}
 
/**
 * GET
 * - /api/worksheets                    => list meta
 * - /api/worksheets?id=<uuid>          => fetch full row + generated view model
 * - /api/worksheets?id=<uuid>&visuals=1 => also generate visuals from worksheet placeholders
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);
 
    const { supabase, user } = auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const withVisuals = searchParams.get("visuals") === "1";
 
    if (id) {
      const { data, error } = await supabase
        .from("worksheets")
        .select(
          `
          id,
          user_id,
          subject,
          topic,
          grade,
          worksheet_type,
          difficulty,
          num_questions,
          duration_mins,
          title,
          instructions,
          worksheet,
          answer_key,
          school_name,
          class_name,
          worksheet_date,
          source,
          file_url,
          file_name,
          file_type,
          print_layout,
          content_mode,
          created_at,
          updated_at
        `
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
 
      if (error) return jsonErr(error.message, 500);
      if (!data) return jsonErr("Worksheet not found", 404);
 
      const worksheet = String(data.worksheet ?? "");
      const storedMode = normalizeContentMode(data.content_mode);
      const visualMode = getVisualMode(storedMode, worksheet);
 
     let visuals: WorksheetVisual[] = [];

if (data.file_url) {
  visuals = [
    {
      label: data.title ?? `${data.subject ?? ""}: ${data.topic ?? ""}`.trim(),
      imageDataUrl: data.file_url,
    },
  ];
} else if (withVisuals && visualMode && process.env.OPENAI_API_KEY) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let prompts = dedupeKeepOrder(extractVisualPromptsFromWorksheet(worksheet));
  if (prompts.length === 0) {
    prompts = getFallbackVisualPrompts(visualMode, data.subject, data.topic);
  }
  visuals = await generateWorksheetVisuals(client, {
    mode: visualMode,
    prompts,
    subject: data.subject,
    topic: data.topic,
    grade: data.grade,
  });
}
 
      const generated = {
        title: data.title ?? `${data.subject ?? ""}: ${data.topic ?? ""}`.trim(),
        instructions: Array.isArray(data.instructions) ? data.instructions : [],
        worksheet,
        answerKey: data.answer_key ?? "",
        contentMode: storedMode,
        visuals,
      };
 
      return jsonOk({ saved: data, generated }, 200);
    }
 
    const { data, error } = await supabase
      .from("worksheets")
      .select(
        `
        id,
        subject,
        topic,
        grade,
        worksheet_type,
        difficulty,
        num_questions,
        duration_mins,
        title,
        school_name,
        class_name,
        worksheet_date,
        source,
        file_url,
        file_name,
        file_type,
        print_layout,
        content_mode,
        created_at,
        updated_at
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
 
    if (error) return jsonErr(error.message, 500);
    return jsonOk(data ?? [], 200);
  } catch (e: unknown) {
    return jsonErr(getErrorMessage(e, "Failed"), 500);
  }
}
 
/**
 * POST /api/worksheets
 * - generates + saves
 * - OR saves uploaded worksheet metadata if source='uploaded'
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);
 
    const { supabase, user } = auth;
 
    let body: WorksheetRequestBody;
    try {
      body = (await req.json()) as WorksheetRequestBody;
    } catch {
      return jsonErr("Invalid JSON body", 400);
    }
 
    const subject = String(body?.subject ?? "").trim();
    const topic = String(body?.topic ?? "").trim();
    const grade = String(body?.grade ?? "").trim();
 
    if (!subject || !topic || !grade) {
      return jsonErr("Missing required fields: subject, topic, grade", 400);
    }
 
    const source = normalizeSource(body.source);
    const printLayout = normalizePrintLayout(body.printLayout);
    const contentMode = normalizeContentMode(body.contentMode);
    const usePersonalCredits = body.usePersonalCredits === true;
    const count = clampInt(body.numQuestions, 3, 50, contentMode === "coloring" ? 5 : 10);
    const duration = clampInt(body.durationMins, 10, 180, contentMode === "coloring" ? 20 : 30);

    if (source !== "uploaded") {
      const creditAvailability = await getGenerationCreditAvailability(supabase, user.id);
      if (!creditAvailability.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "credit_check_failed",
            message: creditAvailability.error,
            upgrade_url: null,
          },
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

          const personalBalance = Math.max(
            0,
            Number((profileData as any)?.credits_balance ?? 0)
          );

          if (personalBalance >= 1) {
            return NextResponse.json(
              {
                ok: false,
                errorCode: "needs_personal_confirmation",
                personalCreditsAvailable: personalBalance,
                message: "Your school has run out of credits.",
                cost: 1,
              },
              { status: 402 }
            );
          }

          return NextResponse.json(
            {
              ok: false,
              error: "school_out_of_credits",
              message:
                "Your school has run out of credits. Contact your principal to top up.",
              upgrade_url: null,
            },
            { status: 402 }
          );
        }
        return NextResponse.json(
          {
            ok: false,
            error: "out_of_credits",
            message:
              "You have used all your credits. Purchase more to continue generating lessons.",
            upgrade_url: "/pricing",
          },
          { status: 402 }
        );
      }
    }
 
    // Uploaded worksheet metadata save path
    if (source === "uploaded") {
      const title = String(body.title ?? topic).trim() || topic;
      const instructions = normalizeInstructions(body.instructions);
 
      const { data: saved, error: saveErr } = await supabase
        .from("worksheets")
        .insert({
          user_id: user.id,
          subject,
          topic,
          grade,
          worksheet_type: body.worksheetType ?? null,
          difficulty: body.difficulty ?? null,
          num_questions: count,
          duration_mins: duration,
          title,
          instructions,
          worksheet: String(body.worksheet ?? "").trim(),
          answer_key: String(body.answerKey ?? "").trim(),
          school_name: body.schoolName?.trim() || null,
          class_name: body.className?.trim() || null,
          worksheet_date: body.worksheetDate || null,
          source,
          file_url: body.fileUrl?.trim() || null,
          file_name: body.fileName?.trim() || null,
          file_type: body.fileType?.trim() || null,
          print_layout: printLayout,
          content_mode: contentMode,
        })
        .select(
          `
          id,
          subject,
          topic,
          grade,
          worksheet_type,
          difficulty,
          num_questions,
          duration_mins,
          title,
          school_name,
          class_name,
          worksheet_date,
          source,
          file_url,
          file_name,
          file_type,
          print_layout,
          content_mode,
          created_at,
          updated_at
        `
        )
        .single();
 
      if (saveErr) return jsonErr(saveErr.message, 500);
 
      return jsonOk(
        {
          saved,
          generated: {
            title,
            instructions,
            worksheet: String(body.worksheet ?? "").trim(),
            answerKey: String(body.answerKey ?? "").trim(),
            contentMode,
            visuals: [] as WorksheetVisual[],
          },
        },
        201
      );
    }
 
    if (!process.env.OPENAI_API_KEY) {
      return jsonErr("OPENAI_API_KEY missing", 500);
    }
 
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 
    // 1) Generate worksheet text JSON
    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Return STRICT valid JSON only. No markdown. No code fences. No extra commentary.",
        },
        {
          role: "user",
          content: buildWorksheetPrompt({
            ...body,
            subject,
            topic,
            grade,
            numQuestions: count,
            durationMins: duration,
            source,
            printLayout,
            contentMode,
          }),
        },
      ],
      temperature: 0.2,
      max_output_tokens: 3500,
      text: { format: { type: "json_object" } },
    });
 
    const raw = resp.output_text ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return jsonErr("Model returned invalid JSON", 502);
    }
 
    const title =
      String(parsed.title ?? body.title ?? `${subject}: ${topic}`).trim() || `${subject}: ${topic}`;
 
    const instructions = normalizeInstructions(parsed.instructions);
    const worksheet = String(parsed.worksheet ?? "").trim();
    const answerKey = String(parsed.answerKey ?? parsed.answer_key ?? "").trim();
 
    if (!worksheet) return jsonErr("Generation failed: worksheet is empty", 502);
    if (!answerKey) return jsonErr("Generation failed: answerKey is empty", 502);
    if (!hasBasicNumbering(worksheet, count)) {
      return jsonErr(
        "Generation failed: worksheet numbering/format is not correct. Please try again.",
        502
      );
    }
 
    // 2) Generate visuals (coloring/diagram/practical only)
    const visualMode = getVisualMode(contentMode, worksheet);
    let visuals: WorksheetVisual[] = [];
 
    if (visualMode) {
      let promptCandidates = dedupeKeepOrder([
        ...normalizeVisualPrompts(parsed.visualPrompts),
        ...extractVisualPromptsFromWorksheet(worksheet),
      ]);
 
      if (promptCandidates.length === 0) {
        promptCandidates = getFallbackVisualPrompts(visualMode, subject, topic);
      }
 
      visuals = await generateWorksheetVisuals(client, {
        mode: visualMode,
        prompts: promptCandidates,
        subject,
        topic,
        grade,
      });
    }
    
  const primaryVisual = visuals.find(
  (visual) =>
    typeof visual.imageDataUrl === "string" && visual.imageDataUrl.trim().length > 0
);

let savedFileUrl: string | null = null;
let savedFileType: string | null = null;
let savedFileName: string | null = null;

if (primaryVisual?.imageDataUrl) {
  try {
    // Strip the data URL prefix and convert to a Buffer
    const base64Data = primaryVisual.imageDataUrl.replace(/^data:image\/png;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const fileName = `${user.id}/${slug}-${Date.now()}.png`;

    // Upload to Supabase Storage bucket "worksheet-visuals"
    const { error: uploadErr } = await supabase.storage
      .from("worksheet-visuals")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (!uploadErr) {
      const { data: publicUrlData } = supabase.storage
        .from("worksheet-visuals")
        .getPublicUrl(fileName);

      savedFileUrl = publicUrlData?.publicUrl ?? null;
      savedFileType = "image/png";
      savedFileName = `${slug}.png`;
    }
  } catch {
    // Image upload failed — worksheet still saves, just without image
  }
}

    // 3) Save row
    const { data: saved, error: saveErr } = await supabase
      .from("worksheets")
      .insert({
        user_id: user.id,
        subject,
        topic,
        grade,
        worksheet_type: body.worksheetType ?? null,
        difficulty: body.difficulty ?? null,
        num_questions: count,
        duration_mins: duration,
        title,
        instructions,
        worksheet,
        answer_key: answerKey,
        school_name: body.schoolName?.trim() || null,
        class_name: body.className?.trim() || null,
        worksheet_date: body.worksheetDate || null,
        source,
        file_url: savedFileUrl,
        file_name: savedFileName,
        file_type: savedFileType,
        print_layout: printLayout,
        content_mode: contentMode,
      })
      .select(
        `
        id,
        subject,
        topic,
        grade,
        worksheet_type,
        difficulty,
        num_questions,
        duration_mins,
        title,
        school_name,
        class_name,
        worksheet_date,
        source,
        file_url,
        file_name,
        file_type,
        print_layout,
        content_mode,
        created_at,
        updated_at
      `
      )
      .single();
 
    if (saveErr) {
      return jsonErr(saveErr.message, 500);
    }

    const deductionResult = usePersonalCredits
      ? await consumePersonalCreditsDirectly(supabase, user.id, 1)
      : await consumeGenerationCredits(supabase, user.id, 1);

    if (!deductionResult.ok) {
      console.error("[worksheets] Credit deduction failed after successful generation:", {
        userId: user.id,
        errorCode: deductionResult.errorCode,
        error: deductionResult.error,
      });

      const worksheetId =
        typeof (saved as { id?: unknown }).id === "string"
          ? (saved as { id: string }).id
          : null;
      if (worksheetId) {
        await supabase
          .from("worksheets")
          .delete()
          .eq("id", worksheetId)
          .eq("user_id", user.id);
      }

      return NextResponse.json(
        {
          ok: false,
          error: deductionResult.errorCode ?? "credit_deduction_failed",
          message:
            deductionResult.error ??
            "Could not deduct credits. Please retry.",
          saved: false,
        },
        { status: 402 }
      );
    }

    return jsonOk(
      {
        saved,
        generated: { title, instructions, worksheet, answerKey, contentMode, visuals },
      },
      200
    );
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: "Worksheet generation failed",
        message: getErrorMessage(e, "Worksheet generation failed"),
      },
      { status: 500 }
    );
  }
}
 
/**
 * PATCH /api/worksheets
 * updates editable worksheet fields
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);
 
    const { supabase, user } = auth;
 
    let body: WorksheetPatchBody;
    try {
      body = (await req.json()) as WorksheetPatchBody;
    } catch {
      return jsonErr("Invalid JSON body", 400);
    }
 
    if (!body?.id) {
      return jsonErr("Missing worksheet id", 400);
    }
 
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
 
    if ("title" in body) updates.title = String(body.title ?? "").trim() || null;
    if ("schoolName" in body) updates.school_name = body.schoolName?.trim() || null;
    if ("className" in body) updates.class_name = body.className?.trim() || null;
    if ("worksheetDate" in body) updates.worksheet_date = body.worksheetDate || null;
    if ("instructions" in body) updates.instructions = normalizeInstructions(body.instructions);
    if ("worksheet" in body) updates.worksheet = String(body.worksheet ?? "").trim();
    if ("answerKey" in body) updates.answer_key = String(body.answerKey ?? "").trim();
    if ("printLayout" in body) updates.print_layout = normalizePrintLayout(body.printLayout);
    if ("contentMode" in body) updates.content_mode = normalizeContentMode(body.contentMode);
    if ("worksheetType" in body) updates.worksheet_type = body.worksheetType ?? null;
    if ("difficulty" in body) updates.difficulty = body.difficulty ?? null;
    if ("numQuestions" in body)
      updates.num_questions =
        body.numQuestions == null ? null : clampInt(body.numQuestions, 1, 50, 10);
    if ("durationMins" in body)
      updates.duration_mins =
        body.durationMins == null ? null : clampInt(body.durationMins, 10, 180, 30);
 
    const { data, error } = await supabase
      .from("worksheets")
      .update(updates)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select(
        `
        id,
        subject,
        topic,
        grade,
        worksheet_type,
        difficulty,
        num_questions,
        duration_mins,
        title,
        instructions,
        worksheet,
        answer_key,
        school_name,
        class_name,
        worksheet_date,
        source,
        file_url,
        file_name,
        file_type,
        print_layout,
        content_mode,
        created_at,
        updated_at
      `
      )
      .maybeSingle();
 
    if (error) return jsonErr(error.message, 500);
    if (!data) return jsonErr("Worksheet not found", 404);
 
  const generated = {
  title: data.title ?? `${data.subject ?? ""}: ${data.topic ?? ""}`.trim(),
  instructions: Array.isArray(data.instructions) ? data.instructions : [],
  worksheet: data.worksheet ?? "",
  answerKey: data.answer_key ?? "",
  contentMode: normalizeContentMode(data.content_mode),
  visuals:
    data.file_url
      ? [
          {
            label: data.title ?? `${data.subject ?? ""}: ${data.topic ?? ""}`.trim(),
            imageDataUrl: data.file_url,
          },
        ]
      : ([] as WorksheetVisual[]),
};
 
    return jsonOk({ saved: data, generated }, 200);
  } catch (e: unknown) {
    return jsonErr(getErrorMessage(e, "Update failed"), 500);
  }
}
 
/**
 * DELETE /api/worksheets?id=<uuid>
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);
 
    const { supabase, user } = auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return jsonErr("Missing id", 400);
 
    const { data, error } = await supabase
      .from("worksheets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
 
    if (error) return jsonErr(error.message, 500);
    if (!data) return jsonErr("Worksheet not found", 404);
 
    return jsonOk({ deleted: true }, 200);
  } catch (e: unknown) {
    return jsonErr(getErrorMessage(e, "Delete failed"), 500);
  }
}
