import PptxGenJS from "pptxgenjs";

import type { SlideDeck, Slide } from "./slideRenderer";

export async function exportToPptx(deck: SlideDeck): Promise<void> {
  if (!deck?.slides?.length) {
    throw new Error("No slides to export");
  }

  const presentation = new PptxGenJS();

  presentation.layout = "LAYOUT_16x9";
  presentation.author = "LessonForge";
  presentation.title = deck.deck_title || "Lesson Slides";
  presentation.subject = deck.subject;

  const slideWidth = 10;
  const slideHeight = 5.625;
  const margin = 0.5;
  const contentWidth = slideWidth - margin * 2;

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const s = presentation.addSlide();

    s.background = { color: "FFFFFF" };

    renderSlideToPptx(s, slide, margin, contentWidth, slideWidth, slideHeight);
  }

  const safeName = (deck.deck_title || "lesson")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50);

  await presentation.writeFile({ fileName: `${safeName}_slides.pptx` });
}

function renderSlideToPptx(
  slide: PptxGenJS.Slide,
  content: Slide,
  margin: number,
  contentWidth: number,
  totalWidth: number,
  totalHeight: number
): void {
  const accentColor = "8249B7";
  const textDark = "1E1E27";
  const textMuted = "6B6B7B";

  slide.addText("LessonForge", {
    x: totalWidth - 1.5,
    y: 0.15,
    w: 1.3,
    h: 0.3,
    fontSize: 8,
    color: "A0A0A0",
    align: "right",
  });

  slide.addText(`Slide ${slide.slideNumber}`, {
    x: totalWidth - 1.5,
    y: totalHeight - 0.35,
    w: 1.3,
    h: 0.2,
    fontSize: 8,
    color: "A0A0A0",
    align: "right",
  });

  let yPos = margin + 0.3;

  const addTitle = (text: string, fontSize = 24, color = textDark) => {
    slide.addText(text, {
      x: margin,
      y: yPos,
      w: contentWidth,
      h: 0.6,
      fontSize,
      color,
      fontFace: "Arial",
      bold: true,
    });
    yPos += 0.7;
  };

  const addSubtext = (text: string, fontSize = 12, color = textMuted) => {
    slide.addText(text, {
      x: margin,
      y: yPos,
      w: contentWidth,
      h: 0.4,
      fontSize,
      color,
      fontFace: "Arial",
    });
    yPos += 0.5;
  };

  const addBadge = (text: string, bgColor = "F3EEFB") => {
    slide.addText(text, {
      x: margin,
      y: yPos,
      w: 1.2,
      h: 0.25,
      fontSize: 9,
      color: accentColor,
      fontFace: "Arial",
      bold: true,
      fill: { color: bgColor },
    });
    yPos += 0.35;
  };

  const addPill = (text: string, bgColor = "FFF8E6", color = "B8941F") => {
    slide.addText(text, {
      x: totalWidth - margin - 1.5,
      y: margin + 0.3,
      w: 1.4,
      h: 0.25,
      fontSize: 9,
      color,
      fontFace: "Arial",
      bold: true,
      fill: { color: bgColor },
      align: "center",
    });
  };

  const addBox = (text: string, options: { x?: number; w?: number; fill?: string } = {}) => {
    const boxX = options.x ?? margin;
    const boxW = options.w ?? contentWidth;
    slide.addText(text, {
      x: boxX,
      y: yPos,
      w: boxW,
      h: 0.5,
      fontSize: 12,
      color: textDark,
      fontFace: "Arial",
      fill: { color: options.fill ?? "FFFFFF" },
    });
    yPos += 0.6;
  };

  switch (content.type) {
    case "title":
      slide.addShape(PptxGenJS.ShapeType.rect, {
        x: 0,
        y: 0,
        w: totalWidth,
        h: totalHeight,
        fill: { color: "F8F6FC" },
      });
      addBadge("Lesson Opener", "EEDFF7");
      yPos = totalHeight / 2 - 0.8;
      addTitle(content.title, 36, textDark);
      if (content.subtitle) {
        addSubtext(content.subtitle, 18, textMuted);
      }
      if (content.hook_question) {
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: margin,
          y: yPos + 0.3,
          w: contentWidth,
          h: 0.8,
          fill: { color: "FFFFFF" },
          line: { color: "E5D6F7", pt: 1 },
        });
        addSubtext(`Hook: "${content.hook_question}"`, 14, "4A3B5C");
      }
      break;

    case "learning_objectives":
      addBadge("Learning Objectives", "EEDFF7");
      if (content.bloom_level) {
        addPill(`Bloom · ${content.bloom_level}`, "FFF8E6", "B8941F");
      }
      addTitle(content.title, 28);
      addSubtext("By the end of this lesson, learners will be able to:", 11);
      yPos += 0.2;
      content.objectives.forEach((obj, idx) => {
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: margin,
          y: yPos,
          w: 0.4,
          h: 0.4,
          fill: { color: accentColor },
        });
        slide.addText(String(idx + 1), {
          x: margin,
          y: yPos + 0.05,
          w: 0.4,
          h: 0.3,
          fontSize: 10,
          color: "FFFFFF",
          bold: true,
          align: "center",
        });
        slide.addText(obj, {
          x: margin + 0.5,
          y: yPos,
          w: contentWidth - 0.5,
          h: 0.4,
          fontSize: 12,
          color: textDark,
        });
        yPos += 0.5;
      });
      break;

    case "concept":
      addBadge("Core Concept", "EEDFF7");
      addTitle(content.title, 28);
      addBox(content.explanation, { fill: "F5F5F7" });
      if (content.analogy) {
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: margin,
          y: yPos,
          w: 0.08,
          h: 1.2,
          fill: { color: accentColor },
        });
        slide.addText("Analogy", {
          x: margin + 0.2,
          y: yPos,
          w: 1,
          h: 0.2,
          fontSize: 9,
          color: accentColor,
          bold: true,
        });
        slide.addText(content.analogy, {
          x: margin + 0.2,
          y: yPos + 0.25,
          w: contentWidth - 0.2,
          h: 0.8,
          fontSize: 12,
          color: textDark,
          italic: true,
        });
        yPos += 1.3;
      }
      if (content.key_point) {
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: margin,
          y: yPos,
          w: contentWidth,
          h: 0.8,
          fill: { color: "FFF8E6" },
        });
        slide.addText("Key Point", {
          x: margin + 0.2,
          y: yPos + 0.1,
          w: 1,
          h: 0.2,
          fontSize: 9,
          color: "B8941F",
          bold: true,
        });
        slide.addText(content.key_point, {
          x: margin + 0.2,
          y: yPos + 0.35,
          w: contentWidth - 0.4,
          h: 0.4,
          fontSize: 13,
          color: textDark,
          bold: true,
        });
      }
      break;

    case "vocabulary":
      addBadge("Key Vocabulary", "EEDFF7");
      addTitle(content.title, 28);
      yPos += 0.1;
      const colWidth = (contentWidth - 0.3) / 2;
      content.terms.forEach((term, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const termX = margin + col * (colWidth + 0.3);
        const termY = yPos + row * 1.3;
        
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: termX,
          y: termY,
          w: colWidth,
          h: 1.1,
          fill: { color: "FFFFFF" },
          line: { color: "E5E5EA", pt: 1 },
        });
        
        slide.addShape(PptxGenJS.ShapeType.roundRect, {
          x: termX + 0.15,
          y: termY + 0.15,
          w: 0.3,
          h: 0.3,
          fill: { color: "EDE8F5" },
        });
        slide.addText(String.fromCharCode(65 + idx), {
          x: termX + 0.15,
          y: termY + 0.2,
          w: 0.3,
          h: 0.2,
          fontSize: 10,
          color: accentColor,
          bold: true,
          align: "center",
        });
        
        slide.addText(term.word, {
          x: termX + 0.5,
          y: termY + 0.15,
          w: colWidth - 0.6,
          h: 0.25,
          fontSize: 13,
          color: textDark,
          bold: true,
        });
        slide.addText(term.definition, {
          x: termX + 0.15,
          y: termY + 0.5,
          w: colWidth - 0.3,
          h: 0.45,
          fontSize: 10,
          color: textMuted,
        });
        if (term.example) {
          slide.addText(`e.g. ${term.example}`, {
            x: termX + 0.15,
            y: termY + 0.95,
            w: colWidth - 0.3,
            h: 0.15,
            fontSize: 9,
            color: "999999",
            italic: true,
          });
        }
      });
      break;

    case "worked_example":
      addBadge("Worked Example", "EEDFF7");
      addTitle(content.title, 28);
      yPos += 0.2;
      content.steps.forEach((step) => {
        slide.addShape(PptxGenJS.ShapeType.roundRect, {
          x: margin,
          y: yPos,
          w: 0.4,
          h: 0.4,
          fill: { color: "1E1E27" },
        });
        slide.addText(String(step.step_num), {
          x: margin,
          y: yPos + 0.05,
          w: 0.4,
          h: 0.3,
          fontSize: 11,
          color: "FFFFFF",
          bold: true,
          align: "center",
        });
        
        slide.addText(step.instruction, {
          x: margin + 0.5,
          y: yPos,
          w: contentWidth - 0.5,
          h: 0.4,
          fontSize: 12,
          color: textDark,
        });
        
        if (step.tip) {
          slide.addShape(PptxGenJS.ShapeType.rect, {
            x: margin + 0.5,
            y: yPos + 0.45,
            w: contentWidth - 0.5,
            h: 0.25,
            fill: { color: "FFF8E6" },
          });
          slide.addText(`Tip: ${step.tip}`, {
            x: margin + 0.6,
            y: yPos + 0.5,
            w: contentWidth - 0.7,
            h: 0.15,
            fontSize: 9,
            color: "B8941F",
          });
          yPos += 0.7;
        } else {
          yPos += 0.5;
        }
      });
      break;

    case "check_for_understanding":
      addBadge("Check for Understanding", "EEDFF7");
      addTitle(content.question, 20);
      yPos += 0.2;
      content.choices.forEach((choice) => {
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: margin,
          y: yPos,
          w: 0.35,
          h: 0.35,
          fill: { color: "F5F5F7" },
          line: { color: "E5E5EA", pt: 1 },
        });
        slide.addText(choice.label, {
          x: margin,
          y: yPos + 0.05,
          w: 0.35,
          h: 0.25,
          fontSize: 11,
          color: textMuted,
          bold: true,
          align: "center",
        });
        
        slide.addText(choice.text, {
          x: margin + 0.45,
          y: yPos,
          w: contentWidth - 0.45,
          h: 0.35,
          fontSize: 12,
          color: textDark,
        });
        yPos += 0.5;
      });
      if (content.explanation) {
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: margin,
          y: yPos,
          w: contentWidth,
          h: 0.4,
          fill: { color: "F5F5F7" },
        });
        slide.addText(`Why: ${content.explanation}`, {
          x: margin + 0.2,
          y: yPos + 0.1,
          w: contentWidth - 0.4,
          h: 0.2,
          fontSize: 10,
          color: textMuted,
        });
      }
      break;

    case "discussion":
      addBadge("Discussion", "EEDFF7");
      if (content.think_pair_share) {
        addPill("Think · Pair · Share", "EEDFF7", accentColor);
      }
      yPos = totalHeight / 2 - 0.5;
      slide.addText(`"${content.prompt}"`, {
        x: margin,
        y: yPos,
        w: contentWidth,
        h: 1,
        fontSize: 22,
        color: textDark,
        bold: true,
        align: "center",
      });
      if (content.guiding_questions?.length) {
        yPos += 1.3;
        addSubtext("Guiding Questions:", 11, textMuted);
        content.guiding_questions.forEach((q, idx) => {
          slide.addText(`Q${idx + 1}: ${q}`, {
            x: margin,
            y: yPos,
            w: contentWidth,
            h: 0.3,
            fontSize: 11,
            color: textMuted,
          });
          yPos += 0.35;
        });
      }
      break;

    case "summary":
      addBadge("Lesson Recap", "EEDFF7");
      addTitle(content.title, 28);
      yPos += 0.2;
      content.takeaways.forEach((takeaway) => {
        slide.addShape(PptxGenJS.ShapeType.ellipse, {
          x: margin + 0.1,
          y: yPos + 0.1,
          w: 0.15,
          h: 0.15,
          fill: { color: accentColor },
        });
        slide.addText(takeaway, {
          x: margin + 0.35,
          y: yPos,
          w: contentWidth - 0.35,
          h: 0.35,
          fontSize: 12,
          color: textDark,
        });
        yPos += 0.45;
      });
      if (content.connection_to_next) {
        slide.addShape(PptxGenJS.ShapeType.rect, {
          x: margin,
          y: yPos,
          w: contentWidth,
          h: 0.6,
          fill: { color: "FFF8E6" },
        });
        slide.addText("Next Lesson", {
          x: margin + 0.2,
          y: yPos + 0.1,
          w: 1,
          h: 0.2,
          fontSize: 9,
          color: "B8941F",
          bold: true,
        });
        slide.addText(content.connection_to_next, {
          x: margin + 0.2,
          y: yPos + 0.3,
          w: contentWidth - 0.4,
          h: 0.25,
          fontSize: 11,
          color: textDark,
        });
      }
      break;

    case "exit_ticket":
      addBadge("Exit Ticket", "EEDFF7");
      addTitle(content.title, 28);
      slide.addShape(PptxGenJS.ShapeType.rect, {
        x: margin,
        y: yPos + 0.2,
        w: contentWidth,
        h: 0.7,
        fill: { color: "F8F6FC" },
        line: { color: "E5D6F7", pt: 1 },
      });
      addSubtext(content.prompt, 13, textDark);
      yPos += 1;
      if (content.sentence_starters?.length) {
        addSubtext("Sentence Starters:", 10, textMuted);
        content.sentence_starters.forEach((starter) => {
          slide.addText(`${starter} ___________________`, {
            x: margin,
            y: yPos,
            w: contentWidth,
            h: 0.25,
            fontSize: 11,
            color: textMuted,
            italic: true,
          });
          yPos += 0.3;
        });
      }
      if (content.self_rating) {
        slide.addText("Rate your confidence:  1    2    3    4    5", {
          x: margin,
          y: yPos + 0.2,
          w: contentWidth,
          h: 0.3,
          fontSize: 12,
          color: textMuted,
        });
      }
      break;

    default:
      addTitle("Slide", 20, textMuted);
  }
}