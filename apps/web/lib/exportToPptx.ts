import PptxGenJS from "pptxgenjs";

import type { SlideDeck, Slide } from "./slideRenderer";

// PptxGenJS v4 exposes ShapeType only as an instance getter, not a static property.
// The enum values are identical to their string keys, so we use typed string literals.
const SHAPE_RECT = "rect" as PptxGenJS.ShapeType;
const SHAPE_ROUND_RECT = "roundRect" as PptxGenJS.ShapeType;

const W = 10;
const H = 5.625;
const ACCENT = "534AB7";
const DARK = "171721";
const MUTED = "666B78";
const SOFT = "F4EFFB";
const AMBER = "FFF4D8";

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
    default:
      addTitle(slide, "Slide", 0.7, 0.8, 8.6, 0.6, 28);
      break;
  }

  addChrome(slide, slideNumber, totalSlides);
}

function renderTitle(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  if (imageData) {
    slide.addImage({ data: imageData, x: 0, y: 0, w: W, h: H });
  } else {
    slide.addShape(SHAPE_RECT, {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: "F4EFFB" },
      line: { color: "F4EFFB" },
    });
    addVisualPlaceholder(slide, 5.6, 0, 4.4, H, getString(content, "visual_suggestion"), "Hero Visual");
  }

  slide.addShape(SHAPE_RECT, {
    x: 0,
    y: 0,
    w: W,
    h: H,
    fill: { color: "000000", transparency: imageData ? 25 : 12 },
    line: { color: "000000", transparency: 100 },
  });

  addBadge(slide, "Lesson Opener", 0.65, 0.75, "FFFFFF", "FFFFFF", 70);
  addTitle(slide, getString(content, "title"), 0.65, 1.55, 6.9, 1.45, 40, "FFFFFF");

  const subtitle = getString(content, "subtitle");
  if (subtitle) {
    addText(slide, subtitle, 0.68, 3.05, 6.5, 0.55, 17, "FFFFFF", false);
  }

  const hookQuestion = getString(content, "hook_question");
  if (hookQuestion) {
    addPanel(slide, 0.65, 3.82, 6.85, 0.9, "FFFFFF", "FFFFFF", 65);
    addText(slide, "Hook Question", 0.85, 3.98, 2, 0.18, 8, "F3E8FF", true);
    addText(slide, `"${hookQuestion}"`, 0.85, 4.2, 6.35, 0.38, 15, "FFFFFF", true);
  }
}

function renderConcept(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Visual Guide");
  addBadge(slide, "Core Concept", 0.55, 0.65);
  addTitle(slide, getString(content, "title"), 0.55, 1.12, 4.55, 0.82, 28);
  addText(slide, getString(content, "explanation"), 0.58, 2.08, 4.35, 1, 14, MUTED, false);

  let y = 3.15;
  const keyPoint = getString(content, "key_point");
  if (keyPoint) {
    addPanel(slide, 0.55, y, 4.35, 0.82, AMBER, "F0D38A");
    addText(slide, "Key Point", 0.78, y + 0.13, 1.2, 0.16, 8, "9A6A00", true);
    addText(slide, keyPoint, 0.78, y + 0.36, 3.9, 0.25, 12, DARK, true);
    y += 0.98;
  }
  const analogy = getString(content, "analogy");
  if (analogy) {
    addPanel(slide, 0.55, y, 4.35, 0.72, SOFT, "E3D6F3");
    addText(slide, "Analogy", 0.78, y + 0.12, 1.2, 0.16, 8, ACCENT, true);
    addText(slide, analogy, 0.78, y + 0.34, 3.9, 0.24, 11, MUTED, false, true);
  }
}

function renderVocabulary(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Vocabulary Context");
  addBadge(slide, "Key Vocabulary", 0.55, 0.55);
  addTitle(slide, getString(content, "title"), 0.55, 0.98, 4.45, 0.6, 26);

  const terms = getObjectArray(content, "terms").slice(0, 6);
  const cardW = 2.05;
  const cardH = 0.95;
  terms.forEach((term, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.55 + col * 2.22;
    const y = 1.8 + row * 1.1;
    addPanel(slide, x, y, cardW, cardH, "FFFFFF", "E5E7EB");
    addText(slide, String.fromCharCode(65 + idx), x + 0.13, y + 0.13, 0.32, 0.22, 9, "FFFFFF", true, false, ACCENT);
    addText(slide, getFirstString(term, ["word", "term", "name"], "Term"), x + 0.52, y + 0.13, 1.35, 0.22, 11, DARK, true);
    addText(slide, getString(term, "definition", "Definition unavailable."), x + 0.15, y + 0.45, 1.75, 0.34, 8.5, MUTED);
  });
}

function renderWorkedExample(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Worked Visual");
  addBadge(slide, "Worked Example", 0.55, 0.55);
  addTitle(slide, getString(content, "title"), 0.55, 0.98, 4.45, 0.72, 25);

  const steps = getObjectArray(content, "steps").slice(0, 5);
  steps.forEach((step, idx) => {
    const y = 1.9 + idx * 0.66;
    addPanel(slide, 0.55, y, 4.35, 0.53, "FFFFFF", "E5E7EB");
    addText(slide, getString(step, "step_num", String(idx + 1)), 0.72, y + 0.14, 0.28, 0.18, 8.5, "FFFFFF", true, false, DARK);
    addText(slide, getString(step, "instruction", "Step unavailable."), 1.12, y + 0.11, 3.55, 0.22, 10, DARK);
    const tip = getString(step, "tip");
    if (tip) {
      addText(slide, `Tip: ${tip}`, 1.12, y + 0.34, 3.55, 0.13, 7.5, "9A6A00");
    }
  });
}

function renderCheck(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Question Context");
  addBadge(slide, "Check for Understanding", 0.55, 0.55);
  addTitle(slide, getString(content, "question"), 0.55, 0.98, 4.5, 0.92, 22);

  const choices = getObjectArray(content, "choices").slice(0, 5);
  choices.forEach((choice, idx) => {
    const y = 2.05 + idx * 0.58;
    addPanel(slide, 0.55, y, 4.35, 0.46, "FFFFFF", getBool(choice, "is_correct") ? "A7F3D0" : "E5E7EB");
    addText(slide, getString(choice, "label", String.fromCharCode(65 + idx)), 0.72, y + 0.12, 0.28, 0.16, 8, DARK, true, false, "F3F4F6");
    addText(slide, getString(choice, "text", "Choice unavailable."), 1.12, y + 0.11, 3.55, 0.2, 10, DARK);
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
  addText(slide, `"${getString(content, "prompt")}"`, 5.75, 1.78, 3.45, 0.72, 20, "FFFFFF", true);

  const questions = getStringArray(content, "guiding_questions").slice(0, 3);
  questions.forEach((question, idx) => {
    const y = 3.16 + idx * 0.6;
    addPanel(slide, 5.45, y, 4.0, 0.48, "FFFFFF", "E5E7EB");
    addText(slide, `Q${idx + 1}`, 5.66, y + 0.14, 0.38, 0.15, 8, ACCENT, true, false, SOFT);
    addText(slide, question, 6.18, y + 0.12, 2.95, 0.18, 9.5, DARK);
  });
}

function renderExitTicket(slide: PptxGenJS.Slide, content: LooseSlide, imageData: string | null) {
  renderSplitBase(slide, imageData, getString(content, "visual_suggestion"), "Exit Context");
  addBadge(slide, "Exit Ticket", 0.55, 0.65);
  addTitle(slide, getString(content, "title"), 0.55, 1.12, 4.45, 0.72, 27);

  addPanel(slide, 0.55, 2.05, 4.35, 1.15, DARK, DARK);
  addText(slide, "Reflection Prompt", 0.82, 2.27, 1.8, 0.16, 8, "DCC8F1", true);
  addText(slide, getString(content, "prompt"), 0.82, 2.55, 3.75, 0.38, 15, "FFFFFF", true);

  const starters = getStringArray(content, "sentence_starters").slice(0, 3);
  starters.forEach((starter, idx) => {
    const y = 3.45 + idx * 0.42;
    addPanel(slide, 0.55, y, 4.35, 0.32, "FFFFFF", "D1D5DB");
    addText(slide, `${starter} __________`, 0.72, y + 0.09, 3.8, 0.12, 9, MUTED, false, true);
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
  addBadge(slide, opts.badge, 0.55, 0.65);
  if (opts.eyebrow) addBadge(slide, opts.eyebrow, 3.45, 0.65, "9A6A00", AMBER);
  addTitle(slide, opts.title, 0.55, 1.12, 4.45, 0.82, 27);

  opts.items.slice(0, 5).forEach((item, idx) => {
    const y = 2.12 + idx * 0.58;
    addPanel(slide, 0.55, y, 4.35, 0.46, "FFFFFF", "E5E7EB");
    addText(slide, String(idx + 1), 0.72, y + 0.12, 0.28, 0.16, 8, "FFFFFF", true, false, ACCENT);
    addText(slide, item, 1.12, y + 0.11, 3.55, 0.2, 10, DARK);
  });

  if (opts.footerTitle && opts.footerText) {
    addPanel(slide, 0.55, 5.0, 4.35, 0.42, AMBER, "F0D38A");
    addText(slide, opts.footerTitle, 0.72, 5.11, 0.9, 0.12, 7.5, "9A6A00", true);
    addText(slide, opts.footerText, 1.72, 5.1, 2.9, 0.14, 8.5, DARK);
  }
}

function renderSplitBase(
  slide: PptxGenJS.Slide,
  imageData: string | null,
  suggestion?: string,
  label = "Visual Guide",
  imageLeft = false
) {
  const visualX = imageLeft ? 0 : 5.25;
  const textX = imageLeft ? 5.25 : 0;
  slide.addShape(SHAPE_RECT, {
    x: textX,
    y: 0,
    w: 5.25,
    h: H,
    fill: { color: "FFFFFF" },
    line: { color: "FFFFFF" },
  });
  if (imageData) {
    slide.addImage({ data: imageData, x: visualX, y: 0, w: 4.75, h: H });
  } else {
    addVisualPlaceholder(slide, visualX, 0, 4.75, H, suggestion, label);
  }
  slide.addShape(SHAPE_RECT, {
    x: visualX,
    y: 0,
    w: 4.75,
    h: H,
    fill: { color: "000000", transparency: 90 },
    line: { color: "000000", transparency: 100 },
  });
  addPanel(slide, visualX + 0.35, 4.58, 4.05, 0.62, "FFFFFF", "FFFFFF", 10);
  addText(slide, label, visualX + 0.55, 4.73, 1.5, 0.12, 7.5, MUTED, true);
  addText(slide, suggestion || "Clean supporting visual", visualX + 0.55, 4.92, 3.45, 0.16, 8.5, DARK, true);
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
    x,
    y,
    w,
    h,
    fill: { color: "F4EFFB" },
    line: { color: "F4EFFB" },
  });
  slide.addShape(SHAPE_RECT, {
    x: x + 0.45,
    y: y + 1.6,
    w: w - 0.9,
    h: 1.05,
    fill: { color: "FFFFFF", transparency: 12 },
    line: { color: "FFFFFF", transparency: 50 },
  });
  addText(slide, label, x + 0.75, y + 1.85, w - 1.5, 0.18, 9, ACCENT, true);
  addText(slide, suggestion || "Visual placeholder", x + 0.75, y + 2.14, w - 1.5, 0.28, 12, DARK, true);
}

function addChrome(slide: PptxGenJS.Slide, slideNumber: number, totalSlides: number) {
  addText(slide, "LessonForge", 8.6, 0.18, 0.95, 0.12, 6.5, "A0A0A8", true);
  addText(slide, `${slideNumber} / ${totalSlides}`, 8.85, 5.28, 0.7, 0.12, 6.5, "A0A0A8");
}

function addBadge(
  slide: PptxGenJS.Slide,
  text: unknown,
  x: number,
  y: number,
  color = ACCENT,
  fill = SOFT,
  transparency = 0
) {
  slide.addText(safeText(text).toUpperCase(), {
    x,
    y,
    w: 1.9,
    h: 0.25,
    fontSize: 7.5,
    color,
    bold: true,
    fontFace: "Arial",
    fit: "shrink",
    margin: 0.05,
    fill: { color: fill, transparency },
    line: { color: fill, transparency },
    align: "center",
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
  fill?: string
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
    valign: "middle",
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
  return getString(source, "image_url") || getString(source, "image");
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
