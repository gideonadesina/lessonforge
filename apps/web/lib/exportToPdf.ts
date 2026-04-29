import { jsPDF } from "jspdf";

import type { SlideDeck, Slide } from "./slideRenderer";
import { resolveSlideImageUrl } from "./slideImageResolver";
import { CATEGORY_LABELS } from "./slideSchema";

const ACCENT = [83, 74, 183] as const;   // brand #534AB7
const DARK = [23, 23, 33] as const;
const MUTED = [102, 107, 120] as const;
const AMBER_BG = [255, 244, 216] as const;
const SOFT_BG = [244, 239, 251] as const;

export async function exportToPdf(deck: SlideDeck): Promise<void> {
  if (!deck?.slides?.length) {
    throw new Error("No slides to export");
  }

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();   // 792
  const pageHeight = pdf.internal.pageSize.getHeight(); // 612

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i] as any;
    if (i > 0) pdf.addPage();

    let imgData: string | null = null;
    const imageUrl = resolveSlideImageUrl(slide);
    if (imageUrl) {
      try {
        imgData = await fetchImageAsBase64(imageUrl);
      } catch {}
    }

    renderSlideToPdf(pdf, slide, imgData, pageWidth, pageHeight);
  }

  const safeName = (deck.deck_title || "lesson")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50);

  pdf.save(`${safeName}_slides.pdf`);
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function wrapText(pdf: jsPDF, text: unknown, width: number, fontSize: number, bold = false): string[] {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return [""];

  pdf.setFontSize(fontSize);
  pdf.setFont("helvetica", bold ? "bold" : "normal");

  const lines: string[] = [];
  let current = "";

  for (const word of value.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || pdf.getTextWidth(candidate) <= width) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function renderSlideToPdf(
  pdf: jsPDF,
  slide: Slide,
  imgData: string | null,
  pageWidth: number,
  pageHeight: number
): void {
  const hasImage = !!imgData;
  const margin = 40;
  // Text lives in the left panel; image fills the right panel full-bleed
  const splitX = hasImage ? Math.round(pageWidth * 0.52) : pageWidth;
  const textWidth = splitX - margin * 2;
  const contentBottom = pageHeight - 38;

  // ── Backgrounds ───────────────────────────────────────────────
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  if (hasImage && imgData) {
    // Full-height right panel image
    pdf.addImage(imgData, "JPEG", splitX, 0, pageWidth - splitX, pageHeight);
    // Subtle dark overlay for better text contrast on the image side
    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new (pdf as any).GState({ opacity: 0.08 }));
    pdf.rect(splitX, 0, pageWidth - splitX, pageHeight, "F");
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
  } else if (hasImage === false) {
    // Purple placeholder for right panel (no image)
    pdf.setFillColor(...SOFT_BG);
    pdf.rect(splitX, 0, pageWidth - splitX, pageHeight, "F");
  }

  // Thin vertical separator line
  if (hasImage || true) {
    pdf.setDrawColor(230, 230, 235);
    pdf.setLineWidth(0.5);
    pdf.line(splitX, 0, splitX, pageHeight);
  }

  let yPos = margin + 24;

  const addLabel = (text: string, color: readonly [number, number, number] = ACCENT) => {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...color);
    pdf.text(text.toUpperCase(), margin, yPos);
    yPos += 14;
  };

  const addTitle = (text: string, fontSize = 28) => {
    pdf.setFontSize(fontSize);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...DARK);
    const lines = wrapText(pdf, text, textWidth, fontSize, true);
    pdf.text(lines, margin, yPos);
    yPos += lines.length * (fontSize * 1.35) + 8;
  };

  const addBody = (text: string, fontSize = 13, color: readonly [number, number, number] = MUTED, bold = false) => {
    pdf.setFontSize(fontSize);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(...color);
    const lines = wrapText(pdf, text, textWidth, fontSize, bold);
    pdf.text(lines, margin, yPos);
    yPos += lines.length * (fontSize * 1.4) + 6;
  };

  const addPanel = (
    panelY: number,
    panelH: number,
    fill: readonly [number, number, number],
    stroke: readonly [number, number, number]
  ) => {
    pdf.setFillColor(...fill);
    pdf.setDrawColor(...stroke);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(margin, panelY, textWidth, panelH, 4, 4, "FD");
  };

  // ── Slide content ──────────────────────────────────────────────
  switch (slide.type) {
    case "title": {
      addLabel("Lesson Opener");
      yPos += 6;
      addTitle(slide.title, 32);
      if (slide.subtitle) addBody(slide.subtitle, 16, MUTED);
      if (slide.hook_question) {
        yPos += 10;
        const panelH = 72;
        addPanel(yPos - 6, panelH, SOFT_BG, [200, 180, 230]);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...ACCENT);
        pdf.text("HOOK QUESTION", margin + 12, yPos + 10);
        yPos += 22; // advance past the label so body text starts below it
        addBody(`"${slide.hook_question}"`, 14, DARK, true);
      }
      break;
    }

    case "learning_objectives": {
      addLabel("Learning Objectives");
      if (slide.bloom_level) {
        const bw = pdf.getTextWidth(`Bloom · ${slide.bloom_level}`) + 20;
        pdf.setFillColor(...AMBER_BG);
        pdf.roundedRect(margin, yPos - 4, bw, 16, 3, 3, "F");
        addBody(`Bloom · ${slide.bloom_level}`, 8.5, [154, 106, 0], true);
      }
      addTitle(slide.title, 26);
      yPos += 4;
      (slide.objectives as string[]).forEach((obj, idx) => {
        const lines = wrapText(pdf, obj, textWidth - 40, 11);
        const rowH = Math.max(30, lines.length * 14 + 14);
        if (yPos + rowH > contentBottom) return;
        addPanel(yPos - 4, rowH, [250, 250, 252], [230, 230, 235]);
        pdf.setFillColor(...ACCENT);
        pdf.roundedRect(margin + 6, yPos - 2, 20, 20, 2, 2, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text(String(idx + 1), margin + 16 - pdf.getTextWidth(String(idx + 1)) / 2, yPos + 12);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...DARK);
        pdf.text(lines, margin + 32, yPos + 10);
        yPos += rowH + 6;
      });
      break;
    }

    case "concept": {
      addLabel("Core Concept");
      addTitle(slide.title, 26);
      addBody(slide.explanation, 13);
      if (slide.key_point) {
        yPos += 4;
        const kh = 52;
        addPanel(yPos - 4, kh, AMBER_BG, [240, 211, 138]);
        addBody("Key Point", 8, [154, 106, 0], true);
        addBody(slide.key_point, 12, DARK, true);
      }
      if (slide.analogy) {
        yPos += 4;
        const ah = 52;
        addPanel(yPos - 4, ah, SOFT_BG, [200, 180, 230]);
        addBody("Analogy", 8, ACCENT as unknown as readonly [number, number, number], true);
        addBody(slide.analogy, 11, MUTED);
      }
      break;
    }

    case "vocabulary": {
      addLabel("Key Vocabulary");
      addTitle(slide.title, 24);
      (slide.terms as any[]).slice(0, 6).forEach((term, idx) => {
        const word = term.word || term.term || term.name || "Term";
        const defLines = wrapText(pdf, term.definition || "", textWidth - 44, 9.5);
        const th = Math.max(52, defLines.length * 12 + 32);
        if (yPos + th > contentBottom) return;
        addPanel(yPos - 4, th, [250, 250, 252], [230, 230, 235]);
        pdf.setFillColor(...ACCENT);
        pdf.roundedRect(margin + 6, yPos - 2, 20, 20, 2, 2, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        const label = String.fromCharCode(65 + idx);
        pdf.text(label, margin + 16 - pdf.getTextWidth(label) / 2, yPos + 12);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...DARK);
        pdf.text(word, margin + 32, yPos + 10);
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...MUTED);
        pdf.text(defLines, margin + 32, yPos + 24);
        yPos += th + 8;
      });
      break;
    }

    case "worked_example": {
      addLabel("Worked Example");
      addTitle(slide.title, 26);
      (slide.steps as any[]).forEach((step, idx) => {
        const instLines = wrapText(pdf, step.instruction || "", textWidth - 46, 11);
        const tipLines = step.tip ? wrapText(pdf, `Tip: ${step.tip}`, textWidth - 46, 9) : [];
        const stepH = Math.max(step.tip ? 58 : 38, instLines.length * 14 + tipLines.length * 11 + 18);
        if (yPos + stepH > contentBottom) return;
        addPanel(yPos - 4, stepH, [250, 250, 252], [230, 230, 235]);
        pdf.setFillColor(...DARK);
        pdf.roundedRect(margin + 6, yPos - 2, 22, 22, 3, 3, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        const num = String(step.step_num ?? idx + 1);
        pdf.text(num, margin + 17 - pdf.getTextWidth(num) / 2, yPos + 12);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...DARK);
        pdf.text(instLines, margin + 34, yPos + 11);
        if (step.tip) {
          pdf.setFontSize(9);
          pdf.setTextColor(154, 106, 0);
          pdf.text(tipLines, margin + 34, yPos + 26);
        }
        yPos += stepH + 6;
      });
      break;
    }

    case "check_for_understanding": {
      addLabel("Check for Understanding");
      addBody(slide.question, 18, DARK, true);
      yPos += 6;
      (slide.choices as any[]).forEach((choice) => {
        const correct = choice.is_correct === true;
        const choiceLines = wrapText(pdf, choice.text || "", textWidth - 34, 11);
        const ch = Math.max(34, choiceLines.length * 14 + 14);
        if (yPos + ch > contentBottom) return;
        const fillRgb: readonly [number, number, number] = correct ? [167, 243, 208] : [250, 250, 252];
        const strokeRgb: readonly [number, number, number] = correct ? [110, 231, 183] : [230, 230, 235];
        addPanel(yPos - 4, ch, fillRgb, strokeRgb);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...DARK);
        pdf.text(choice.label || "•", margin + 10, yPos + 10);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.text(choiceLines, margin + 26, yPos + 10);
        yPos += ch + 5;
      });
      if (slide.explanation) {
        yPos += 4;
        addPanel(yPos - 4, 32, [247, 247, 248], [230, 230, 235]);
        addBody(`Why: ${slide.explanation}`, 9.5, MUTED);
      }
      break;
    }

    case "discussion": {
      addLabel("Discussion");
      yPos += 6;
      const promptH = 70;
      addPanel(yPos - 4, promptH, [23, 23, 33], [23, 23, 33]);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(220, 200, 241);
      pdf.text("PROMPT", margin + 12, yPos + 14);
      const promptLines = wrapText(pdf, `"${slide.prompt}"`, textWidth - 24, 16, true).slice(0, 3);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(promptLines, margin + 12, yPos + 32);
      yPos += promptH + 12;
      if (slide.think_pair_share) {
        addBody("Think · Pair · Share", 9, ACCENT as unknown as readonly [number, number, number], true);
      }
      (slide.guiding_questions as string[] | undefined)?.slice(0, 4).forEach((q, idx) => {
        const qLines = wrapText(pdf, q, textWidth - 34, 10.5);
        const qh = Math.max(32, qLines.length * 13 + 13);
        if (yPos + qh > contentBottom) return;
        addPanel(yPos - 4, qh, [250, 250, 252], [230, 230, 235]);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...ACCENT);
        pdf.text(`Q${idx + 1}`, margin + 10, yPos + 11);
        pdf.setFontSize(10.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...DARK);
        pdf.text(qLines, margin + 28, yPos + 11);
        yPos += qh + 5;
      });
      break;
    }

    case "summary": {
      addLabel("Lesson Recap");
      addTitle(slide.title, 26);
      yPos += 4;
      (slide.takeaways as string[]).forEach((t) => {
        const lines = wrapText(pdf, t, textWidth - 34, 11);
        const th = Math.max(32, lines.length * 14 + 12);
        if (yPos + th > contentBottom) return;
        addPanel(yPos - 4, th, [250, 250, 252], [230, 230, 235]);
        pdf.setFillColor(...ACCENT);
        pdf.circle(margin + 14, yPos + 10, 4, "F");
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...DARK);
        pdf.text(lines, margin + 26, yPos + 11);
        yPos += th + 5;
      });
      if (slide.connection_to_next) {
        yPos += 6;
        addPanel(yPos - 4, 48, AMBER_BG, [240, 211, 138]);
        addBody("Next Lesson", 8, [154, 106, 0], true);
        addBody(slide.connection_to_next, 11, DARK);
      }
      break;
    }

    case "exit_ticket": {
      addLabel("Exit Ticket");
      addTitle(slide.title, 26);
      yPos += 4;
      const promptH2 = 60;
      addPanel(yPos - 4, promptH2, SOFT_BG, [200, 180, 230]);
      addBody("Reflection Prompt", 8, ACCENT as unknown as readonly [number, number, number], true);
      addBody(slide.prompt, 14, DARK, true);
      yPos += 10;
      (slide.sentence_starters as string[] | undefined)?.slice(0, 3).forEach((s) => {
        const sh = 26;
        addPanel(yPos - 4, sh, [250, 250, 252], [220, 220, 225]);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...MUTED);
        const starter = wrapText(pdf, `${s} ___________________`, textWidth - 20, 10).slice(0, 2);
        pdf.text(starter, margin + 10, yPos + 10);
        yPos += sh + 5;
      });
      if (slide.self_rating) {
        yPos += 4;
        addBody("Confidence: 1   2   3   4   5", 11, MUTED);
      }
      break;
    }

    case "real_world_connection": {
      const rwSlide = slide as unknown as Record<string, unknown>;
      addLabel("Real-world Connection");
      addTitle(String(rwSlide.title || "Where You See This in Real Life"), 26);
      const rwBody = String(rwSlide.explanation ?? rwSlide.scenario ?? "");
      if (rwBody) addBody(rwBody, 13);
      const rwKey = String(
        rwSlide.key_point ??
        (Array.isArray(rwSlide.connection_points) ? (rwSlide.connection_points as string[])[0] ?? "" : "") ??
        ""
      );
      if (rwKey) {
        yPos += 4;
        addPanel(yPos - 4, 52, AMBER_BG, [240, 211, 138]);
        addBody("Key Connection", 8, [154, 106, 0], true);
        addBody(rwKey, 12, DARK, true);
      }
      const rwActivity = String(rwSlide.analogy ?? rwSlide.student_activity ?? "");
      if (rwActivity) {
        yPos += 4;
        addPanel(yPos - 4, 52, SOFT_BG, [200, 180, 230]);
        addBody("Activity", 8, ACCENT as unknown as readonly [number, number, number], true);
        addBody(rwActivity, 11, MUTED);
      }
      break;
    }

    default: {
      // Generic renderer for any unrecognised slide type — never shows bare "Slide".
      const anySlide = slide as unknown as Record<string, unknown>;
      const categoryLabel =
        CATEGORY_LABELS[String(anySlide.type ?? "")] ||
        String(anySlide.type ?? "").replace(/_/g, " ") ||
        "Lesson Content";
      addLabel(categoryLabel);
      const titleText = String(anySlide.title || categoryLabel);
      addTitle(titleText, 26);
      const bodyText = String(
        anySlide.explanation ?? anySlide.scenario ?? anySlide.prompt ??
        anySlide.content ?? anySlide.description ?? ""
      );
      if (bodyText) addBody(bodyText, 13);
      break;
    }
  }

  // ── Footer chrome ───────────────────────────────────────────
  const footerY = pageHeight - 18;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(180, 180, 190);
  pdf.text("Generated by LessonForge", margin, footerY);
  const pageLabel = `Slide ${pdf.getNumberOfPages()}`;
  pdf.text(pageLabel, splitX - margin - pdf.getTextWidth(pageLabel), footerY);
}
