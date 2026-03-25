import type {
  CURRICULUM_OPTIONS,
  DIFFICULTY_OPTIONS,
  EXAM_ALIGNMENT_OPTIONS,
  EXAM_TYPE_OPTIONS,
  SCHOOL_LEVEL_OPTIONS,
} from "@/lib/exams/constants";

export type ExamCurriculum = (typeof CURRICULUM_OPTIONS)[number];
export type ExamAlignment = (typeof EXAM_ALIGNMENT_OPTIONS)[number];
export type ExamTypeOption = (typeof EXAM_TYPE_OPTIONS)[number];
export type SchoolLevelOption = (typeof SCHOOL_LEVEL_OPTIONS)[number];
export type DifficultyOption = (typeof DIFFICULTY_OPTIONS)[number];

export type ExamBuilderInput = {
  subject: string;
  topicOrCoverage: string;
  classOrGrade: string;
  schoolLevel: SchoolLevelOption;
  curriculum: ExamCurriculum;
  examAlignment: ExamAlignment;
  examType: ExamTypeOption;
  durationMins: number;
  totalMarks: number;
  objectiveQuestionCount: number;
  theoryQuestionCount: number;
  difficultyLevel: DifficultyOption;
  instructions: string[];
  specialNotes: string | null;
  schoolName: string | null;
  examTitleOverride: string | null;
};

export type ObjectiveQuestion = {
  number: number;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
  marks: number;
};

export type ObjectiveAnswerKeyItem = {
  questionNumber: number;
  correctOptionLabel: "A" | "B" | "C" | "D";
  correctOptionText: string;
  marks: number;
};

export type TheorySubQuestion = {
  label: string;
  questionText: string;
  marks: number;
  suggestedAnswer: string;
  markingPoints: string[];
};

export type TheoryQuestion = {
  mainQuestionNumber: number;
  mainQuestionText: string;
  totalMarks: number;
  subQuestions: TheorySubQuestion[];
};

export type ExamResult = {
  schemaVersion: string;
  examTitle: string;
  schoolName: string | null;
  subject: string;
  topicOrCoverage: string;
  classOrGrade: string;
  schoolLevel: SchoolLevelOption;
  curriculum: ExamCurriculum;
  examAlignment: ExamAlignment;
  examType: ExamTypeOption;
  duration: {
    minutes: number;
    label: string;
  };
  totalMarks: number;
  instructions: string[];
  printableHeader: {
    schoolName: string | null;
    examTitle: string;
    subject: string;
    classOrGrade: string;
    schoolLevel: SchoolLevelOption;
    curriculum: ExamCurriculum;
    examAlignment: ExamAlignment;
    examType: ExamTypeOption;
    durationLabel: string;
    totalMarks: number;
    candidateFields: string[];
  };
  sections: {
    objective: {
      title: string;
      questionCount: number;
      marks: number;
    };
    theory: {
      title: string;
      questionCount: number;
      marks: number;
    };
  };
  objectiveSection: {
    title: string;
    instructions: string[];
    questions: ObjectiveQuestion[];
    answerKey: ObjectiveAnswerKeyItem[];
  };
  theorySection: {
    title: string;
    instructions: string[];
    questions: TheoryQuestion[];
  };
  markingGuide: {
    objectiveAnswerKey: Array<{
      questionNumber: number;
      answerLabel: "A" | "B" | "C" | "D";
      marks: number;
    }>;
    theoryGuide: Array<{
      mainQuestionNumber: number;
      totalMarks: number;
      subQuestions: Array<{
        label: string;
        marks: number;
        suggestedAnswer: string;
        markingPoints: string[];
      }>;
    }>;
    totals: {
      objectiveMarks: number;
      theoryMarks: number;
      overall: number;
    };
  };
  metadata: {
    generation: {
      model: string;
      generatedAt: string;
      promptVersion: string;
    };
    template: {
      templateType: "default" | "waec" | "neco";
      templateVersion: string;
    };
    branding: {
      logoUrl: string | null;
      accentColor: string | null;
      footerText: string | null;
    };
    lifecycle: {
      status: "draft" | "published";
      editable: boolean;
      reusable: boolean;
      sourceExamId: string | null;
    };
  };
};

export type ExamRecord = {
  id: string;
  user_id: string;
  subject: string;
  topic_or_coverage: string;
  class_or_grade: string;
  school_level: SchoolLevelOption;
  curriculum: ExamCurriculum;
  exam_alignment: ExamAlignment;
  exam_type: ExamTypeOption;
  duration_mins: number;
  total_marks: number;
  objective_question_count: number;
  theory_question_count: number;
  difficulty_level: DifficultyOption;
  instructions: string[];
  special_notes: string | null;
  school_name: string | null;
  exam_title_override: string | null;
  exam_title: string;
  result_json: ExamResult;
  metadata: Record<string, unknown>;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

export type ExamListRow = {
  id: string;
  exam_title: string;
  subject: string;
  class_or_grade: string;
  exam_type: ExamTypeOption;
  exam_alignment: ExamAlignment;
  objective_question_count: number;
  theory_question_count: number;
  duration_mins: number;
  total_marks: number;
  created_at: string;
  updated_at: string;
};
