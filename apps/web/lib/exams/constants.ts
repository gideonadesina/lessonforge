export const CURRICULUM_OPTIONS = [
  "Nigerian Curriculum",
  "British Curriculum",
  "American Curriculum",
  "British-Nigerian Blended Curriculum",
  "American-Nigerian Blended Curriculum",
  "Turkish Curriculum",
] as const;

export const EXAM_ALIGNMENT_OPTIONS = ["None", "WAEC", "NECO"] as const;

export const EXAM_TYPE_OPTIONS = [
  "Class Test",
  "Continuous Assessment",
  "Mid-Term Test",
  "End-of-Term Exam",
  "Mock Exam",
  "Practice Exam",
] as const;

export const SCHOOL_LEVEL_OPTIONS = [
  "Nursery",
  "Primary",
  "Junior Secondary",
  "Senior Secondary",
] as const;

export const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard"] as const;

export const EXAM_SCHEMA_VERSION = "1.0" as const;
export const EXAM_PROMPT_VERSION = "exam-builder-v1" as const;

export const EXAM_MODEL = "gpt-4.1-mini";
