import type { AcademicEventType, SchemeStatus } from "@/lib/planning/types";

export const SCHEME_STATUS_OPTIONS: Array<{
  value: SchemeStatus;
  label: string;
}> = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export const ACADEMIC_EVENT_TYPE_OPTIONS: Array<{
  value: AcademicEventType;
  label: string;
}> = [
  { value: "resumption", label: "Resumption" },
  { value: "holiday", label: "Holiday" },
  { value: "assessment", label: "Assessment" },
  { value: "exam", label: "Exam" },
  { value: "meeting", label: "Meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "other", label: "Other" },
];
