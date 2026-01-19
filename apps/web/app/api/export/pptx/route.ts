import PptxGenJS from "pptxgenjs";

export const runtime = "nodejs";

type SlideIn = { title?: string; bullets?: string[] };

type LessonPack = {
  meta?: { subject?: string; topic?: string; grade?: string };
  slides?: SlideIn[];
};

function safeStr(x: any, fallback = "") {
  return typeof x === "string" ? x : fallback;
}
function safeArr<T = any>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function toNodeBuffer(out: any): Buffer {
  if (Buffer.isBuffer(out)) return out;
  if (out instanceof Uint8Array) return Buffer.from(out);
  if (out?.buffer) return Buffer.from(out.buffer);
  return Buffer.from(out);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { meta?: LessonPack["meta"]; slides?: SlideIn[] };

    const slidesIn = safeArr<SlideIn>(body?.slides);
    if (!slidesIn.length) {
      return Response.json({ error: "Missing 'slides' in request body" }, { status: 400 });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";

    const meta = body?.meta ?? {};
    const subject = safeStr(meta.subject, "Lesson");
    const topic = safeStr(meta.topic, "");
    const grade = safeStr(meta.grade, "");

    const titleSlide = pptx.addSlide();
    titleSlide.addText(`${subject}${topic ? `: ${topic}` : ""}`, {
      x: 0.7,
      y: 1.3,
      w: 12,
      h: 1,
      fontSize: 34,
      bold: true,
    });
    titleSlide.addText(grade ? `Grade ${grade}` : "", {
      x: 0.7,
      y: 2.2,
      w: 12,
      h: 0.6,
      fontSize: 18,
      color: "666666",
    });

    slidesIn.slice(0, 12).forEach((s, idx) => {
      const slide = pptx.addSlide();

      slide.addText(safeStr(s?.title, `Slide ${idx + 1}`), {
        x: 0.7,
        y: 0.5,
        w: 12,
        h: 0.6,
        fontSize: 26,
        bold: true,
      });

      const bullets = safeArr<string>(s?.bullets)
        .map((b) => safeStr(b).trim())
        .filter(Boolean)
        .slice(0, 8);

      const bulletText = bullets.length ? bullets.map((b) => `• ${b}`).join("\n") : "• (No bullets)";

      slide.addText(bulletText, {
        x: 1.0,
        y: 1.3,
        w: 11.5,
        h: 5.0,
        fontSize: 18,
        color: "222222",
        valign: "top",
      });
    });

    const out = await (pptx as any).write("nodebuffer");
    const buf = toNodeBuffer(out);

    const filename = `LessonForge-${Date.now()}.pptx`;

    return new Response(buf as any, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: "PPTX export failed", message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
