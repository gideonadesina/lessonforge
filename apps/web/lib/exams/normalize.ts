import {
  CURRICULUM_OPTIONS,
  DIFFICULTY_OPTIONS,
  EXAM_ALIGNMENT_OPTIONS,
  EXAM_MODEL,
  EXAM_PROMPT_VERSION,
  EXAM_SCHEMA_VERSION,
  EXAM_TYPE_OPTIONS,
  SCHOOL_LEVEL_OPTIONS,
} from "@/lib/exams/constants";
import type {
  ExamAlignment,
  ExamBuilderInput,
  ExamCurriculum,
  ExamResult,
  ExamTypeOption,
  ObjectiveQuestion,
  SchoolLevelOption,
  TheoryQuestion,
  TheorySubQuestion,
} from "@/lib/exams/types";

type ParseInputResult =
  | { ok: true; input: ExamBuilderInput }
  | { ok: false; error: string };

type BuildExamResultOutcome = {
  result: ExamResult;
  objectiveCountOk: boolean;
  theoryCountOk: boolean;
};

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asNullableText(value: unknown): string | null {
  const s = asText(value);
  return s ? s : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: T[number]
): T[number] {
  const str = asText(value);
  return (options as readonly string[]).includes(str) ? (str as T[number]) : fallback;
}

function normalizeInstructions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asText(item))
      .filter(Boolean)
      .slice(0, 10);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  return [];
}

function cleanList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value
    .map((item) => asText(item))
    .filter(Boolean)
    .slice(0, 8);
  return out.length ? out : fallback;
}

function normalizeOptionLabel(value: unknown): "A" | "B" | "C" | "D" {
  const s = asText(value).toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D") return s;
  return "A";
}

function labelFromIndex(index: number): "A" | "B" | "C" | "D" {
  return (["A", "B", "C", "D"][index] ?? "A") as "A" | "B" | "C" | "D";
}

function indexFromLabel(label: "A" | "B" | "C" | "D"): 0 | 1 | 2 | 3 {
  if (label === "B") return 1;
  if (label === "C") return 2;
  if (label === "D") return 3;
  return 0;
}

function alphabetLabel(index: number) {
  return String.fromCharCode(97 + index);
}

function formatDurationLabel(durationMins: number) {
  if (durationMins < 60) return `${durationMins} minutes`;
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  if (!mins) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${mins} minutes`;
}

function detectTemplateType(examAlignment: ExamAlignment): "default" | "waec" | "neco" {
  if (examAlignment === "WAEC") return "waec";
  if (examAlignment === "NECO") return "neco";
  return "default";
}

function normalizeObjectiveQuestion(raw: unknown, index: number): ObjectiveQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const questionText = asText(obj.questionText ?? obj.question ?? obj.prompt);
  if (!questionText) return null;

  const optionsRaw = obj.options;
  let options: [string, string, string, string] | null = null;

  if (Array.isArray(optionsRaw) && optionsRaw.length >= 4) {
    const a = asText(optionsRaw[0]);
    const b = asText(optionsRaw[1]);
    const c = asText(optionsRaw[2]);
    const d = asText(optionsRaw[3]);
    if (a && b && c && d) options = [a, b, c, d];
  } else if (optionsRaw && typeof optionsRaw === "object") {
    const rec = optionsRaw as Record<string, unknown>;
    const a = asText(rec.A ?? rec.a);
    const b = asText(rec.B ?? rec.b);
    const c = asText(rec.C ?? rec.c);
    const d = asText(rec.D ?? rec.d);
    if (a && b && c && d) options = [a, b, c, d];
  }

  if (!options) return null;

  const answerLabel = normalizeOptionLabel(
    (obj.answerLabel as unknown) ??
      (obj.correctOptionLabel as unknown) ??
      (obj.answer as unknown) ??
      labelFromIndex(clampInt(obj.correctOptionIndex, 0, 3, 0))
  );

  return {
    number: clampInt(obj.number, 1, 999, index + 1),
    questionText,
    options,
    correctOptionIndex: indexFromLabel(answerLabel),
    marks: clampInt(obj.marks, 1, 100, 1),
  };
}

function normalizeTheorySubQuestion(raw: unknown, index: number): TheorySubQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const questionText = asText(obj.questionText ?? obj.prompt ?? obj.question);
  if (!questionText) return null;

  return {
    label: asText(obj.label) || alphabetLabel(index),
    questionText,
    marks: clampInt(obj.marks, 1, 100, 2),
    suggestedAnswer: asText(obj.suggestedAnswer ?? obj.markingGuide ?? obj.answer),
    markingPoints: cleanList(obj.markingPoints, []),
  };
}

function normalizeTheoryQuestion(raw: unknown, index: number): TheoryQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const mainQuestionText = asText(obj.mainQuestionText ?? obj.questionText ?? obj.question ?? obj.prompt);
  if (!mainQuestionText) return null;

  const parsedSubs = Array.isArray(obj.subQuestions)
    ? obj.subQuestions
        .map((sub, subIndex) => normalizeTheorySubQuestion(sub, subIndex))
        .filter((item): item is TheorySubQuestion => Boolean(item))
    : [];

  const subQuestions =
    parsedSubs.length > 0
      ? parsedSubs
      : [
          {
            label: "a",
            questionText: mainQuestionText,
            marks: clampInt(obj.marks, 1, 100, 4),
            suggestedAnswer: asText(obj.markingGuide ?? obj.suggestedAnswer),
            markingPoints: cleanList(obj.markingPoints, []),
          },
        ];

  const totalMarks = subQuestions.reduce((sum, sub) => sum + sub.marks, 0);

  return {
    mainQuestionNumber: clampInt(obj.mainQuestionNumber, 1, 999, index + 1),
    mainQuestionText,
    totalMarks,
    subQuestions,
  };
}

type MarkRef = {
  get: () => number;
  set: (next: number) => void;
};

function scaleMarksToTotal(targetTotal: number, refs: MarkRef[]) {
  if (!refs.length) return;
  const current = refs.reduce((sum, ref) => sum + ref.get(), 0);
  if (current <= 0) {
    refs.forEach((ref) => ref.set(1));
  }

  const freshCurrent = refs.reduce((sum, ref) => sum + ref.get(), 0);
  if (freshCurrent <= 0) return;

  const factor = targetTotal / freshCurrent;
  refs.forEach((ref) => ref.set(Math.max(1, Math.round(ref.get() * factor))));

  let diff = targetTotal - refs.reduce((sum, ref) => sum + ref.get(), 0);
  if (diff > 0) {
    refs[refs.length - 1].set(refs[refs.length - 1].get() + diff);
    return;
  }

  let cursor = refs.length - 1;
  while (diff < 0 && cursor >= 0) {
    const currentMark = refs[cursor].get();
    if (currentMark > 1) {
      const drop = Math.min(currentMark - 1, Math.abs(diff));
      refs[cursor].set(currentMark - drop);
      diff += drop;
    } else {
      cursor -= 1;
    }
  }
}

function normalizeMarks(
  objectiveQuestions: ObjectiveQuestion[],
  theoryQuestions: TheoryQuestion[],
  targetTotalMarks: number
) {
  const refs: MarkRef[] = [];

  objectiveQuestions.forEach((q) => {
    refs.push({
      get: () => q.marks,
      set: (next) => {
        q.marks = Math.max(1, next);
      },
    });
  });

  theoryQuestions.forEach((q) => {
    q.subQuestions.forEach((sub) => {
      refs.push({
        get: () => sub.marks,
        set: (next) => {
          sub.marks = Math.max(1, next);
        },
      });
    });
  });

  if (!refs.length) return;
  scaleMarksToTotal(targetTotalMarks, refs);
  theoryQuestions.forEach((q) => {
    q.totalMarks = q.subQuestions.reduce((sum, sub) => sum + sub.marks, 0);
  });
}

export function parseExamBuilderInput(body: unknown): ParseInputResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }

  const payload = body as Record<string, unknown>;
  const subject = asText(payload.subject);
  const topicOrCoverage = asText(payload.topicOrCoverage);
  const classOrGrade = asText(payload.classOrGrade);
  const schoolLevel = normalizeEnum(payload.schoolLevel, SCHOOL_LEVEL_OPTIONS, "Senior Secondary");
  const curriculum = normalizeEnum(payload.curriculum, CURRICULUM_OPTIONS, "Nigerian Curriculum");
  const examAlignment = normalizeEnum(payload.examAlignment, EXAM_ALIGNMENT_OPTIONS, "None");
  const examType = normalizeEnum(payload.examType, EXAM_TYPE_OPTIONS, "Class Test");
  const difficultyLevel = normalizeEnum(payload.difficultyLevel, DIFFICULTY_OPTIONS, "Medium");

  const durationMins = clampInt(payload.durationMins, 10, 300, 90);
  const totalMarks = clampInt(payload.totalMarks, 5, 300, 40);
  const objectiveQuestionCount = clampInt(payload.objectiveQuestionCount, 0, 120, 20);
  const theoryQuestionCount = clampInt(payload.theoryQuestionCount, 0, 40, 3);
  const instructions = normalizeInstructions(payload.instructions);
  const specialNotes = asNullableText(payload.specialNotes);
  const schoolName = asNullableText(payload.schoolName);
  const examTitleOverride = asNullableText(payload.examTitleOverride);

  if (!subject || !topicOrCoverage || !classOrGrade) {
    return {
      ok: false,
      error: "Missing required fields: subject, topicOrCoverage, classOrGrade",
    };
  }

  if (objectiveQuestionCount + theoryQuestionCount <= 0) {
    return {
      ok: false,
      error: "At least one objective or theory question is required",
    };
  }

  if (totalMarks < objectiveQuestionCount + theoryQuestionCount) {
    return {
      ok: false,
      error:
        "Total marks is too low for the selected question counts. Increase total marks or reduce question counts.",
    };
  }

  return {
    ok: true,
    input: {
      subject,
      topicOrCoverage,
      classOrGrade,
      schoolLevel,
      curriculum,
      examAlignment,
      examType,
      durationMins,
      totalMarks,
      objectiveQuestionCount,
      theoryQuestionCount,
      difficultyLevel,
      instructions,
      specialNotes,
      schoolName,
      examTitleOverride,
    },
  };
}

export function buildExamResultFromModel(
  input: ExamBuilderInput,
  modelRaw: unknown
): BuildExamResultOutcome {
  const raw = (modelRaw && typeof modelRaw === "object" ? modelRaw : {}) as Record<string, unknown>;
  const nowIso = new Date().toISOString();

  const modelObjective = Array.isArray(raw.objectiveSection)
    ? raw.objectiveSection
    : Array.isArray((raw.objectiveSection as { questions?: unknown[] })?.questions)
      ? ((raw.objectiveSection as { questions?: unknown[] }).questions ?? [])
      : [];

  const modelTheory = Array.isArray(raw.theorySection)
    ? raw.theorySection
    : Array.isArray((raw.theorySection as { questions?: unknown[] })?.questions)
      ? ((raw.theorySection as { questions?: unknown[] }).questions ?? [])
      : [];

  const objectiveQuestions = modelObjective
    .map((item, index) => normalizeObjectiveQuestion(item, index))
    .filter((item): item is ObjectiveQuestion => Boolean(item))
    .slice(0, input.objectiveQuestionCount)
    .map((q, idx) => ({ ...q, number: idx + 1 }));

  const theoryQuestions = modelTheory
    .map((item, index) => normalizeTheoryQuestion(item, index))
    .filter((item): item is TheoryQuestion => Boolean(item))
    .slice(0, input.theoryQuestionCount)
    .map((q, idx) => ({ ...q, mainQuestionNumber: idx + 1 }));

  normalizeMarks(objectiveQuestions, theoryQuestions, input.totalMarks);

  const objectiveAnswerKey = objectiveQuestions.map((q) => {
    const correctOptionLabel = labelFromIndex(q.correctOptionIndex);
    return {
      questionNumber: q.number,
      correctOptionLabel,
      correctOptionText: q.options[q.correctOptionIndex],
      marks: q.marks,
    };
  });

  const objectiveMarks = objectiveQuestions.reduce((sum, q) => sum + q.marks, 0);
  const theoryMarks = theoryQuestions.reduce((sum, q) => sum + q.totalMarks, 0);
  const overallMarks = objectiveMarks + theoryMarks;
  const durationLabel = formatDurationLabel(input.durationMins);
  const examTitle =
    input.examTitleOverride ??
    `${input.classOrGrade} ${input.examType} - ${input.subject}`.trim();

  const templateType = detectTemplateType(input.examAlignment);
  const instructions =
    input.instructions.length > 0
      ? input.instructions
      : [
          "Read all questions carefully before answering.",
          "Keep your answers neat and clearly numbered.",
        ];

  const result: ExamResult = {
    schemaVersion: EXAM_SCHEMA_VERSION,
    examTitle,
    schoolName: input.schoolName,
    subject: input.subject,
    topicOrCoverage: input.topicOrCoverage,
    classOrGrade: input.classOrGrade,
    schoolLevel: input.schoolLevel,
    curriculum: input.curriculum,
    examAlignment: input.examAlignment,
    examType: input.examType,
    duration: {
      minutes: input.durationMins,
      label: durationLabel,
    },
    totalMarks: input.totalMarks,
    instructions,
    printableHeader: {
      schoolName: input.schoolName,
      examTitle,
      subject: input.subject,
      classOrGrade: input.classOrGrade,
      schoolLevel: input.schoolLevel,
      curriculum: input.curriculum,
      examAlignment: input.examAlignment,
      examType: input.examType,
      durationLabel,
      totalMarks: input.totalMarks,
      candidateFields: ["Name", "Class", "Date", "Time Started"],
    },
    sections: {
      objective: {
        title: "Section A: Objective",
        questionCount: objectiveQuestions.length,
        marks: objectiveMarks,
      },
      theory: {
        title: "Section B: Theory",
        questionCount: theoryQuestions.length,
        marks: theoryMarks,
      },
    },
    objectiveSection: {
      title: "Section A: Objective",
      instructions: ["Choose the correct option A-D for each question."],
      questions: objectiveQuestions,
      answerKey: objectiveAnswerKey,
    },
    theorySection: {
      title: "Section B: Theory",
      instructions: [
        "Answer each theory question in clear steps.",
        "For sub-questions, preserve the provided labels (a, b, c...).",
      ],
      questions: theoryQuestions,
    },
    markingGuide: {
      objectiveAnswerKey: objectiveAnswerKey.map((x) => ({
        questionNumber: x.questionNumber,
        answerLabel: x.correctOptionLabel,
        marks: x.marks,
      })),
      theoryGuide: theoryQuestions.map((q) => ({
        mainQuestionNumber: q.mainQuestionNumber,
        totalMarks: q.totalMarks,
        subQuestions: q.subQuestions.map((sub) => ({
          label: sub.label,
          marks: sub.marks,
          suggestedAnswer: sub.suggestedAnswer,
          markingPoints: sub.markingPoints,
        })),
      })),
      totals: {
        objectiveMarks,
        theoryMarks,
        overall: overallMarks,
      },
    },
    metadata: {
      generation: {
        model: EXAM_MODEL,
        generatedAt: nowIso,
        promptVersion: EXAM_PROMPT_VERSION,
      },
      template: {
        templateType,
        templateVersion: "1.0",
      },
      branding: {
        logoUrl: null,
        accentColor: null,
        footerText: null,
      },
      lifecycle: {
        status: "published",
        editable: true,
        reusable: true,
        sourceExamId: null,
      },
    },
  };

  return {
    result,
    objectiveCountOk: objectiveQuestions.length === input.objectiveQuestionCount,
    theoryCountOk: theoryQuestions.length === input.theoryQuestionCount,
  };
}

export function mapInputToDbFields(input: ExamBuilderInput) {
  return {
    subject: input.subject,
    topic_or_coverage: input.topicOrCoverage,
    class_or_grade: input.classOrGrade,
    school_level: input.schoolLevel as SchoolLevelOption,
    curriculum: input.curriculum as ExamCurriculum,
    exam_alignment: input.examAlignment as ExamAlignment,
    exam_type: input.examType as ExamTypeOption,
    duration_mins: input.durationMins,
    total_marks: input.totalMarks,
    objective_question_count: input.objectiveQuestionCount,
    theory_question_count: input.theoryQuestionCount,
    difficulty_level: input.difficultyLevel,
    instructions: input.instructions,
    special_notes: input.specialNotes,
    school_name: input.schoolName,
    exam_title_override: input.examTitleOverride,
  };
}
