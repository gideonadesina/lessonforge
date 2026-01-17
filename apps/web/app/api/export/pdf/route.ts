import PDFDocument from "pdfkit";

export const runtime = "nodejs";

type PDFDocumentType = InstanceType<typeof PDFDocument>;

type LessonPack = {
  meta?: { subject?: string; topic?: string; grade?: string; curriculum?: string };
  objectives?: string[];
  lessonNotes?: string;
  slides?: { title?: string; bullets?: string[] }[];
  quiz?: {
    mcq?: { question?: string; options?: string[]; answerIndex?: number }[];
    theory?: { question?: string; markingGuide?: string }[];
  };
  liveApplications?: string[];
};

function safeStr(x: unknown, fallback = ""): string {
  return typeof x === "string" ? x : fallback;
}
function safeArr<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

/** Collect PDFKit output into a Node Buffer */
function bufferFromPdf(doc: PDFDocumentType): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { lesson?: LessonPack; filename?: string };
    const lesson = body?.lesson;

    if (!lesson?.meta?.subject) {
      return Response.json({ error: "Missing 'lesson.meta.subject' in request body" }, { status: 400 });
    }

    const meta = lesson.meta ?? {};
    const subject = safeStr(meta.subject, "Lesson");
    const topic = safeStr(meta.topic, "");
    const grade = safeStr(meta.grade, "");
    const curriculum = safeStr(meta.curriculum, "");

    const title = `${subject}${topic ? `: ${topic}` : ""}${grade ? ` (Grade ${grade})` : ""}`;

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    // Title
    doc.fontSize(18).fillColor("black").text(title);
    doc.moveDown(0.4);

    if (curriculum) {
      doc.fontSize(10).fillColor("gray").text(`Curriculum: ${curriculum}`);
      doc.moveDown(0.8);
    } else {
      doc.moveDown(0.4);
    }

    // Objectives
    const objectives = safeArr<string>(lesson.objectives);
    doc.fontSize(14).fillColor("black").text("Objectives");
    doc.moveDown(0.25);
    doc.fontSize(11);
    if (objectives.length) objectives.forEach((o) => doc.text(`• ${o}`));
    else doc.fillColor("gray").text("No objectives provided.").fillColor("black");
    doc.moveDown(0.8);

    // Notes
    doc.fontSize(14).fillColor("black").text("Lesson Notes");
    doc.moveDown(0.25);
    doc.fontSize(11).text(safeStr(lesson.lessonNotes, "No lesson notes generated."), { align: "left" });
    doc.moveDown(0.8);

    // Slides
    const slides = safeArr<any>(lesson.slides);
    if (slides.length) {
      doc.fontSize(14).fillColor("black").text("Slides Outline");
      doc.moveDown(0.25);
      slides.slice(0, 12).forEach((s: any, idx: number) => {
        doc.font("Helvetica-Bold").fontSize(11).text(`${idx + 1}. ${safeStr(s?.title, "Untitled slide")}`);
        doc.font("Helvetica").fontSize(11);
        safeArr<string>(s?.bullets).slice(0, 8).forEach((b) => doc.text(`   • ${b}`));
        doc.moveDown(0.35);
      });
      doc.moveDown(0.5);
    }

    // Quiz
    const mcq = safeArr<any>(lesson.quiz?.mcq);
    const theory = safeArr<any>(lesson.quiz?.theory);

    if (mcq.length || theory.length) {
      doc.fontSize(14).fillColor("black").text("Quiz");
      doc.moveDown(0.25);

      if (mcq.length) {
        doc.font("Helvetica-Bold").fontSize(12).text("Multiple Choice");
        doc.font("Helvetica").fontSize(11);
        mcq.slice(0, 10).forEach((q: any, i: number) => {
          doc.text(`${i + 1}. ${safeStr(q?.question, "Question")}`);
          const opts = safeArr<string>(q?.options).slice(0, 4);
          opts.forEach((opt, j) => doc.text(`   ${String.fromCharCode(65 + j)}) ${opt}`));
          const ai = typeof q?.answerIndex === "number" ? q.answerIndex : null;
          if (ai !== null && ai >= 0 && ai <= 3) doc.fillColor("gray").text(`   Answer: ${String.fromCharCode(65 + ai)}`).fillColor("black");
          doc.moveDown(0.25);
        });
        doc.moveDown(0.35);
      }

      if (theory.length) {
        doc.font("Helvetica-Bold").fontSize(12).text("Theory");
        doc.font("Helvetica").fontSize(11);
        theory.slice(0, 2).forEach((t: any, i: number) => {
          doc.text(`${i + 1}. ${safeStr(t?.question, "Theory question")}`);
          const mg = safeStr(t?.markingGuide, "");
          if (mg) doc.fillColor("gray").text(`Marking guide: ${mg}`).fillColor("black");
          doc.moveDown(0.25);
        });
      }
    }

    const pdfBuf = await bufferFromPdf(doc);
    const filename = body?.filename || `LessonForge-${Date.now()}.pdf`;

    // ✅ TS-safe BodyInit: use Uint8Array
    const bytes = new Uint8Array(pdfBuf);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: "PDF export failed", message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
