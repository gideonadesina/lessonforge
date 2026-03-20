export type SchemeStatus = "not_started" | "in_progress" | "completed";

export type SchemeOfWorkRow = {
  id: string;
  user_id: string;
  class_name: string;
  subject: string;
  term: string;
  week_number: number;
  topic: string;
  subtopic: string | null;
  status: SchemeStatus;
  created_at: string;
};

export type SchemeOfWorkInput = {
  class_name: string;
  subject: string;
  term: string;
  week_number: number;
  topic: string;
  subtopic?: string | null;
  status: SchemeStatus;
};

export type SchemeOfWorkFilters = {
  class_name?: string;
  subject?: string;
  term?: string;
};

export type AcademicEventType =
  | "resumption"
  | "holiday"
  | "assessment"
  | "exam"
  | "meeting"
  | "deadline"
  | "other";

export type AcademicCalendarRow = {
  id: string;
  user_id: string;
  title: string;
  event_date: string;
  event_type: AcademicEventType;
  description: string | null;
  created_at: string;
};

export type AcademicCalendarInput = {
  title: string;
  event_date: string;
  event_type: AcademicEventType;
  description?: string | null;
};