import PptxGenJS from "pptxgenjs";

import type { SlideDeck, Slide } from "./slideRenderer";
import { resolveSlideImageUrl } from "./slideImageResolver";
import { CATEGORY_LABELS } from "./slideSchema";

// PptxGenJS v4 exposes ShapeType only as an instance getter, not a static property.
// The enum values are identical to their string keys, so we use typed string literals.
const SHAPE_RECT = "rect" as PptxGenJS.ShapeType;
const SHAPE_ROUND_RECT = "roundRect" as PptxGenJS.ShapeType;

const W = 10;
const H = 5.625;
const ACCENT = "6C63FF";    // primary purple
const _ACCENT_DEEP = "4C46B6"; // deep purple (reserved for future gradient shapes)
const DARK = "0D0A1E";     // dark navy
const MUTED = "6B7280";    // muted text
const SOFT = "F3F0FF";     // light purple bg
const AMBER = "FFF7ED";    // amber tint
const NAVY_BG = "0D0A1E";  // title slide bg

type LooseSlide = Partial<Record<string, unknown>>;
type LooseObject = Partial<Record<string, unknown>>;

export async function exportToPptx(deck: SlideDeck): Promise<void> {
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  if (!slides.length) {
    throw new Error("No slides to export");
  }

  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_16x9";
  presentation.author = "LessonForge";
  presentation.company = "LessonForge";
  presentation.title = safeText(deck.deck_title, "Lesson Slides");
  presentation.subject = safeText(deck.subject, "Lesson");
  presentation.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
  };

  for (let i = 0; i < slides.length; i++) {
    const pptSlide = presentation.addSlide();
    pptSlide.background = { color: "FFFFFF" };
    await renderSlideToPptx(pptSlide, slides[i], i + 1, slides.length);
  }

  const fileName = `${safeFilename(deck.deck_title || "lesson")}_slides.pptx`;
  const output = await presentation.write({ outputType: "blob" });
  downloadPptx(output, fileName);
}

async function renderSlideToPptx(
  slide: PptxGenJS.Slide,
  content: Slide,
  slideNumber: number,
  totalSlides: number
): Promise<void> {
  const imageData = await getImageData(getSlideImageUrl(content));

  switch (content.type) {
    case "title":
      renderTitle(slide, content, imageData);
      break;
    case "learning_objectives":
      renderListWithVisual(slide, {
        badge: "Learning Objectives",
        title: content.title,
        eyebrow: content.bloom_level ? `Bloom: ${content.bloom_level}` : undefined,
        items: asStringArray(content.objectives),
        imageData,
        visualSuggestion: content.visual_suggestion,
        visualLabel: "Learning Context",
      });
      break;
    case "concept":
      renderConcept(slide, content, imageData);
      break;
    case "vocabulary":
      renderVocabulary(slide, content, imageData);
      break;
    case "worked_example":
      renderWorkedExample(slide, content, imageData);
      break;
    case "check_for_understanding":
      renderCheck(slide, content, imageData);
      break;
    case "discussion":
      renderDiscussion(slide, content, imageData);
      break;
    case "summary":
      renderListWithVisual(slide, {
        badge: "Lesson Recap",
        title: content.title,
        items: asStringArray(content.takeaways),
        footerTitle: content.connection_to_next ? "Next Lesson" : undefined,
        footerText: content.connection_to_next,
        imageData,
        visualSuggestion: content.visual_suggestion,
        visualLabel: "Recap Visual",
      });
      break;
    case "exit_ticket":
      renderExitTicket(slide, content, imageData);
      break;
    case "real_world_connection": {
      const rwMapped: LooseSlide = {
        ...content,
        explanation:
          getString(content as LooseSlide, "explanation") ||
          getString(content as LooseSlide, "scenario"),
        key_point: getString(content as LooseSlide, "key_point"),
        analogy:
          getString(content as LooseSlide, "analogy") ||
          getString(content as LooseSlide, "student_activity"),
      };
      renderConcept(slide, rwMapped, imageData, "Real-world Connection");
      break;
    }
    default: {
      // Generic renderer — never shows bare "Slide" as the title.
      const anyContent = content as LooseSlide & Record<string, unknown>;
      const badge =
        CATEGORY_LABELS[String(anyContent.type ?? "")] ||
        String(anyContent.type ?? "").replace(/_/g, " ") ||
        "Lesson Content";
      const titleText = getString(anyContent, "title") || badge;
      const bodyText =
        getString(anyContent, "explanation") ||
        getString(anyContent, "scenario") ||
        getString(anyContent, "prompt") ||
        getString(anyContent, "content") ||
        "";
      renderSplitBase(slide, imageData, getString(anyContent, "visual_suggestion"), "Visual Guide");
      addBadge(slide, badge, 0.55, 0.65);
      addTitle(slide, titleText, 0.55, 1.12, 4.55, 0.82, 28);
      if (bodyText) {
        addText(slide, bodyText, 0.58, 2.08, 4.35, 1.5, 12.5, MUTED, false, false, undefined, "top");
      }
      break;
    }
  }

  addChrome(slide, slideNumber, totalSlides);
}

function renderTitle(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  // Dark navy background
  slide.background = { color: NAVY_BG };

  // Right image zone (x=5.5, w=4.5, full height)
  if (imageData) {
    slide.addImage({ data: imageData, x: 5.5, y: 0, w: 4.5, h: H });
    // Gradient overlay: dark-to-transparent left-to-right over image zone
    slide.addShape(SHAPE_RECT, {
      x: 5.5,
      y: 0,
      w: 4.5,
      h: H,
      fill: { color: NAVY_BG, transparency: 55 },
      line: { color: NAVY_BG, transparency: 100 },
    });
  } else {
    // No image: subtle right panel placeholder
    slide.addShape(SHAPE_RECT, {
      x: 5.5,
      y: 0,
      w: 4.5,
      h: H,
      fill: { color: ACCENT, transparency: 88 },
      line: { color: ACCENT, transparency: 100 },
    });
  }

  // Category label pill
  addBadge(slide, "Lesson Opener", 0.5, 0.4, "A78BFA", NAVY_BG, 75);

  // Title
  addTitle(slide, getString(content, "title"), 0.5, 0.8, 4.8, 1.8, 40, "FFFFFF");

  // Subtitle
  const subtitle = getString(content, "subtitle");
  if (subtitle) {
    addText(slide, subtitle, 0.5, 2.75, 4.8, 0.65, 16, "B0A8D0", false, false, undefined, "top");
  }

  // Hook question card
  const hookQuestion = getString(content, "hook_question");
  if (hookQuestion) {
    addPanel(slide, 0.5, 3.58, 4.8, 0.88, NAVY_BG, "FFFFFF", 80);
    addText(slide, "Hook Question", 0.72, 3.7, 2, 0.18, 8, "A78BFA", true);
    addText(slide, `"${hookQuestion}"`, 0.72, 3.92, 4.2, 0.42, 12, "FFFFFF", false, false, undefined, "top");
  }
}

function renderConcept(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null, badge = "Core Concept") {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Visual Guide");
  addBadge(slide, badge, 0.55, 0.65);
  addTitle(slide, getString(content, "title"), 0.55, 1.12, 4.55, 0.82, 28);
  addText(slide, getString(content, "explanation"), 0.58, 2.08, 4.35, 1.0, 12.5, MUTED, false, false, undefined, "top");

  let y = 3.15;
  const keyPoint = getString(content, "key_point");
  if (keyPoint) {
    const h = Math.min(0.94, Math.max(0.68, estimateTextHeight(keyPoint, 3.9, 11, 0.22) + 0.34));
    addPanel(slide, 0.55, y, 4.35, h, AMBER, "F0D38A");
    addText(slide, "Key Point", 0.78, y + 0.13, 1.2, 0.16, 8, "9A6A00", true);
    addText(slide, keyPoint, 0.78, y + 0.36, 3.9, h - 0.44, 11, DARK, true, false, undefined, "top");
    y += h + 0.16;
  }
  const analogy = getString(content, "analogy");
  if (analogy) {
    const h = Math.min(0.82, Math.max(0.62, estimateTextHeight(analogy, 3.9, 10, 0.2) + 0.32));
    addPanel(slide, 0.55, y, 4.35, h, SOFT, "E3D6F3");
    addText(slide, "Analogy", 0.78, y + 0.12, 1.2, 0.16, 8, ACCENT, true);
    addText(slide, analogy, 0.78, y + 0.34, 3.9, h - 0.42, 10, MUTED, false, true, undefined, "top");
  }
}

function renderVocabulary(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  // Full-width vocabulary — no separate visual panel
  slide.background = { color: "FFFFFF" };

  // Header area
  addBadge(slide, "Key Vocabulary", 0.4, 0.25, "7C3AED", SOFT);
  addTitle(slide, getString(content, "title"), 0.4, 0.6, 9.2, 0.72, 28);

  // 2×2 card grid: positions from the design spec
  const CARD_POSITIONS = [
    { x: 0.4, y: 1.4 },
    { x: 5.1, y: 1.4 },
    { x: 0.4, y: 3.3 },
    { x: 5.1, y: 3.3 },
  ];
  const cardW = 4.5;
  const cardH = 1.8;

  const terms = getObjectArray(content, "terms").slice(0, 4);
  terms.forEach((term, idx) => {
    const pos = CARD_POSITIONS[idx];
    if (!pos) return;
    // Card with left accent border
    addPanel(slide, pos.x, pos.y, cardW, cardH, "FFFFFF", "EDE9FE");
    slide.addShape(SHAPE_RECT, {
      x: pos.x, y: pos.y, w: 0.04, h: cardH,
      fill: { color: ACCENT }, line: { color: ACCENT },
    });
    // Letter badge
    slide.addShape(SHAPE_ROUND_RECT, {
      x: pos.x + 0.15, y: pos.y + 0.15, w: 0.35, h: 0.35,
      rectRadius: 0.06,
      fill: { color: ACCENT }, line: { color: ACCENT },
    });
    addText(slide, String.fromCharCode(65 + idx), pos.x + 0.15, pos.y + 0.15, 0.35, 0.35, 10, "FFFFFF", true, false, undefined, "middle");
    // Term name
    addText(slide, getFirstString(term, ["word", "term", "name"], "Term"), pos.x + 0.62, pos.y + 0.16, 3.6, 0.32, 12, DARK, true);
    // Definition
    addText(slide, getString(term, "definition", "Definition unavailable."), pos.x + 0.18, pos.y + 0.6, 4.1, 0.9, 8.5, MUTED, false, false, undefined, "top");
    // Example (if present)
    const example = getString(term, "example");
    if (example) {
      addPanel(slide, pos.x + 0.18, pos.y + 1.45, 4.1, 0.28, AMBER, "FDE68A");
      addText(slide, `e.g. ${example}`, pos.x + 0.28, pos.y + 1.5, 3.9, 0.16, 7.5, "92400E", false, true);
    }
  });

  // If 5-6 terms, render extras as simple list below
  getObjectArray(content, "terms").slice(4, 6).forEach((term, idx) => {
    const word = getFirstString(term, ["word", "term", "name"], "Term");
    const def = getString(term, "definition", "");
    const y = 5.12 + idx * 0.18;
    addText(slide, `${String.fromCharCode(69 + idx)}. ${word}: ${def}`, 0.4, y, 9.2, 0.14, 7.5, MUTED);
  });
}

function renderWorkedExample(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Worked Visual");
  addBadge(slide, "Worked Example", 0.55, 0.55);
  addTitle(slide, getString(content, "title"), 0.55, 0.98, 4.45, 0.72, 25);

  const steps = getObjectArray(content, "steps").slice(0, 5);
  let y = 1.82;
  steps.forEach((step, idx) => {
    const instruction = getString(step, "instruction", "Step unavailable.");
    const tip = getString(step, "tip");
    const cardH = Math.min(0.76, Math.max(0.54, estimateTextHeight(instruction, 3.55, 9.2, 0.18) + (tip ? 0.2 : 0) + 0.22));
    if (y + cardH > 5.1) return;
    addPanel(slide, 0.55, y, 4.35, cardH, "FFFFFF", "E5E7EB");
    addText(slide, getString(step, "step_num", String(idx + 1)), 0.72, y + 0.14, 0.28, 0.18, 8.5, "FFFFFF", true, false, DARK);
    addText(slide, instruction, 1.12, y + 0.1, 3.55, tip ? cardH - 0.28 : cardH - 0.18, 9.2, DARK, false, false, undefined, "top");
    if (tip) {
      addText(slide, `Tip: ${tip}`, 1.12, y + 0.34, 3.55, 0.13, 7.5, "9A6A00");
    }
    y += cardH + 0.12;
  });
}

function renderCheck(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Question Context");
  addBadge(slide, "Check for Understanding", 0.55, 0.55);
  addTitle(slide, getString(content, "question"), 0.55, 0.98, 4.5, 0.92, 22);

  const choices = getObjectArray(content, "choices").slice(0, 5);
  let y = 2.05;
  choices.forEach((choice, idx) => {
    const text = getString(choice, "text", "Choice unavailable.");
    const cardH = Math.min(0.62, Math.max(0.46, estimateTextHeight(text, 3.55, 9, 0.18) + 0.22));
    if (y + cardH > 4.85) return;
    addPanel(slide, 0.55, y, 4.35, cardH, "FFFFFF", getBool(choice, "is_correct") ? "A7F3D0" : "E5E7EB");
    addText(slide, getString(choice, "label", String.fromCharCode(65 + idx)), 0.72, y + 0.12, 0.28, 0.16, 8, DARK, true, false, "F3F4F6");
    addText(slide, text, 1.12, y + 0.1, 3.55, cardH - 0.18, 9, DARK, false, false, undefined, "top");
    y += cardH + 0.12;
  });
  const explanation = getString(content, "explanation");
  if (explanation) {
    addPanel(slide, 0.55, 5.02, 4.35, 0.38, "F7F7F8", "E5E7EB");
    addText(slide, `Why: ${explanation}`, 0.72, 5.13, 3.9, 0.14, 8.5, MUTED);
  }
}

function renderDiscussion(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Discussion Visual", true);
  addBadge(slide, "Discussion", 5.45, 0.65);
  if (getBool(content, "think_pair_share")) {
    addBadge(slide, "Think Pair Share", 8.0, 0.65, ACCENT, SOFT);
  }

  addPanel(slide, 5.45, 1.25, 4.0, 1.65, DARK, DARK);
  addText(slide, "Prompt", 5.75, 1.48, 1.1, 0.18, 8, "DCC8F1", true);
  addText(slide, `"${getString(content, "prompt")}"`, 5.75, 1.78, 3.45, 0.86, 16, "FFFFFF", true, false, undefined, "top");

  const questions = getStringArray(content, "guiding_questions").slice(0, 3);
  let y = 3.12;
  questions.forEach((question, idx) => {
    const cardH = Math.min(0.62, Math.max(0.48, estimateTextHeight(question, 2.95, 8.8, 0.18) + 0.22));
    if (y + cardH > 5.05) return;
    addPanel(slide, 5.45, y, 4.0, cardH, "FFFFFF", "E5E7EB");
    addText(slide, `Q${idx + 1}`, 5.66, y + 0.14, 0.38, 0.15, 8, ACCENT, true, false, SOFT);
    addText(slide, question, 6.18, y + 0.1, 2.95, cardH - 0.18, 8.8, DARK, false, false, undefined, "top");
    y += cardH + 0.12;
  });
}

function renderExitTicket(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Exit Context");
  addBadge(slide, "Exit Ticket", 0.55, 0.65);
  addTitle(slide, getString(content, "title"), 0.55, 1.12, 4.45, 0.72, 27);

  addPanel(slide, 0.55, 2.05, 4.35, 1.15, DARK, DARK);
  addText(slide, "Reflection Prompt", 0.82, 2.27, 1.8, 0.16, 8, "DCC8F1", true);
  addText(slide, getString(content, "prompt"), 0.82, 2.55, 3.75, 0.5, 13, "FFFFFF", true, false, undefined, "top");

  const starters = getStringArray(content, "sentence_starters").slice(0, 3);
  starters.forEach((starter, idx) => {
    const y = 3.45 + idx * 0.42;
    addPanel(slide, 0.55, y, 4.35, 0.32, "FFFFFF", "D1D5DB");
    addText(slide, `${starter} __________`, 0.72, y + 0.08, 3.8, 0.16, 8.2, MUTED, false, true);
  });

  if (getBool(content, "self_rating")) {
    addText(slide, "Confidence:  1    2    3    4    5", 0.6, 4.92, 3.5, 0.18, 10, MUTED, true);
  }
}

function renderListWithVisual(
  slide: PptxGenJS.Slide,
  opts: {
    badge: string;
    title: string;
    eyebrow?: string;
    items: string[];
    footerTitle?: string;
    footerText?: string;
    imageData: string | null;
    visualSuggestion?: string;
    visualLabel: string;
  }
) {
  renderSplitBase(slide, opts.imageData, opts.visualSuggestion, opts.visualLabel);

  // Purple left accent bar
  slide.addShape(SHAPE_RECT, {
    x: 0, y: 0, w: 0.06, h: H,
    fill: { color: ACCENT }, line: { color: ACCENT },
  });

  addBadge(slide, opts.badge, 0.5, 0.3, "7C3AED", SOFT);
  if (opts.eyebrow) addBadge(slide, opts.eyebrow, 3.2, 0.3, "92400E", AMBER);
  addTitle(slide, opts.title, 0.5, 0.65, 5.5, 0.9, 28);

  let y = 1.7;
  opts.items.slice(0, 4).forEach((item, idx) => {
    const cardH = Math.min(0.75, Math.max(0.52, estimateTextHeight(item, 4.4, 9.5, 0.18) + 0.24));
    if (y + cardH > 4.88) return;
    addPanel(slide, 0.5, y, 5.5, cardH, "F9F8FF", "EDE9FE");
    // Number circle
    slide.addShape(SHAPE_ROUND_RECT, {
      x: 0.65, y: y + 0.12, w: 0.3, h: 0.3,
      rectRadius: 0.15,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });
    addText(slide, String(idx + 1), 0.65, y + 0.12, 0.3, 0.3, 8, "FFFFFF", true, false, undefined, "middle");
    addText(slide, item, 1.1, y + 0.08, 4.4, cardH - 0.18, 9.5, DARK, false, false, undefined, "top");
    y += cardH + 0.1;
  });

  // Summary: "next lesson" footer card
  if (opts.footerTitle && opts.footerText) {
    addPanel(slide, 0.5, y + 0.05, 5.5, 0.48, SOFT, "DDD6FE");
    addText(slide, opts.footerTitle, 0.68, y + 0.12, 1.0, 0.14, 7.5, ACCENT, true);
    addText(slide, opts.footerText, 1.75, y + 0.1, 3.8, 0.22, 8, DARK, false, false, undefined, "top");
  }
}

function renderSplitBase(
  slide: PptxGenJS.Slide,
  imageData: string | null,
  suggestion?: string,
  label = "Visual Guide",
  imageLeft = false
) {
  const visualX = imageLeft ? 0 : 5.8;
  const visualW = 4.2;
  const textX = imageLeft ? 4.2 : 0;
  const textW = 5.8;

  // Text side: white
  slide.addShape(SHAPE_RECT, {
    x: textX, y: 0, w: textW, h: H,
    fill: { color: "FFFFFF" }, line: { color: "FFFFFF" },
  });

  if (imageData) {
    slide.addImage({ data: imageData, x: visualX, y: 0, w: visualW, h: H });
    // Bottom fade overlay
    slide.addShape(SHAPE_RECT, {
      x: visualX, y: H * 0.55, w: visualW, h: H * 0.45,
      fill: { color: DARK, transparency: 45 },
      line: { color: DARK, transparency: 100 },
    });
  } else {
    addVisualPlaceholder(slide, visualX, 0, visualW, H, suggestion, label);
  }

  // Caption card at bottom of visual zone
  if (imageData && (label || suggestion)) {
    addPanel(slide, visualX + 0.25, 4.5, visualW - 0.5, 0.72, "FFFFFF", "EDE9FE", 5);
    addText(slide, label, visualX + 0.42, 4.6, visualW - 0.9, 0.14, 7.5, ACCENT, true, false, undefined, "top");
    if (suggestion) {
      addText(slide, suggestion, visualX + 0.42, 4.78, visualW - 0.9, 0.3, 8, DARK, true, false, undefined, "top");
    }
  }
}

function addVisualPlaceholder(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  suggestion?: string,
  label = "Visual Guide"
) {
  slide.addShape(SHAPE_RECT, {
    x, y, w, h,
    fill: { color: "F3F0FF" }, line: { color: "F3F0FF" },
  });
  // Accent panel
  slide.addShape(SHAPE_ROUND_RECT, {
    x: x + 0.5, y: y + h / 2 - 0.65, w: w - 1.0, h: 1.3,
    rectRadius: 0.1,
    fill: { color: "FFFFFF", transparency: 15 },
    line: { color: ACCENT, transparency: 60 },
  });
  addText(slide, label, x + 0.7, y + h / 2 - 0.42, w - 1.4, 0.2, 9, ACCENT, true);
  addText(slide, suggestion || "Visual placeholder", x + 0.7, y + h / 2 - 0.16, w - 1.4, 0.44, 10.5, DARK, true, false, undefined, "top");
}

function addChrome(slide: PptxGenJS.Slide, slideNumber: number, totalSlides: number) {
  addText(slide, "Generated by LessonForge", 0.3, 5.3, 4.0, 0.25, 9, "9CA3AF");
  addText(slide, `${slideNumber} / ${totalSlides}`, 8.5, 5.3, 1.2, 0.25, 9, "9CA3AF", false, false, undefined, "middle");
}

function addBadge(
  slide: PptxGenJS.Slide,
  text: unknown,
  x: number,
  y: number,
  color = "7C3AED",
  fill = SOFT,
  transparency = 0
) {
  slide.addText(safeText(text).toUpperCase(), {
    x,
    y,
    w: 2.2,
    h: 0.28,
    fontSize: 8,
    color,
    bold: true,
    fontFace: "Arial",
    fit: "shrink",
    margin: 0.06,
    fill: { color: fill, transparency },
    line: { color: "EDE9FE", transparency },
    align: "left",
    charSpacing: 2,
  });
}

function addTitle(
  slide: PptxGenJS.Slide,
  text: unknown,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  color = DARK
) {
  addText(slide, text, x, y, w, h, fontSize, color, true);
}

function addText(
  slide: PptxGenJS.Slide,
  text: unknown,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  color = DARK,
  bold = false,
  italic = false,
  fill?: string,
  valign: "top" | "middle" | "bottom" = "middle"
) {
  slide.addText(safeText(text), {
    x,
    y,
    w,
    h,
    fontSize,
    color,
    bold,
    italic,
    fontFace: "Arial",
    breakLine: false,
    fit: "shrink",
    margin: 0.03,
    valign,
    ...(fill ? { fill: { color: fill }, line: { color: fill } } : {}),
  });
}

function addPanel(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  line: string,
  transparency = 0
) {
  slide.addShape(SHAPE_ROUND_RECT, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill, transparency },
    line: { color: line, transparency: Math.min(transparency + 20, 100), width: 0.6 },
  });
}

async function getImageData(url?: string | null): Promise<string | null> {
  if (!url || typeof url !== "string") return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch (error) {
    console.warn("[exportToPptx] Skipping image that could not be embedded:", url, error);
    return null;
  }
}

function getSlideImageUrl(source: LooseSlide): string {
  return resolveSlideImageUrl(source) || "";
}

function estimateTextHeight(text: unknown, width: number, fontSize: number, lineHeight = 0.2): number {
  const charsPerLine = Math.max(14, Math.floor((width * 13.5) / Math.max(fontSize, 1)));
  const lineCount = Math.max(1, Math.ceil(safeText(text).length / charsPerLine));
  return lineCount * lineHeight;
}

function downloadPptx(output: string | ArrayBuffer | Blob | Uint8Array, fileName: string) {
  const blob =
    output instanceof Blob
      ? output
      : output instanceof Uint8Array
      ? new Blob([new Uint8Array(output)], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        })
      : new Blob([output], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function getString(source: LooseSlide, key: string, fallback = ""): string {
  return safeText(source[key], fallback);
}

function getBool(source: LooseSlide, key: string): boolean {
  return source[key] === true;
}

function getStringArray(source: LooseSlide, key: string): string[] {
  return asStringArray(source[key]);
}

function getObjectArray(source: LooseSlide, key: string): LooseObject[] {
  const value = source[key];
  return Array.isArray(value)
    ? value.filter((item): item is LooseObject => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function getFirstString(source: LooseSlide, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = getString(source, key);
    if (value) return value;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => safeText(item)).filter(Boolean)
    : [];
}

function safeText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function safeFilename(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 50);
  return cleaned || "lesson";
}
