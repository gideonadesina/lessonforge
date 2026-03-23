import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
 
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
 
type ExportMode = "student" | "teacher";
type ContentMode = "normal" | "diagram" | "coloring" | "practical" | "answer_key";
type VisualMode = "diagram" | "coloring" | "practical";
 
type WorksheetRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  title: string | null;
  instructions: unknown;
  worksheet: string | null;
  answer_key: string | null;
  school_name?: string | null;
  class_name?: string | null;
  worksheet_date?: string | null;
  content_mode?: string | null;
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
 
function parseBooleanParam(value: string | null, fallback = false) {
  if (value == null) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}
 
function parseIntParam(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
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
 
/**
 * Dynamic visual generation is intentionally opt-in and environment-gated.
 * This prevents accidental cost abuse in export endpoints.
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
      // Lower size/quality helps reduce latency/cost in export context.
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
 
  // Deterministic prompt source: only explicit placeholders found in worksheet text.
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
    if (item.status === "fulfilled" && item.value) {
      visuals.push(item.value);
    }
  }
 
  return visuals;
}
 
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  view.set(buffer);
  return arrayBuffer;
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
 
function addHeader(doc: PDFKit.PDFDocument, title: string, metaLine: string) {
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#000000").text(title);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(11).fillColor("#444444").text(metaLine);
  doc.fillColor("#000000");
  doc.moveDown(0.8);
}
 
function addSchoolInfo(doc: PDFKit.PDFDocument, infoLine: string) {
  if (!infoLine) return;
  doc.font("Helvetica").fontSize(10.5).text(infoLine);
  doc.moveDown(0.8);
}
 
function addInstructions(doc: PDFKit.PDFDocument, instructions: string[]) {
  if (instructions.length === 0) return;
 
  doc.font("Helvetica-Bold").fontSize(12).text("Instructions");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(11);
 
  for (let i = 0; i < instructions.length; i++) {
    doc.text(`${i + 1}. ${instructions[i]}`);
  }
 
  doc.moveDown(0.8);
}
 
function addWorksheetBody(doc: PDFKit.PDFDocument, worksheet: string) {
  doc.font("Helvetica-Bold").fontSize(12).text("Worksheet");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(11).text(worksheet, {
    lineGap: 2,
    align: "left",
  });
}
 
function addVisualPages(doc: PDFKit.PDFDocument, visuals: WorksheetVisualBuffer[]) {
  for (let i = 0; i < visuals.length; i++) {
    const visual = visuals[i];
 
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(13).text(`Visual ${i + 1}: ${visual.label}`);
    doc.moveDown(0.5);
 
    const maxWidth = 480;
    const maxHeight = 650;
    const x = (doc.page.width - maxWidth) / 2;
    const y = doc.y;
 
    doc.image(visual.buffer, x, y, {
      fit: [maxWidth, maxHeight],
      align: "center",
    });
  }
}
 
function addAnswerKey(doc: PDFKit.PDFDocument, answerKey: string) {
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(14).text("Answer Key");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(11).text(answerKey, {
    lineGap: 2,
    align: "left",
  });
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
 
function createPdfDocument() {
  return new PDFDocument({
    size: "A4",
    margin: 48,
    bufferPages: false,
    compress: true,
  });
}
 
async function renderWorksheetPdf(params: {
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
  const contentMode = normalizeContentMode(row.content_mode ?? null);
  const visualMode = getVisualMode(contentMode, worksheet);
 
  if (!worksheet) {
    // Validation-ish error; caller maps to 422.
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
 
  const doc = createPdfDocument();
  const chunks: Buffer[] = [];
 
  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
 
  addHeader(doc, title, buildMetaLine(row, params.mode));
  addSchoolInfo(doc, buildSchoolInfoLine(row));
  addInstructions(doc, instructions);
  addWorksheetBody(doc, worksheet);
 
  if (visuals.length > 0) {
    addVisualPages(doc, visuals);
  }
 
  if (params.mode === "teacher" && answerKey) {
    addAnswerKey(doc, answerKey);
  }
 
  doc.end();
 
  return pdfReady;
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
 
    // Safer defaults:
    // - visuals default OFF to avoid accidental cost abuse.
    // - allow explicit opt-in: ?visuals=1
    const includeVisuals = parseBooleanParam(searchParams.get("visuals"), false);
 
    // Hard limits to protect runtime/cost.
    const maxVisuals = parseIntParam(searchParams.get("maxVisuals"), 2, 0, 3);
    const perImageTimeoutMs = parseIntParam(searchParams.get("imageTimeoutMs"), 12000, 3000, 20000);
 
    if (!worksheetId) {
      return jsonError("Missing id", 400);
    }
 
    const row = await fetchWorksheet(auth.supabase, worksheetId, auth.user.id);
    if (!row) {
      return jsonError("Worksheet not found", 404);
    }
 
    // Optional early validation before rendering:
    if (!toStringSafe(row.worksheet)) {
      return jsonError("Worksheet text is empty", 422);
    }
 
    const pdfBuffer = await renderWorksheetPdf({
      row,
      mode,
      includeVisuals,
      maxVisuals,
      perImageTimeoutMs,
    });
 
    const title =
      toStringSafe(row.title) ||
      `${toStringSafe(row.subject, "Worksheet")}-${toStringSafe(row.topic, "Export")}`;
 
    const fileName = sanitizeFileName(`${title}-${mode}.pdf`);
    const body = bufferToArrayBuffer(pdfBuffer);
 
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
        "content-length": String(pdfBuffer.byteLength),
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, "PDF export failed");
    // Keep server errors as 500; validation-specific ones already handled above.
    return jsonError(message, 500);
  }
}