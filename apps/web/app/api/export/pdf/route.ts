import PDFDocument from "pdfkit";

export const runtime = "nodejs";



type LessonPack = {
  meta?: {
    subject?: string;
    topic?: string;
    grade?: string;
    curriculum?: string;
    durationMins?: number;
  };
  objectives?: string[];
  lessonNotes?: string;
  slides?: { title?: string; bullets?: string[] }[];
  quiz?: {
    mcq?: { question?: string; options?: string[]; answerIndex?: number }[];
    theory?: { question?: string; markingGuide?: string }[];
  };
  liveApplications?: string[];
};

function s(x: any, fallback = ""): string {
  return typeof x === "string" ? x : fallback;
}
function a<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}

function pdfToBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { lesson?: LessonPack; filename?: string };

    const lesson = body?.lesson;
    if (!lesson) {
      return Response.json({ error: "Missing 'lesson' in request body" }, { status: 400 });
    }

    const meta = lesson.meta ?? {};
    const subject = s(meta.subject, "Lesson");
    const topic = s(meta.topic, "");
    const grade = s(meta.grade, "");
    const curriculum = s(meta.curriculum, "");
    const durationMins = typeof meta.durationMins === "number" ? meta.durationMins : undefined;

    const title = `${subject}${topic ? `: ${topic}` : ""}${grade ? ` (Grade ${grade})` : ""}`;

    // Build PDF
    const doc = new (PDFDocument as any)({ size: "A4", margin: 50 });

    // Title
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text(title);
    doc.moveDown(0.5);

    const subtitleBits = [
      curriculum ? `Curriculum: ${curriculum}` : "",
      durationMins ? `Duration: ${durationMins} mins` : "",
    ].filter(Boolean);

    if (subtitleBits.length) {
      doc.font("Helvetica").fontSize(10).fillColor("#475569").text(subtitleBits.join(" • "));
      doc.moveDown(1);
    } else {
      doc.moveDown(0.5);
    }

    // Objectives
    const objectives = a<string>(lesson.objectives);
    if (objectives.length) {
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text("Objectives");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(11).fillColor("#0f172a");
      objectives.forEach((o) => doc.text(`• ${s(o)}`));
      doc.moveDown(0.8);
    }

    // Lesson Notes
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text("Lesson Notes");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).fillColor("#0f172a").text(s(lesson.lessonNotes, "No lesson notes generated."), {
      align: "left",
    });
    doc.moveDown(0.8);

    // Slides outline (optional)
    const slides = a<any>(lesson.slides);
    if (slides.length) {
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text("Slides Outline");
      doc.moveDown(0.3);

      slides.slice(0, 12).forEach((sl, idx) => {
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(`${idx + 1}. ${s(sl?.title, "Untitled slide")}`);
        doc.font("Helvetica").fontSize(11).fillColor("#0f172a");
        a<string>(sl?.bullets).slice(0, 8).forEach((b) => doc.text(`   • ${s(b)}`));
        doc.moveDown(0.4);
      });

      doc.moveDown(0.6);
    }

    // Quiz (optional)
    const mcq = a<any>(lesson.quiz?.mcq);
    const theory = a<any>(lesson.quiz?.theory);

    if (mcq.length || theory.length) {
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text("Quiz");
      doc.moveDown(0.3);

      if (mcq.length) {
        doc.font("Helvetica-Bold").fontSize(12).text("Multiple Choice");
        doc.font("Helvetica").fontSize(11);

        mcq.slice(0, 10).forEach((q, i) => {
          doc.fillColor("#0f172a").text(`${i + 1}. ${s(q?.question, "Question")}`);
          const opts = a<string>(q?.options).slice(0, 4);
          opts.forEach((opt, j) => doc.text(`   ${String.fromCharCode(65 + j)}) ${s(opt)}`));
          const ai = typeof q?.answerIndex === "number" ? q.answerIndex : null;
          if (ai !== null && ai >= 0 && ai <= 3) {
            doc.fillColor("#475569").text(`   Answer: ${String.fromCharCode(65 + ai)}`);
          }
          doc.moveDown(0.3);
        });

        doc.moveDown(0.4);
      }

      if (theory.length) {
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Theory");
        doc.font("Helvetica").fontSize(11);

        theory.slice(0, 2).forEach((t, i) => {
          doc.fillColor("#0f172a").text(`${i + 1}. ${s(t?.question, "Theory question")}`);
          const mg = s(t?.markingGuide, "");
          if (mg) doc.fillColor("#475569").text(`Marking guide: ${mg}`);
          doc.moveDown(0.3);
        });
      }
    }

    // Live applications (optional)
    const apps = a<string>(lesson.liveApplications);
    if (apps.length) {
      doc.addPage();
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text("Live Applications");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(11).fillColor("#0f172a");
      apps.slice(0, 8).forEach((x) => doc.text(`• ${s(x)}`));
    }

    const pdfBuf = await pdfToBuffer(doc);

    const filename = body?.filename || `LessonForge-${Date.now()}.pdf`;

    // ✅ Important: cast avoids TS "BodyInit" complaints in some Next setups
    return new Response(pdfBuf as unknown as BodyInit, {
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
