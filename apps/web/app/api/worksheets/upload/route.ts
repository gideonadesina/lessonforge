import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
 
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
 
type PrintLayout = "standard" | "exam" | "worksheet";
type ContentMode = "normal" | "diagram" | "coloring" | "practical" | "answer_key";
 
function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
 
function jsonErr(error: string, status = 500) {
  return NextResponse.json({ ok: false, error }, { status });
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
  if (Array.isArray(value)) {
    return value.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  return [];
}
 
function parseInstructions(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  const v = raw.trim();
  if (!v) return [];
 
  try {
    const parsed = JSON.parse(v);
    return normalizeInstructions(parsed);
  } catch {
    return v
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
}
 
function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}
 
function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 140);
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
 * POST /api/worksheets/upload
 * multipart/form-data:
 * - file (required)
 * - subject, topic, grade (required)
 * - optional metadata fields
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);
 
    const { supabase, user } = auth;
 
    const form = await req.formData();
 
    const subject = String(form.get("subject") ?? "").trim();
    const topic = String(form.get("topic") ?? "").trim();
    const grade = String(form.get("grade") ?? "").trim();
 
    if (!subject || !topic || !grade) {
      return jsonErr("Missing required fields: subject, topic, grade", 400);
    }
 
    const fileField = form.get("file");
    if (!(fileField instanceof File)) {
      return jsonErr("Missing file", 400);
    }
 
    const file = fileField;
    if (file.size <= 0) return jsonErr("Uploaded file is empty", 400);
 
    const maxFileBytes = 15 * 1024 * 1024; // 15MB
    if (file.size > maxFileBytes) {
      return jsonErr("File too large. Max size is 15MB", 413);
    }
 
    const worksheetType = String(form.get("worksheetType") ?? "").trim() || null;
    const difficulty = String(form.get("difficulty") ?? "").trim() || null;
    const numQuestions = clampInt(form.get("numQuestions"), 1, 50, 10);
    const durationMins = clampInt(form.get("durationMins"), 10, 180, 30);
 
    const title = String(form.get("title") ?? topic).trim() || topic;
    const schoolName = String(form.get("schoolName") ?? "").trim() || null;
    const className = String(form.get("className") ?? "").trim() || null;
    const worksheetDate = String(form.get("worksheetDate") ?? "").trim() || null;
 
    const printLayout = normalizePrintLayout(form.get("printLayout"));
    const contentMode = normalizeContentMode(form.get("contentMode"));
 
    const instructions = parseInstructions(form.get("instructions"));
    const worksheet = String(form.get("worksheet") ?? "").trim();
    const answerKey = String(form.get("answerKey") ?? "").trim();
 
    const bucket = process.env.SUPABASE_WORKSHEET_UPLOAD_BUCKET ?? "worksheet-uploads";
    const safeName = sanitizeFileName(file.name || "worksheet_upload");
    const uploadPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
 
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage.from(bucket).upload(uploadPath, fileBytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
 
    if (uploadErr) {
      return jsonErr(`Upload failed: ${uploadErr.message}`, 500);
    }
 
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(uploadPath);
    const fileUrl = publicData?.publicUrl || uploadPath;
 
    const { data: saved, error: saveErr } = await supabase
      .from("worksheets")
      .insert({
        user_id: user.id,
        subject,
        topic,
        grade,
        worksheet_type: worksheetType,
        difficulty,
        num_questions: numQuestions,
        duration_mins: durationMins,
        title,
        instructions,
        worksheet,
        answer_key: answerKey,
        school_name: schoolName,
        class_name: className,
        worksheet_date: worksheetDate,
        source: "uploaded",
        file_url: fileUrl,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
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
      .single();
 
    if (saveErr) return jsonErr(saveErr.message, 500);
 
    return jsonOk(
      {
        saved,
        generated: {
          title,
          instructions,
          worksheet,
          answerKey,
        },
      },
      201
    );
  } catch (e: any) {
    return jsonErr(e?.message ?? "Upload failed", 500);
  }
}
