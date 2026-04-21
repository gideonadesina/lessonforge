import { jsPDF } from "jspdf";

import type { SlideDeck, Slide } from "./slideRenderer";

export async function exportToPdf(deck: SlideDeck): Promise<void> {
  if (!deck?.slides?.length) {
    throw new Error("No slides to export");
  }

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];

    if (i > 0) {
      pdf.addPage();
    }

    renderSlideToPdf(pdf, slide, margin, contentWidth, pageWidth, pageHeight);
  }

  const safeName = (deck.deck_title || "lesson")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50);

  pdf.save(`${safeName}_slides.pdf`);
}

function renderSlideToPdf(
  pdf: jsPDF,
  slide: Slide,
  margin: number,
  contentWidth: number,
  pageWidth: number,
  pageHeight: number
): void {
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  let yPos = margin + 20;
  const lineHeight = 14;

  const addText = (text: string, fontSize: number, color: number[] = [30, 30, 39], isBold = false) => {
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color[0], color[1], color[2]);
    if (isBold) {
      pdf.setFont("helvetica", "bold");
    } else {
      pdf.setFont("helvetica", "normal");
    }
    
    const lines = pdf.splitTextToSize(text, contentWidth);
    pdf.text(lines, margin, yPos);
    yPos += lines.length * lineHeight + 8;
  };

  const addWrappedText = (text: string, fontSize: number, color: number[] = [80, 80, 90], isBold = false) => {
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color[0], color[1], color[2]);
    if (isBold) {
      pdf.setFont("helvetica", "bold");
    } else {
      pdf.setFont("helvetica", "normal");
    }
    
    const lines = pdf.splitTextToSize(text, contentWidth);
    pdf.text(lines, margin, yPos);
    yPos += lines.length * lineHeight + 12;
  };

  switch (slide.type) {
    case "title":
      addText(slide.title, 36, [30, 30, 39], true);
      if (slide.subtitle) {
        yPos += 10;
        addWrappedText(slide.subtitle, 18, [80, 80, 90]);
      }
      if (slide.hook_question) {
        yPos += 20;
        pdf.setFillColor(245, 240, 255);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 50, 3, 3, "F");
        addText("Hook Question", 10, [128, 82, 183], true);
        yPos += 15;
        addWrappedText(`"${slide.hook_question}"`, 14, [60, 60, 80], true);
      }
      break;

    case "learning_objectives":
      addText("Learning Objectives", 10, [128, 82, 183], true);
      yPos += 5;
      if (slide.bloom_level) {
        pdf.setFillColor(255, 247, 230);
        pdf.roundedRect(margin, yPos - 3, 100, 18, 2, 2, "F");
        addText(`Bloom · ${slide.bloom_level}`, 9, [180, 140, 50], true);
        yPos += 25;
      }
      addText(slide.title, 28, [30, 30, 39], true);
      yPos += 10;
      addText("By the end of this lesson, learners will be able to:", 12, [100, 100, 100]);
      yPos += 20;
      slide.objectives.forEach((obj, idx) => {
        pdf.setFillColor(245, 240, 255);
        pdf.roundedRect(margin, yPos - 5, 30, 22, 2, 2, "F");
        addText(String(idx + 1), 12, [255, 255, 255], true);
        addWrappedText(obj, 13, [60, 60, 70]);
        yPos += 5;
      });
      break;

    case "concept":
      addText("Core Concept", 10, [128, 82, 183], true);
      yPos += 10;
      addText(slide.title, 28, [30, 30, 39], true);
      yPos += 10;
      addWrappedText(slide.explanation, 14, [60, 60, 70]);
      if (slide.analogy) {
        yPos += 15;
        pdf.setFillColor(245, 240, 255);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 80, 3, 3, "F");
        pdf.setDrawColor(200, 180, 230);
        pdf.roundedRect(margin, yPos - 5, 6, 80, 3, 3, "S");
        addText("Analogy", 10, [128, 82, 183], true);
        yPos += 15;
        addWrappedText(slide.analogy, 13, [70, 70, 80], true);
      }
      if (slide.key_point) {
        yPos += 15;
        pdf.setFillColor(255, 247, 230);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 60, 3, 3, "F");
        addText("Key Point", 10, [180, 140, 50], true);
        yPos += 15;
        addWrappedText(slide.key_point, 14, [50, 50, 50], true);
      }
      break;

    case "vocabulary":
      addText("Key Vocabulary", 10, [128, 82, 183], true);
      yPos += 10;
      addText(slide.title, 28, [30, 30, 39], true);
      yPos += 20;
      slide.terms.forEach((term, idx) => {
        pdf.setFillColor(250, 250, 252);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 60, 3, 3, "F");
        pdf.setDrawColor(230, 230, 235);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 60, 3, 3, "S");
        
        pdf.setFillColor(240, 235, 255);
        pdf.roundedRect(margin + 10, yPos, 24, 24, 2, 2, "F");
        addText(String.fromCharCode(65 + idx), 12, [128, 82, 183], true);
        
        yPos += 35;
        addText(term.word, 16, [30, 30, 39], true);
        addWrappedText(term.definition, 12, [80, 80, 90]);
        if (term.example) {
          addText(`e.g. ${term.example}`, 10, [140, 140, 140], true);
        }
        yPos += 10;
      });
      break;

    case "worked_example":
      addText("Worked Example", 10, [128, 82, 183], true);
      yPos += 10;
      addText(slide.title, 28, [30, 30, 39], true);
      yPos += 20;
      slide.steps.forEach((step) => {
        pdf.setFillColor(40, 40, 45);
        pdf.roundedRect(margin, yPos - 5, 30, 30, 3, 3, "F");
        addText(String(step.step_num), 14, [255, 255, 255], true);
        
        const stepText = step.instruction;
        const stepLines = pdf.splitTextToSize(stepText, contentWidth - 50);
        pdf.text(stepLines, margin + 45, yPos + 8);
        yPos += stepLines.length * lineHeight + 20;
        
        if (step.tip) {
          pdf.setFillColor(255, 250, 230);
          pdf.roundedRect(margin + 45, yPos - 5, contentWidth - 45, 30, 2, 2, "F");
          addText(`Tip: ${step.tip}`, 10, [180, 140, 50]);
          yPos += 25;
        }
      });
      break;

    case "check_for_understanding":
      addText("Check for Understanding", 10, [128, 82, 183], true);
      yPos += 10;
      addWrappedText(slide.question, 20, [30, 30, 39], true);
      yPos += 20;
      slide.choices.forEach((choice) => {
        pdf.setFillColor(250, 250, 252);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 35, 3, 3, "F");
        pdf.setDrawColor(230, 230, 235);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 35, 3, 3, "S");
        
        pdf.setFillColor(245, 245, 250);
        pdf.roundedRect(margin + 10, yPos, 28, 28, 2, 2, "F");
        addText(choice.label, 12, [80, 80, 90], true);
        
        addWrappedText(choice.text, 13, [60, 60, 70]);
        yPos += 45;
      });
      if (slide.explanation) {
        yPos += 10;
        pdf.setFillColor(245, 245, 250);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 40, 3, 3, "F");
        addText(`Why: ${slide.explanation}`, 11, [80, 80, 90]);
      }
      break;

    case "discussion":
      addText("Discussion", 10, [128, 82, 183], true);
      if (slide.think_pair_share) {
        pdf.setFillColor(250, 250, 252);
        pdf.roundedRect(pageWidth - margin - 120, margin + 15, 110, 22, 3, 3, "F");
        addText("Think · Pair · Share", 9, [128, 82, 183], true);
      }
      yPos += 30;
      const promptLines = pdf.splitTextToSize(`"${slide.prompt}"`, contentWidth);
      promptLines.forEach((line: string) => {
        addText(line, 24, [40, 40, 50], true);
      });
      if (slide.guiding_questions?.length) {
        yPos += 30;
        addText("Guiding Questions:", 12, [100, 100, 100], true);
        yPos += 20;
        slide.guiding_questions.forEach((q, idx) => {
          addText(`Q${idx + 1}: ${q}`, 12, [70, 70, 80]);
        });
      }
      break;

    case "summary":
      addText("Lesson Recap", 10, [128, 82, 183], true);
      yPos += 10;
      addText(slide.title, 28, [30, 30, 39], true);
      yPos += 20;
      slide.takeaways.forEach((takeaway) => {
        pdf.setFillColor(250, 250, 252);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 30, 3, 3, "F");
        
        pdf.setFillColor(128, 82, 183);
        pdf.circle(margin + 15, yPos + 8, 4, "F");
        
        addWrappedText(takeaway, 13, [60, 60, 70]);
        yPos += 10;
      });
      if (slide.connection_to_next) {
        yPos += 15;
        pdf.setFillColor(255, 247, 230);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 50, 3, 3, "F");
        addText("Next Lesson", 10, [180, 140, 50], true);
        yPos += 15;
        addWrappedText(slide.connection_to_next, 12, [80, 80, 80]);
      }
      break;

    case "exit_ticket":
      addText("Exit Ticket", 10, [128, 82, 183], true);
      yPos += 10;
      addText(slide.title, 28, [30, 30, 39], true);
      yPos += 15;
      pdf.setFillColor(245, 240, 255);
      pdf.roundedRect(margin, yPos - 5, contentWidth, 50, 3, 3, "F");
      addWrappedText(slide.prompt, 14, [60, 60, 70], true);
      yPos += 60;
      if (slide.sentence_starters?.length) {
        addText("Sentence Starters:", 11, [100, 100, 100], true);
        yPos += 15;
        slide.sentence_starters.forEach((starter) => {
          pdf.setFillColor(250, 250, 252);
          pdf.roundedRect(margin, yPos - 5, contentWidth, 25, 2, 2, "F");
          addText(`${starter} ___________________`, 11, [100, 100, 100], true);
          yPos += 30;
        });
      }
      if (slide.self_rating) {
        yPos += 10;
        addText("Rate your confidence: 1   2   3   4   5", 12, [80, 80, 80]);
      }
      break;

    default:
      addText("Slide", 24, [100, 100, 100], true);
  }

  yPos = pageHeight - 30;
  pdf.setFontSize(9);
  pdf.setTextColor(180, 180, 180);
  pdf.text("Generated by LessonForge", margin, yPos);
  
  pdf.setFontSize(9);
  const currentPage = pdf.getNumberOfPages();
  pdf.text(`Slide ${currentPage}`, pageWidth - margin - 30, yPos);
}