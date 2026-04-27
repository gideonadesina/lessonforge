export {};

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export type AnalyticsEventName =
  | "lesson_pack_generated"
  | "lesson_slides_generated"
  | "worksheet_generated"
  | "exam_generated"
  | "library_item_opened"
  | "export_pptx_clicked"
  | "export_pdf_clicked"
  | "export_png_clicked"
  | "school_code_copied"
  | "teacher_joined_school"
  | "principal_dashboard_viewed"
  | "teacher_management_viewed"
  | "school_credits_low_warning_seen"
  | "payment_started"
  | "payment_success"
  | "payment_failed"
  | "plan_viewed"
  | "upgrade_clicked"
  | "planning_page_viewed"
  | "scheme_created"
  | "academic_event_created";

export type AnalyticsParams = Record<
  string,
  string | number | boolean | null | undefined
>;

function sanitizeParams(params: AnalyticsParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  );
}

export function track(event: AnalyticsEventName, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", event, sanitizeParams(params));
}
