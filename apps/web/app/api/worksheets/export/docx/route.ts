import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
 
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
 
type ExportMode = "student" | "teacher";
type ContentMode = "normal" | "diagram" | "coloring" | "practical" | "answer_key";
type VisualMode = "diagram" | "coloring" | "practical";
 
type WorksheetRow = {
  id: string;
  user_id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  title: string | null;
  instructions: unknown;
  worksheet: string | null;
  answer_key: string | null;
  school_name: string | null;
  class_name: string | null;
  worksheet_date: string | null;
  content_mode: string | null;
};
 
type WorksheetVisualBuffer = {
  label: string;
  buffer: Buffer;
};
 
function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
 
function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
 
function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}
 
function createSupabaseWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
 
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
 
async function authenticateRequest(req: NextRequest) {
  const token = getBearerToken(req);
 
  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized (missing bearer token)",
    };
  }
 
  const supabase = createSupabaseWithToken(token);
  const { data, error } = await supabase.auth.getUser();
 
  if (error || !data?.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized (invalid token)",
    };
  }
 
  return {
    ok: true as const,
    supabase,
    user: data.user,
  };
}
 
function normalizeExportMode(value: string | null): ExportMode {
  return value === "teacher" ? "teacher" : "student";
}
 
function normalizeContentMode(value: string | null): ContentMode {
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
 
function sanitizeFileName(value: string) {
  return value
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}
 
function toStringSafe(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}
 
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}
 
function dedupeKeepOrder(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
 
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
 
    if (!trimmed || seen.has(key)) continue;
 
    seen.add(key);
    result.push(trimmed);
  }
 
  return result;
}
 
function extractVisualPromptsFromWorksheet(worksheet: string): string[] {
  const matches = new Set<string>();
  const regex = /\[(?:Coloring Picture|Diagram)\s*:\s*([^\]]+)\]/gi;
 
  let match: RegExpExecArray | null;
  while ((match = regex.exec(worksheet)) !== null) {
    const label = String(match[1] ?? "").trim();
    if (label) matches.add(label);
  }
 
  return [...matches];
}
 
function getVisualMode(contentMode: ContentMode, worksheet: string): VisualMode | null {
  if (
    contentMode === "diagram" ||
    contentMode === "coloring" ||
    contentMode === "practical"
  ) {
    return contentMode;
  }
 
  if (worksheet.includes("[Coloring Picture:")) return "coloring";
  if (worksheet.includes("[Diagram:")) return "diagram";
 
  return null;
}
 
function parseBooleanParam(value: string | null, fallback = false) {
  if (value == null) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}
 
function parseIntParam(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
 
/**
 * Dynamic visual generation is intentionally environment-gated
 * to avoid accidental cost exposure.
 */
function getOpenAIClientIfAllowed() {
  const apiKey = process.env.OPENAI_API_KEY;
  const enabled = process.env.WORKSHEET_EXPORT_ENABLE_DYNAMIC_VISUALS === "1";
 
  if (!enabled || !apiKey) return null;
  return new OpenAI({ apiKey });
}
 
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
 
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
 
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
 
async function generateOutlineImageBuffer(
  client: OpenAI,
  params: {
    prompt: string;
    mode: VisualMode;
    subject: string;
    topic: string;
    grade: string;
  }
): Promise<WorksheetVisualBuffer | null> {
  const instruction =
    params.mode === "coloring"
      ? `
Create a black-and-white printable coloring outline image for children.
No color, no grayscale shading, no watermark, no logo, no background scene.
Use bold clean outlines and large open spaces for coloring.
No text on the image.
`
      : `
Create a black-and-white printable educational line diagram outline.
No color, no grayscale shading, no watermark, no logo, no background scene.
Make it suitable for classroom labeling or practical work.
No long text paragraphs on the image.
`;
 
  const prompt = `
${instruction}
Subject: ${params.subject}
Topic: ${params.topic}
Grade: ${params.grade}
Image focus: ${params.prompt}
`.trim();
 
  try {
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "low",
    });
 
    const b64 = response?.data?.[0]?.b64_json;
    if (!b64) return null;
 
    return {
      label: params.prompt,
      buffer: Buffer.from(b64, "base64"),
    };
  } catch {
    return null;
  }
}
 
async function generateVisualBuffers(params: {
  mode: VisualMode;
  subject: string;
  topic: string;
  grade: string;
  worksheet: string;
  maxVisuals: number;
  perImageTimeoutMs: number;
}): Promise<WorksheetVisualBuffer[]> {
  const client = getOpenAIClientIfAllowed();
  if (!client) return [];
 
  // Deterministic behavior: ONLY placeholders explicitly present in worksheet text.
  const prompts = dedupeKeepOrder(extractVisualPromptsFromWorksheet(params.worksheet))
    .slice(0, params.maxVisuals);
 
  if (prompts.length === 0) return [];
 
  const tasks = prompts.map((prompt) =>
    withTimeout(
      generateOutlineImageBuffer(client, {
        prompt,
        mode: params.mode,
        subject: params.subject,
        topic: params.topic,
        grade: params.grade,
      }),
      params.perImageTimeoutMs
    )
  );
 
  const settled = await Promise.allSettled(tasks);
  const visuals: WorksheetVisualBuffer[] = [];
 
  for (const item of settled) {
    if (item.status === "fulfilled" && item.value) visuals.push(item.value);
  }
 
  return visuals;
}
 
function buildMetaLine(row: WorksheetRow, mode: ExportMode) {
  return [
    row.subject ? `${row.subject}` : "",
    row.grade ? `• ${row.grade}` : "",
    row.topic ? `• ${row.topic}` : "",
    mode === "teacher" ? "• Teacher Copy" : "• Student Copy",
  ]
    .filter(Boolean)
    .join(" ");
}
 
function buildSchoolInfoLine(row: WorksheetRow) {
  return [
    row.school_name ? `School: ${row.school_name}` : "",
    row.class_name ? `Class: ${row.class_name}` : "",
    row.worksheet_date ? `Date: ${row.worksheet_date}` : "",
  ]
    .filter(Boolean)
    .join("    ");
}
 
function textToParagraphs(text: string) {
  return text.split(/\r?\n/).map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line || " ")],
        spacing: { after: 120 },
      })
  );
}
 
function imageBufferToUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
 
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  view.set(buffer);
  return arrayBuffer;
}
 
async function fetchWorksheet(
  supabase: SupabaseClient<any, any, any>,
  worksheetId: string,
  userId: string
): Promise<WorksheetRow | null> {
  const { data, error } = await supabase
    .from("worksheets")
    .select(`
      id,
      user_id,
      subject,
      topic,
      grade,
      title,
      instructions,
      worksheet,
      answer_key,
      school_name,
      class_name,
      worksheet_date,
      content_mode
    `)
    .eq("id", worksheetId)
    .eq("user_id", userId)
    .maybeSingle();
 
  if (error) {
    throw new Error(error.message);
  }
 
  return data as WorksheetRow | null;
}
 
function addHeaderParagraphs(children: Paragraph[], title: string, metaLine: string) {
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 180 },
    }),
    new Paragraph({
      text: metaLine,
      spacing: { after: 200 },
    })
  );
}
 
function addSchoolInfoParagraph(children: Paragraph[], schoolInfoLine: string) {
  if (!schoolInfoLine) return;
 
  children.push(
    new Paragraph({
      text: schoolInfoLine,
      spacing: { after: 200 },
    })
  );
}
 
function addInstructionsParagraphs(children: Paragraph[], instructions: string[]) {
  if (instructions.length === 0) return;
 
  children.push(
    new Paragraph({
      text: "Instructions",
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 },
    })
  );
 
  for (let i = 0; i < instructions.length; i++) {
    children.push(
      new Paragraph({
        text: `${i + 1}. ${instructions[i]}`,
        spacing: { after: 90 },
      })
    );
  }
 
  children.push(new Paragraph({ text: " " }));
}
 
function addWorksheetParagraphs(children: Paragraph[], worksheet: string) {
  children.push(
    new Paragraph({
      text: "Worksheet",
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
    })
  );
 
  children.push(...textToParagraphs(worksheet));
}
 
function addVisualParagraphs(children: Paragraph[], visuals: WorksheetVisualBuffer[]) {
  if (visuals.length === 0) return;
 
  children.push(
    new Paragraph({ text: " " }),
    new Paragraph({
      text: "Worksheet Visuals",
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
    })
  );
 
  for (let i = 0; i < visuals.length; i++) {
    const visual = visuals[i];
 
    children.push(
      new Paragraph({
        text: `Visual ${i + 1}: ${visual.label}`,
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 90 },
      })
    );
 
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: imageBufferToUint8Array(visual.buffer),
            transformation: {
              width: 460,
              height: 460,
            },
            type: "png",
          }),
        ],
        spacing: { after: 140 },
      })
    );
  }
}
 
function addAnswerKeyParagraphs(children: Paragraph[], answerKey: string) {
  if (!answerKey) return;
 
  children.push(
    new Paragraph({ text: " " }),
    new Paragraph({
      text: "Answer Key",
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
      pageBreakBefore: true,
    }),
    ...textToParagraphs(answerKey)
  );
}
 
async function buildDocxBuffer(params: {
  row: WorksheetRow;
  mode: ExportMode;
  includeVisuals: boolean;
  maxVisuals: number;
  perImageTimeoutMs: number;
}): Promise<Buffer> {
  const row = params.row;
 
  const title =
    toStringSafe(row.title) ||
    `${toStringSafe(row.subject, "Worksheet")}: ${toStringSafe(row.topic, "Untitled")}`;
 
  const worksheet = toStringSafe(row.worksheet);
  const answerKey = toStringSafe(row.answer_key);
  const instructions = toStringArray(row.instructions);
  const contentMode = normalizeContentMode(row.content_mode);
  const visualMode = getVisualMode(contentMode, worksheet);
 
  if (!worksheet) {
    throw new Error("Worksheet text is empty");
  }
 
  const visuals =
    params.includeVisuals && visualMode
      ? await generateVisualBuffers({
          mode: visualMode,
          subject: toStringSafe(row.subject, "General"),
          topic: toStringSafe(row.topic, "Worksheet"),
          grade: toStringSafe(row.grade, "General"),
          worksheet,
          maxVisuals: params.maxVisuals,
          perImageTimeoutMs: params.perImageTimeoutMs,
        })
      : [];
 
  const children: Paragraph[] = [];
 
  addHeaderParagraphs(children, title, buildMetaLine(row, params.mode));
  addSchoolInfoParagraph(children, buildSchoolInfoLine(row));
  addInstructionsParagraphs(children, instructions);
  addWorksheetParagraphs(children, worksheet);
  addVisualParagraphs(children, visuals);
 
  if (params.mode === "teacher" && answerKey) {
    addAnswerKeyParagraphs(children, answerKey);
  }
 
  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });
 
  return Packer.toBuffer(doc);
}
 
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return jsonError(auth.error, auth.status);
    }
 
    const { searchParams } = new URL(req.url);
    const worksheetId = searchParams.get("id");
    const mode = normalizeExportMode(searchParams.get("mode"));
 
    // Safer defaults: visuals disabled unless explicitly requested.
    const includeVisuals = parseBooleanParam(searchParams.get("visuals"), false);
 
    // Hard caps for reliability and cost.
    const maxVisuals = parseIntParam(searchParams.get("maxVisuals"), 2, 0, 3);
    const perImageTimeoutMs = parseIntParam(searchParams.get("imageTimeoutMs"), 12000, 3000, 20000);
 
    if (!worksheetId) {
      return jsonError("Missing id", 400);
    }
 
    const row = await fetchWorksheet(auth.supabase, worksheetId, auth.user.id);
    if (!row) {
      return jsonError("Worksheet not found", 404);
    }
 
    if (!toStringSafe(row.worksheet)) {
      return jsonError("Worksheet text is empty", 422);
    }
 
    const buffer = await buildDocxBuffer({
      row,
      mode,
      includeVisuals,
      maxVisuals,
      perImageTimeoutMs,
    });
 
    const title =
      toStringSafe(row.title) ||
      `${toStringSafe(row.subject, "Worksheet")}-${toStringSafe(row.topic, "Export")}`;
 
    const fileName = sanitizeFileName(`${title}-${mode}.docx`);
 
    return new Response(bufferToArrayBuffer(buffer), {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
        "content-length": String(buffer.byteLength),
      },
    });
  } catch (error: unknown) {
    return jsonError(getErrorMessage(error, "DOCX export failed"), 500);
  }
}