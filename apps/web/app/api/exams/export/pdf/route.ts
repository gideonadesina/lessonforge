import type PDFKit from "pdfkit";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";

import type { ExamRecord, ExamResult } from "@/lib/exams/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function sanitizeFileName(value: string) {
  return value
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  view.set(buffer);
  return arrayBuffer;
}

type SupabaseWithToken = ReturnType<typeof createSupabaseWithToken>;

async function fetchExam(
  supabase: SupabaseWithToken,
  examId: string,
  userId: string
): Promise<ExamRecord | null> {
  const { data, error } = await supabase
    .from("exams")
    .select(
      `
      id,
      user_id,
      subject,
      topic_or_coverage,
      class_or_grade,
      school_level,
      curriculum,
      exam_alignment,
      exam_type,
      duration_mins,
      total_marks,
      objective_question_count,
      theory_question_count,
      difficulty_level,
      instructions,
      special_notes,
      school_name,
      exam_title_override,
      exam_title,
      result_json,
      metadata,
      status,
      created_at,
      updated_at
    `
    )
    .eq("id", examId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ExamRecord | null) ?? null;
}

function addHeader(doc: PDFKit.PDFDocument, result: ExamResult) {
  if (result.printableHeader.schoolName) {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#111827")
      .text(result.printableHeader.schoolName, { align: "center" });
    doc.moveDown(0.2);
  }

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text(result.examTitle, { align: "center" });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(
      `${result.subject} | ${result.classOrGrade} | ${result.schoolLevel} | ${result.curriculum}`,
      { align: "center" }
    );
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(
      `${result.examType} | ${result.examAlignment} | Duration: ${result.duration.label} | Total Marks: ${result.totalMarks}`,
      { align: "center" }
    );
  doc.moveDown(0.6);
}

function addCandidateLines(doc: PDFKit.PDFDocument, result: ExamResult) {
  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  for (const field of result.printableHeader.candidateFields) {
    doc.text(`${field}: ________________________________`);
  }
  doc.moveDown(0.6);
}

function addInstructions(doc: PDFKit.PDFDocument, result: ExamResult) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("General Instructions");
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  result.instructions.forEach((instruction, index) => {
    doc.text(`${index + 1}. ${instruction}`);
  });
  doc.moveDown(0.5);
}

function addObjectiveSection(doc: PDFKit.PDFDocument, result: ExamResult) {
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111827")
    .text(`${result.sections.objective.title} (${result.sections.objective.marks} marks)`);
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(10).fillColor("#111827");

  for (const question of result.objectiveSection.questions) {
    doc.text(`${question.number}. ${question.questionText}`);
    question.options.forEach((option, idx) => {
      const label = ["A", "B", "C", "D"][idx] ?? "A";
      doc.text(`   ${label}. ${option}`);
    });
    doc.text(`   Marks: ${question.marks}`);
    doc.moveDown(0.35);
  }
}

function addTheorySection(doc: PDFKit.PDFDocument, result: ExamResult) {
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111827")
    .text(`${result.sections.theory.title} (${result.sections.theory.marks} marks)`);
  doc.moveDown(0.25);

  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  for (const instruction of result.theorySection.instructions) {
    doc.text(`- ${instruction}`);
  }
  doc.moveDown(0.3);

  for (const question of result.theorySection.questions) {
    doc.font("Helvetica-Bold").text(
      `${question.mainQuestionNumber}. ${question.mainQuestionText} (${question.totalMarks} marks)`
    );
    doc.font("Helvetica");
    for (const sub of question.subQuestions) {
      doc.text(`   (${sub.label}) ${sub.questionText}`);
      doc.text(`      Marks: ${sub.marks}`);
    }
    doc.moveDown(0.35);
  }
}

function addMarkingGuide(doc: PDFKit.PDFDocument, result: ExamResult) {
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Marking Guide (Teacher Copy)");
  doc.moveDown(0.4);

  doc.font("Helvetica-Bold").fontSize(11).text("Objective Answer Key");
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10);
  for (const item of result.markingGuide.objectiveAnswerKey) {
    doc.text(`Q${item.questionNumber}: ${item.answerLabel} (${item.marks} marks)`);
  }

  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(11).text("Theory Marking Guide");
  doc.moveDown(0.2);

  for (const guide of result.markingGuide.theoryGuide) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`Question ${guide.mainQuestionNumber} (${guide.totalMarks} marks)`);
    doc.font("Helvetica").fontSize(10);
    for (const sub of guide.subQuestions) {
      doc.text(`  (${sub.label}) ${sub.marks} marks`);
      if (sub.suggestedAnswer) {
        doc.text(`     Suggested answer: ${sub.suggestedAnswer}`);
      }
      if (sub.markingPoints.length) {
        sub.markingPoints.forEach((point) => {
          doc.text(`     - ${point}`);
        });
      }
    }
    doc.moveDown(0.2);
  }

  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").text(
    `Totals: Objective ${result.markingGuide.totals.objectiveMarks}, Theory ${result.markingGuide.totals.theoryMarks}, Overall ${result.markingGuide.totals.overall}`
  );
}

async function renderExamPdf(exam: ExamRecord, teacherMode: boolean) {
  const result = exam.result_json as ExamResult;
  if (!result || typeof result !== "object") {
    throw new Error("Exam result payload is empty");
  }

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    bufferPages: false,
    compress: true,
  });
  const chunks: Buffer[] = [];

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  addHeader(doc, result);
  addCandidateLines(doc, result);
  addInstructions(doc, result);
  addObjectiveSection(doc, result);
  doc.moveDown(0.5);
  addTheorySection(doc, result);

  if (teacherMode) {
    addMarkingGuide(doc, result);
  }

  doc.end();
  return done;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) return jsonError(auth.error, auth.status);

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("id");
    const teacherMode = searchParams.get("mode") === "teacher";
    if (!examId) return jsonError("Missing id", 400);

    const exam = await fetchExam(auth.supabase, examId, auth.user.id);
    if (!exam) return jsonError("Exam not found", 404);

    const pdfBuffer = await renderExamPdf(exam, teacherMode);
    const fileName = sanitizeFileName(`${exam.exam_title}-${teacherMode ? "teacher" : "student"}.pdf`);
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
    return jsonError(getErrorMessage(error, "PDF export failed"), 500);
  }
}
