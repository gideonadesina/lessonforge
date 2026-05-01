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
  end_date: string | null;
  event_type: AcademicEventType;
  affected_classes: string[] | null;
  notification_sent: boolean;
  description: string | null;
  created_at: string;
};

export type AcademicCalendarInput = {
  title: string;
  event_date: string;
  end_date?: string | null;
  event_type: AcademicEventType;
  affected_classes?: string[] | null;
  notification_sent?: boolean;
  description?: string | null;
};

export type TeacherTimetable = {
  id: string;
  user_id: string;
  term: string;
  academic_year: string;
  weeks_in_term: number;
  teaching_days: string[];
  created_at: string;
  updated_at: string;
};

export type TeacherTimetableInput = {
  term: string;
  academic_year: string;
  weeks_in_term: number;
  teaching_days: string[];
};

export type TimetableSlot = {
  id: string;
  timetable_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  class_name: string;
  subject: string;
  room: string | null;
  scheme_entry_id: string | null;
  created_at: string;
};

export type TimetableSlotInput = {
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  class_name: string;
  subject: string;
  room?: string | null;
  scheme_entry_id?: string | null;
};

export type TimetableSlotWithTopic = TimetableSlot & {
  scheme_entry: Pick<SchemeOfWorkRow, "id" | "topic" | "week_number" | "status"> | null;
};

export enum NotificationType {
  URGENT = "URGENT",
  PREP_WARNING = "PREP_WARNING",
  COMPLETED = "COMPLETED",
  INFO = "INFO",
  NEUTRAL = "NEUTRAL",
}

export type NotificationKind = "info" | "warning" | "success" | "reminder";

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  type: NotificationKind;
  read: boolean;
  notification_type: NotificationType;
  message: string;
  sub_message: string | null;
  action_label: string | null;
  action_url: string | null;
  timetable_slot_id: string | null;
  dismissed_at: string | null;
  read_at: string | null;
  notification_date: string;
  created_at: string;
};

export type NotificationPreferences = {
  id: string;
  user_id: string;
  reminder_minutes: number;
  delivery_method: "in_app" | "email" | "both";
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationPreferencesInput = {
  reminder_minutes: number;
  delivery_method: "in_app" | "email" | "both";
  enabled: boolean;
};

export type LessonPackView = {
  id: string;
  user_id: string;
  timetable_slot_id: string;
  scheme_entry_id: string | null;
  viewed_at: string;
  view_date: string;
};

export type AiTipCache = {
  id: string;
  user_id: string;
  topic: string;
  subject: string;
  tip_text: string;
  generated_for_date: string;
  created_at: string;
};

export type SlotTemporalStatus = "done" | "now" | "next" | "later";

export type TodaySlot = {
  slot: TimetableSlot;
  class_name: string;
  subject: string;
  start_time: string;
  duration_minutes: number;
  topic: string | null;
  week_number: number | null;
  lesson_exists: boolean;
  opened_today: boolean;
  status: SlotTemporalStatus;
};

export type WeekSlot = {
  day_label: "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  slots: TodaySlot[];
};

export type TermProgressSubject = {
  subject: string;
  done: number;
  total: number;
  percent: number;
  behind: number;
};

export type TermProgress = {
  week_number: number;
  subjects: TermProgressSubject[];
};
