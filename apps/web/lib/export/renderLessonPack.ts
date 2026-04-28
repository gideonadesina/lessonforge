/* eslint-disable @typescript-eslint/no-explicit-any */
export type LessonPackData = Record<string, any> | null | undefined;

export type RenderLessonPackOptions = {
  subject?: string;
  topic?: string;
  grade?: string;
  curriculum?: string;
  schoolLevel?: string;
  age?: string;
  numberOfSlides?: number;
};

type GeneratedSlide = {
  image_url?: string | null;
  image?: string | null;
};

function youtubeSearchUrl(query: string) {
  const q = (query || "").trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function getSlideImageSrc(slide: GeneratedSlide | undefined) {
  return slide?.image_url || slide?.image || null;
}

function normalizeLessonPackData(lesson: LessonPackData): Record<string, any> | null {
  if (!lesson || typeof lesson !== "object") return null;
  const value = lesson as Record<string, any>;
  return value.data && typeof value.data === "object" ? value.data : value;
}

function itemText(item: unknown): string {
  if (item === null || item === undefined) return "";
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return String(item).trim();
  }
  if (typeof item === "object") {
    const record = item as Record<string, any>;
    return String(record.question ?? record.text ?? record.prompt ?? record.q ?? record.title ?? "").trim();
  }
  return "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(itemText).filter(Boolean);
}

function getLessonTitle(result: Record<string, any> | null, subject: string, topic: string) {
  return result?.lessonPlan?.lessonTitle || result?.lessonPlan?.title || `${subject} - ${topic}`;
}

function getRealLifeItems(result: Record<string, any> | null): string[] {
  return asStringArray(
    result?.lessonPlan?.realLifeApplications ?? result?.lessonPlan?.realLifeConnection ?? []
  );
}

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}
export async function renderLessonPackHTML(lesson: LessonPackData, options: RenderLessonPackOptions = {}): Promise<string> {
    const result = normalizeLessonPackData(lesson);
    if (!result) return "";

    const subject = options.subject ?? "";
    const topic = options.topic ?? "";
    const grade = options.grade ?? "";
    const curriculum = options.curriculum ?? "";
    const schoolLevel = options.schoolLevel ?? "";
    const age = options.age ?? "";
    const numberOfSlides = options.numberOfSlides ?? 0;
    const meta = result.meta ?? {};

    const lessonPlan = result.lessonPlan ?? {};
    const lessonNotes = result.lessonNotes;
    const slidesData = Array.isArray(result.slides) ? result.slides : [];
    const mcqData = Array.isArray(result.quiz?.mcq) ? result.quiz.mcq : [];
    const theoryData = Array.isArray(result.quiz?.theory) ? result.quiz.theory : [];
    const realLifeItems = getRealLifeItems(result);
    const liveApps = asStringArray(result.liveApplications);
    const lessonTitle = getLessonTitle(result, subject, topic);
    const subjectLabel = meta.subject ?? subject;
    const topicLabel = meta.topic ?? topic;
    const gradeLabel = meta.grade ?? grade;
    const curriculumLabel = meta.curriculum ?? curriculum;
    const schoolLevelLabel = meta.schoolLevel ?? schoolLevel;
    const generatedDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

    // Fetch & encode all slide images
    const imageCache: Record<string, string> = {};
    await Promise.all(
      slidesData.map(async (slide) => {
        const src = getSlideImageSrc(slide);
        if (!src) return;
        if (!imageCache[src]) {
          imageCache[src] = await fetchImageAsBase64(src);
        }
      })
    );

    // ── Helpers ──────────────────────────────────────────────────────────────
    const esc = (s: unknown) =>
      itemText(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    function sectionHeader(title: string, emoji = "") {
      return `<div class="section-header"><h2>${emoji ? emoji + " " : ""}${esc(title)}</h2></div>`;
    }

    function infoGrid(items: Array<[string, string]>) {
      return `<div class="info-grid">${items
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="info-item"><span class="info-label">${esc(k)}</span><span class="info-value">${esc(v)}</span></div>`)
        .join("")}</div>`;
    }

    function listBlock(items: unknown[], ordered = false) {
      const safeItems = asStringArray(items);
      if (!safeItems.length) return "";
      const tag = ordered ? "ol" : "ul";
      return `<${tag} class="content-list">${safeItems.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
    }

    function fieldBlock(label: string, content: string) {
      if (!content) return "";
      return `<div class="field-block"><div class="field-label">${esc(label)}</div><div class="field-content">${content}</div></div>`;
    }

    // ── Cover Page ────────────────────────────────────────────────────────────
    const coverHTML = `
<div class="cover-page">
  <div class="cover-logo">LessonForge</div>
  <div class="cover-badge">Complete Lesson Pack</div>
  <h1 class="cover-title">${esc(topicLabel || topic)}</h1>
  <p class="cover-subject">${esc(subjectLabel || subject)}</p>
  <div class="cover-meta">
    ${infoGrid([
      ["Class / Grade", gradeLabel || grade],
      ["Age Group", age],
      ["School Level", schoolLevelLabel || schoolLevel],
      ["Curriculum", curriculumLabel || curriculum],
      ["Duration", `${meta.durationMins ?? 40} minutes`],
      ["Slides", String(meta.numberOfSlides ?? numberOfSlides)],
      ["Generated", generatedDate],
    ])}
  </div>
</div>
<div class="page-break"></div>`;

    // ── Table of Contents ─────────────────────────────────────────────────────
    const tocItems = [
      "Lesson Plan",
      "Lesson Notes",
      ...(slidesData.length ? ["Slides & Images"] : []),
      ...(slidesData.some((s) => s.videoQuery) ? ["Video Resources"] : []),
      ...(mcqData.length ? ["Multiple Choice Questions"] : []),
      ...(theoryData.length ? ["Theory Questions"] : []),
      ...(Array.isArray(result.references) && result.references.length ? ["References"] : []),
    ];

    const tocHTML = `
<div class="toc-page">
  ${sectionHeader("Contents", "📋")}
  <ol class="toc-list">
    ${tocItems.map((item) => `<li>${esc(item)}</li>`).join("")}
  </ol>
</div>
<div class="page-break"></div>`;

    // ── Lesson Plan ───────────────────────────────────────────────────────────
    let lessonPlanHTML = sectionHeader("Lesson Plan", "📚");

    lessonPlanHTML += fieldBlock("Lesson Title", `<strong>${esc(lessonTitle)}</strong>`);

    if (asStringArray(lessonPlan.performanceObjectives).length)
      lessonPlanHTML += fieldBlock("Performance Objectives", listBlock(asStringArray(lessonPlan.performanceObjectives)));
    if (asStringArray(lessonPlan.successCriteria).length)
      lessonPlanHTML += fieldBlock("Success Criteria", listBlock(asStringArray(lessonPlan.successCriteria)));
    if (asStringArray(lessonPlan.instructionalMaterials).length)
      lessonPlanHTML += fieldBlock("Instructional Materials", listBlock(asStringArray(lessonPlan.instructionalMaterials)));
    if (asStringArray(lessonPlan.lifeNatureActivities).length)
      lessonPlanHTML += fieldBlock("Life / Nature Activities", listBlock(asStringArray(lessonPlan.lifeNatureActivities)));
    if (asStringArray(lessonPlan.crossCurricularActivities).length)
      lessonPlanHTML += fieldBlock("Cross-Curricular Activities", listBlock(asStringArray(lessonPlan.crossCurricularActivities)));
    if (lessonPlan.previousKnowledge)
      lessonPlanHTML += fieldBlock("Previous Knowledge", `<p>${esc(String(lessonPlan.previousKnowledge))}</p>`);
    if (lessonPlan.introduction)
      lessonPlanHTML += fieldBlock("Introduction", `<p>${esc(String(lessonPlan.introduction))}</p>`);

    if (Array.isArray(lessonPlan.keyVocabulary) && lessonPlan.keyVocabulary.length) {
      const vocabRows = lessonPlan.keyVocabulary
        .map((v: any) => `<tr><td><strong>${esc(v.word ?? "")}</strong></td><td>${esc(v.simpleMeaning ?? "")}</td></tr>`)
        .join("");
      lessonPlanHTML += fieldBlock(
        "Key Vocabulary",
        `<table class="vocab-table"><thead><tr><th>Word</th><th>Meaning</th></tr></thead><tbody>${vocabRows}</tbody></table>`
      );
    }

    if (asStringArray(lessonPlan.commonMisconceptions).length)
      lessonPlanHTML += fieldBlock("Common Misconceptions", listBlock(asStringArray(lessonPlan.commonMisconceptions)));

    if (Array.isArray(lessonPlan.steps) && lessonPlan.steps.length) {
      const stepsHTML = lessonPlan.steps.map((step: any, i: number) => {
        const num = step.stepNumber ?? step.step ?? i + 1;
        const title = step.stepTitle ?? step.title ?? `Step ${i + 1}`;
        const rows = [
          step.timeMinutes ? `<div class="step-row"><span class="step-key">⏱ Time:</span> ${esc(String(step.timeMinutes))} mins</div>` : "",
          step.teacherActivity ? `<div class="step-row"><span class="step-key">👩‍🏫 Teacher Activity:</span> ${esc(step.teacherActivity)}</div>` : "",
          step.learnerActivity ? `<div class="step-row"><span class="step-key">🎒 Learner Activity:</span> ${esc(step.learnerActivity)}</div>` : "",
          step.teachingMethod ? `<div class="step-row"><span class="step-key">📖 Teaching Method:</span> ${esc(step.teachingMethod)}</div>` : "",
          step.assessmentCheck ? `<div class="step-row"><span class="step-key">✅ Assessment Check:</span> ${esc(step.assessmentCheck)}</div>` : "",
          step.concretisedLearningPoint ? `<div class="step-row"><span class="step-key">💡 Learning Point:</span> ${esc(step.concretisedLearningPoint)}</div>` : "",
          step.guidedQuestions?.length
            ? `<div class="step-row"><span class="step-key">❓ Guided Questions:</span>${listBlock(step.guidedQuestions)}</div>`
            : "",
        ].filter(Boolean).join("");
        return `<div class="step-card"><div class="step-title">Step ${num}: ${esc(title)}</div>${rows}</div>`;
      }).join("");
      lessonPlanHTML += fieldBlock("Lesson Delivery Steps", stepsHTML);
    }

    if (lessonPlan.differentiation) {
      const diffContent = [
        lessonPlan.differentiation.supportForStrugglingLearners
          ? `<div class="diff-block diff-support"><strong>🟡 Struggling Learners:</strong> ${esc(lessonPlan.differentiation.supportForStrugglingLearners)}</div>` : "",
        lessonPlan.differentiation.supportForAverageLearners
          ? `<div class="diff-block diff-average"><strong>🔵 Average Learners:</strong> ${esc(lessonPlan.differentiation.supportForAverageLearners)}</div>` : "",
        lessonPlan.differentiation.challengeForAdvancedLearners
          ? `<div class="diff-block diff-advanced"><strong>🟢 Advanced Learners:</strong> ${esc(lessonPlan.differentiation.challengeForAdvancedLearners)}</div>` : "",
      ].filter(Boolean).join("");
      if (diffContent) lessonPlanHTML += fieldBlock("Differentiation", diffContent);
    }

    if (asStringArray(lessonPlan.boardSummary).length)
      lessonPlanHTML += fieldBlock("Board Summary", listBlock(asStringArray(lessonPlan.boardSummary)));

    if (Array.isArray(lessonPlan.evaluation) && lessonPlan.evaluation.length) {
      const evalList = lessonPlan.evaluation.map((item: any) => {
        const question = itemText(item);
        const markingGuide = typeof item === "object" && item ? (item as Record<string, any>).markingGuide : null;
        return `<li>${esc(question)}${markingGuide ? `<div class="marking-guide"><strong>Marking Guide:</strong> ${esc(markingGuide)}</div>` : ""}</li>`;
      }).join("");
      lessonPlanHTML += fieldBlock("Evaluation", `<ol class="content-list">${evalList}</ol>`);
    }

    if (asStringArray(lessonPlan.exitTicket).length)
      lessonPlanHTML += fieldBlock("Exit Ticket", listBlock(asStringArray(lessonPlan.exitTicket), true));
    if (asStringArray(lessonPlan.assignment).length)
      lessonPlanHTML += fieldBlock("Assignment", listBlock(asStringArray(lessonPlan.assignment), true));
    if (realLifeItems.length)
      lessonPlanHTML += fieldBlock("Real-Life Applications", listBlock(realLifeItems));

    const lessonPlanSection = `<div class="content-section">${lessonPlanHTML}</div><div class="page-break"></div>`;

    // ── Lesson Notes ──────────────────────────────────────────────────────────
    let lessonNotesHTML = sectionHeader("Lesson Notes", "📝");

    if (!lessonNotes) {
      lessonNotesHTML += `<p class="empty-state">No lesson notes generated.</p>`;
    } else if (typeof lessonNotes === "string") {
      lessonNotesHTML += `<div class="prose">${esc(lessonNotes).replace(/\n/g, "<br>")}</div>`;
    } else {
      if (lessonNotes.introduction)
        lessonNotesHTML += fieldBlock("Introduction", `<p>${esc(lessonNotes.introduction)}</p>`);

      if (lessonNotes.keyConcepts?.length) {
        const conceptsHTML = lessonNotes.keyConcepts.map((c: any, i: number) =>
          `<div class="concept-card"><div class="concept-heading">${esc(c.subheading || `Concept ${i + 1}`)}</div>${c.content ? `<p>${esc(c.content)}</p>` : ""}</div>`
        ).join("");
        lessonNotesHTML += fieldBlock("Key Concepts", conceptsHTML);
      }

      if (lessonNotes.workedExamples?.length) {
        const examplesHTML = lessonNotes.workedExamples.map((ex: any, i: number) => {
          const stepsHTML = ex.steps?.length
            ? `<div class="example-steps"><strong>Steps:</strong><ol>${ex.steps.map((s: any) => `<li>${esc(s)}</li>`).join("")}</ol></div>` : "";
          return `<div class="example-card">
            <div class="example-title">${esc(ex.title || `Example ${i + 1}`)}</div>
            ${ex.problem ? `<p><strong>Problem:</strong> ${esc(ex.problem)}</p>` : ""}
            ${stepsHTML}
            ${ex.finalAnswer ? `<p class="final-answer"><strong>✅ Final Answer:</strong> ${esc(ex.finalAnswer)}</p>` : ""}
            ${ex.explanation ? `<p><strong>Explanation:</strong> ${esc(ex.explanation)}</p>` : ""}
          </div>`;
        }).join("");
        lessonNotesHTML += fieldBlock("Worked Examples", examplesHTML);
      }

      if (lessonNotes.summaryPoints?.length)
        lessonNotesHTML += fieldBlock("Summary Points", listBlock(asStringArray(lessonNotes.summaryPoints)));
      if (lessonNotes.realLifeApplications?.length)
        lessonNotesHTML += fieldBlock("Real-Life Applications", listBlock(asStringArray(lessonNotes.realLifeApplications)));
      if (lessonNotes.exitTicket?.length)
        lessonNotesHTML += fieldBlock("Exit Ticket", listBlock(asStringArray(lessonNotes.exitTicket), true));

      if (lessonNotes.keyVocabulary?.length) {
        const vocabRows = lessonNotes.keyVocabulary
          .map((v: any) => `<tr><td><strong>${esc(v.word ?? "")}</strong></td><td>${esc(v.meaning ?? "")}</td></tr>`)
          .join("");
        lessonNotesHTML += fieldBlock(
          "Key Vocabulary",
          `<table class="vocab-table"><thead><tr><th>Word</th><th>Meaning</th></tr></thead><tbody>${vocabRows}</tbody></table>`
        );
      }
    }

    const lessonNotesSection = `<div class="content-section">${lessonNotesHTML}</div><div class="page-break"></div>`;

    // ── Slides ────────────────────────────────────────────────────────────────
    let slidesSection = "";
    if (slidesData.length) {
      let slidesHTML = sectionHeader("Slides & Images", "🖼️");
      slidesData.forEach((slide, i) => {
        const num = slide.slideNumber ?? i + 1;
        const title = slide.title || `Slide ${num}`;
    const bullets = asStringArray(slide.bullets);
        const originalImgSrc = getSlideImageSrc(slide);
        const imgSrc = originalImgSrc ? imageCache[originalImgSrc] || originalImgSrc : null;
        const videoLink = youtubeSearchUrl(slide.videoQuery || title);
        const visualSuggestion = slide.visual_suggestion || slide.image_query || slide.imageQuery || "";

        slidesHTML += `
<div class="slide-card">
  <div class="slide-header">
    <span class="slide-number">Slide ${num}</span>
    <span class="slide-title">${esc(title)}</span>
    ${slide.slideType ? `<span class="slide-type">${esc(slide.slideType.replace(/_/g, " "))}</span>` : ""}
  </div>
  ${
    imgSrc
      ? `<img class="slide-image" src="${imgSrc}" alt="${esc(slide.image_alt || title)}" />`
      : `<div class="slide-image placeholder"><strong>Visual Guide</strong><span>${esc(visualSuggestion || "No image available")}</span></div>`
}
  ${bullets.length ? `<ul class="slide-bullets">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
  <div class="slide-prompts">
    ${slide.teacherPrompt ? `<div class="prompt-row"><strong>👩‍🏫 Teacher Prompt:</strong> ${esc(slide.teacherPrompt)}</div>` : ""}
    ${slide.studentTask ? `<div class="prompt-row"><strong>🎒 Student Task:</strong> ${esc(slide.studentTask)}</div>` : ""}
    ${slide.interactivePrompt ? `<div class="prompt-row activity-row"><strong>🎯 Classroom Activity:</strong> ${esc(slide.interactivePrompt)}</div>` : ""}
  </div>
  <div class="video-link">
    🎥 <strong>Video Resource:</strong>
    <a href="${videoLink}" target="_blank">${esc(slide.videoQuery || title)}</a>
    <span class="video-url-print">${videoLink}</span>
  </div>
</div>`;
      });
      slidesSection = `<div class="content-section">${slidesHTML}</div><div class="page-break"></div>`;
    }

    // ── Video Resources (consolidated list) ───────────────────────────────────
    let videoSection = "";
    const videoSlides = slidesData.filter((s) => s.videoQuery || s.title);
    if (videoSlides.length) {
      let videoHTML = sectionHeader("Video Resources", "🎥");
      videoHTML += `<p class="video-intro">Use these YouTube search links to find relevant videos for each slide. Links work when online; the search terms are printed below for offline reference.</p>`;
      videoHTML += `<table class="video-table"><thead><tr><th>#</th><th>Slide Title</th><th>Search Term</th><th>Link</th></tr></thead><tbody>`;
      videoSlides.forEach((slide, i) => {
        const num = slide.slideNumber ?? i + 1;
        const title = slide.title || `Slide ${num}`;
        const query = slide.videoQuery || title;
        const link = youtubeSearchUrl(query);
        videoHTML += `<tr>
          <td>${num}</td>
          <td>${esc(title)}</td>
          <td>${esc(query)}</td>
          <td><a href="${link}" target="_blank">Watch →</a><br><small class="video-url-print">${esc(link)}</small></td>
        </tr>`;
      });
      videoHTML += `</tbody></table>`;
      videoSection = `<div class="content-section">${videoHTML}</div><div class="page-break"></div>`;
    }

    // ── MCQs ──────────────────────────────────────────────────────────────────
    let mcqSection = "";
    if (mcqData.length) {
      let mcqHTML = sectionHeader("Multiple Choice Questions", "📝");
      mcqHTML += `<div class="mcq-list">`;
      mcqData.forEach((q: any, i: number) => {
        const options = Array.isArray(q.options) ? q.options : [];
        const answerLetter = typeof q.answerIndex === "number"
          ? String.fromCharCode(65 + q.answerIndex) : null;
        mcqHTML += `<div class="mcq-item">
          <div class="mcq-question"><strong>${i + 1}.</strong> ${esc(q.q ?? "Question")}</div>
          <div class="mcq-options">
            ${options.map((opt: any, j: number) => `<div class="mcq-option ${j === q.answerIndex ? "correct-option" : ""}">
              <span class="option-letter">${String.fromCharCode(65 + j)}.</span> ${esc(opt)}
            </div>`).join("")}
          </div>
          ${answerLetter ? `<div class="mcq-answer">✅ Answer: <strong>${answerLetter}</strong></div>` : ""}
          ${q.explanation ? `<div class="mcq-explanation"><strong>Explanation:</strong> ${esc(q.explanation)}</div>` : ""}
        </div>`;
      });
      mcqHTML += `</div>`;
      mcqSection = `<div class="content-section">${mcqHTML}</div><div class="page-break"></div>`;
    }

    // ── Theory Questions ──────────────────────────────────────────────────────
    let theorySection = "";
    if (theoryData.length) {
      let theoryHTML = sectionHeader("Theory Questions", "✍️");
      theoryHTML += `<ol class="theory-list">`;
      theoryData.forEach((q: any) => {
        theoryHTML += `<li class="theory-item">
          <div class="theory-question">${esc(itemText(q) || "Question")}</div>
          ${q.markingGuide ? `<div class="marking-guide"><strong>Marking Guide:</strong> ${esc(q.markingGuide)}</div>` : ""}
          <div class="answer-space"></div>
        </li>`;
      });
      theoryHTML += `</ol>`;
      theorySection = `<div class="content-section">${theoryHTML}</div><div class="page-break"></div>`;
    }

    // ── References ────────────────────────────────────────────────────────────
    let referencesSection = "";
    if (Array.isArray(result.references) && result.references.length) {
      let refsHTML = sectionHeader("References", "📖");
      refsHTML += listBlock(result.references, true);
      referencesSection = `<div class="content-section">${refsHTML}</div>`;
    }

    // ── Live Applications ─────────────────────────────────────────────────────
    let liveAppsSection = "";
    if (liveApps.length) {
      let liveHTML = sectionHeader("Live / Real-World Applications", "🌍");
      liveHTML += listBlock(liveApps);
      liveAppsSection = `<div class="content-section">${liveHTML}</div><div class="page-break"></div>`;
    }

    // ── Full HTML document ────────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LessonForge — ${esc(subjectLabel)} — ${esc(topicLabel)}</title>
  <style>
    /* ─── Reset & Base ─────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 15px; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.7;
    }
    a { color: #5b4fcf; }
    strong { font-weight: 700; }

    /* ─── Layout ───────────────────────────────────────────────── */
    .page-wrap { max-width: 860px; margin: 0 auto; padding: 32px 24px; }
    .page-break { page-break-after: always; margin: 40px 0; border-top: 2px dashed #e2e8f0; }

    /* ─── Cover Page ───────────────────────────────────────────── */
    .cover-page {
      min-height: 80vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 48px 32px;
      background: linear-gradient(135deg, #f8f7ff 0%, #ffffff 60%, #f0f4ff 100%);
      border-radius: 16px;
      border: 2px solid #e0dff8;
    }
    .cover-logo {
      font-family: Arial, sans-serif;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #5b4fcf;
      background: #ede9ff;
      padding: 6px 18px;
      border-radius: 999px;
      margin-bottom: 20px;
    }
    .cover-badge {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #8b5cf6;
      margin-bottom: 16px;
    }
    .cover-title {
      font-size: 2.4rem;
      font-weight: 800;
      color: #1e1b4b;
      line-height: 1.2;
      margin-bottom: 12px;
    }
    .cover-subject {
      font-size: 1.1rem;
      color: #5b4fcf;
      font-weight: 600;
      margin-bottom: 32px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }
    .info-item {
      background: #fff;
      border: 1px solid #e0dff8;
      border-radius: 10px;
      padding: 10px 14px;
      text-align: left;
    }
    .info-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8b5cf6;
      margin-bottom: 2px;
      font-family: Arial, sans-serif;
    }
    .info-value {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      font-family: Arial, sans-serif;
    }

    /* ─── TOC ──────────────────────────────────────────────────── */
    .toc-page { padding: 24px 0; }
    .toc-list {
      list-style: decimal;
      padding-left: 24px;
      font-family: Arial, sans-serif;
    }
    .toc-list li {
      padding: 6px 0;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
      border-bottom: 1px dotted #e2e8f0;
    }

    /* ─── Section Header ───────────────────────────────────────── */
    .section-header {
      background: linear-gradient(90deg, #5b4fcf 0%, #7c3aed 100%);
      color: #fff;
      padding: 14px 20px;
      border-radius: 10px;
      margin-bottom: 24px;
    }
    .section-header h2 {
      font-size: 1.25rem;
      font-weight: 800;
      font-family: Arial, sans-serif;
      letter-spacing: -0.01em;
    }

    /* ─── Content Section ──────────────────────────────────────── */
    .content-section { padding: 8px 0 24px; }

    /* ─── Field Blocks ─────────────────────────────────────────── */
    .field-block { margin-bottom: 20px; }
    .field-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5b4fcf;
      font-family: Arial, sans-serif;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #ede9ff;
    }
    .field-content { font-size: 14px; }

    /* ─── Lists ────────────────────────────────────────────────── */
    .content-list {
      padding-left: 22px;
      space-y: 4px;
    }
    .content-list li {
      margin-bottom: 6px;
      font-size: 14px;
      line-height: 1.6;
    }

    /* ─── Vocabulary Table ─────────────────────────────────────── */
    .vocab-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      font-family: Arial, sans-serif;
    }
    .vocab-table th {
      background: #5b4fcf;
      color: #fff;
      padding: 8px 12px;
      text-align: left;
      font-weight: 700;
    }
    .vocab-table td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; }
    .vocab-table tr:nth-child(even) td { background: #f8f7ff; }

    /* ─── Step Cards ───────────────────────────────────────────── */
    .step-card {
      border: 1px solid #e0dff8;
      border-left: 4px solid #5b4fcf;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 14px;
      background: #fafaff;
    }
    .step-title {
      font-weight: 800;
      font-size: 14px;
      color: #1e1b4b;
      margin-bottom: 10px;
      font-family: Arial, sans-serif;
    }
    .step-row {
      font-size: 13px;
      margin-bottom: 6px;
      padding-left: 6px;
    }
    .step-key { font-weight: 700; color: #334155; }

    /* ─── Differentiation Blocks ───────────────────────────────── */
    .diff-block {
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .diff-support { background: #fefce8; border: 1px solid #fde68a; }
    .diff-average { background: #eff6ff; border: 1px solid #bfdbfe; }
    .diff-advanced { background: #f0fdf4; border: 1px solid #bbf7d0; }

    /* ─── Marking Guide ────────────────────────────────────────── */
    .marking-guide {
      margin-top: 6px;
      padding: 6px 10px;
      background: #f8f7ff;
      border-left: 3px solid #8b5cf6;
      font-size: 12px;
      color: #475569;
      border-radius: 0 6px 6px 0;
    }

    /* ─── Concept Cards ────────────────────────────────────────── */
    .concept-card {
      border-left: 3px solid #8b5cf6;
      padding: 10px 14px;
      margin-bottom: 12px;
      background: #fafaff;
      border-radius: 0 8px 8px 0;
    }
    .concept-heading {
      font-weight: 800;
      font-size: 13px;
      color: #1e1b4b;
      margin-bottom: 4px;
      font-family: Arial, sans-serif;
    }

    /* ─── Worked Example Cards ─────────────────────────────────── */
    .example-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      background: #fff;
    }
    .example-title {
      font-weight: 800;
      font-size: 14px;
      color: #1e1b4b;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      font-family: Arial, sans-serif;
    }
    .example-steps { margin: 8px 0; }
    .final-answer {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-top: 8px;
    }

    /* ─── Slide Cards ──────────────────────────────────────────── */
    .slide-card {
      border: 2px solid #e0dff8;
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 28px;
      background: #fff;
      page-break-inside: avoid;
    }
    .slide-header {
      background: #1e1b4b;
      color: #fff;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: Arial, sans-serif;
    }
    .slide-number {
      background: #5b4fcf;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 999px;
      letter-spacing: 0.05em;
    }
    .slide-title {
      font-size: 15px;
      font-weight: 700;
      flex: 1;
    }
    .slide-type {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #a5b4fc;
    }
    .slide-image {
      width: 100%;
      height: 220px;
      object-fit: cover;
      display: block;
      border-bottom: 1px solid #e0dff8;
    }
    .slide-image.placeholder {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 8px;
      padding: 28px;
      background: #f8fafc;
      color: #334155;
      font-family: Arial, sans-serif;
    }
    .slide-image.placeholder strong {
      color: #4338ca;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .slide-bullets {
      padding: 14px 14px 14px 32px;
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .slide-bullets li { margin-bottom: 6px; }
    .slide-prompts {
      padding: 12px 16px;
      background: #f8f7ff;
      border-top: 1px solid #e0dff8;
      font-size: 13px;
    }
    .prompt-row { margin-bottom: 6px; line-height: 1.5; }
    .activity-row {
      margin-top: 8px;
      padding: 8px 12px;
      background: #fefce8;
      border-radius: 8px;
      border: 1px solid #fde68a;
    }
    .video-link {
      padding: 10px 16px;
      background: #eff6ff;
      border-top: 1px solid #bfdbfe;
      font-size: 13px;
    }
    .video-url-print {
      display: block;
      font-size: 10px;
      color: #64748b;
      word-break: break-all;
      margin-top: 2px;
    }

    /* ─── Video Table ──────────────────────────────────────────── */
    .video-intro { font-size: 13px; color: #475569; margin-bottom: 16px; }
    .video-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      font-family: Arial, sans-serif;
    }
    .video-table th {
      background: #1e1b4b;
      color: #fff;
      padding: 10px 12px;
      text-align: left;
      font-weight: 700;
    }
    .video-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .video-table tr:nth-child(even) td { background: #f8f7ff; }

    /* ─── MCQ ──────────────────────────────────────────────────── */
    .mcq-list { display: flex; flex-direction: column; gap: 20px; }
    .mcq-item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      background: #fff;
      page-break-inside: avoid;
    }
    .mcq-question {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .mcq-options { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .mcq-option {
      display: flex;
      gap: 8px;
      font-size: 13px;
      padding: 6px 10px;
      border-radius: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .correct-option {
      background: #f0fdf4;
      border-color: #86efac;
      font-weight: 600;
    }
    .option-letter { font-weight: 800; color: #5b4fcf; min-width: 18px; }
    .mcq-answer {
      font-size: 13px;
      font-weight: 700;
      color: #16a34a;
      background: #f0fdf4;
      padding: 6px 12px;
      border-radius: 6px;
      display: inline-block;
    }
    .mcq-explanation {
      margin-top: 8px;
      font-size: 12px;
      color: #475569;
      background: #f8f7ff;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #8b5cf6;
    }

    /* ─── Theory Questions ─────────────────────────────────────── */
    .theory-list { padding-left: 20px; }
    .theory-item {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .theory-question {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .answer-space {
      min-height: 80px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      margin-top: 10px;
      background: #fafafa;
    }

    /* ─── Footer ───────────────────────────────────────────────── */
    .doc-footer {
      text-align: center;
      padding: 24px 0 8px;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      font-family: Arial, sans-serif;
    }

    /* ─── Print Styles ─────────────────────────────────────────── */
    @media print {
      body { font-size: 12px; }
      .page-break { page-break-after: always; }
      .slide-card, .mcq-item, .theory-item { page-break-inside: avoid; }
      .video-url-print { display: block !important; }
      a { color: #1e1b4b; text-decoration: none; }
    }
  </style>
</head>
<body>
<div class="page-wrap">
  ${coverHTML}
  ${tocHTML}
  ${lessonPlanSection}
  ${lessonNotesSection}
  ${slidesSection}
  ${videoSection}
  ${mcqSection}
  ${theorySection}
  ${liveAppsSection}
  ${referencesSection}
  <div class="doc-footer">
    Generated with LessonForge &nbsp;•&nbsp; ${esc(generatedDate)} &nbsp;•&nbsp;
    ${esc(subjectLabel)} — ${esc(topicLabel)} — ${esc(gradeLabel)}
    ${age ? ` &nbsp;•&nbsp; Age: ${esc(age)}` : ""}
  </div>
</div>
</body>
</html>`;
}
