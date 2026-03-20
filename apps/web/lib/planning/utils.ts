import type { AcademicEventType, SchemeStatus } from "@/lib/planning/types";

export function getWeekNumber(date: Date) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const yearStart = Date.UTC(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((utc - yearStart) / 86400000) + 1;
  return Math.ceil(dayOfYear / 7);
}

export function formatEventDate(dateValue: string) {
  if (!dateValue) return "";
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatSchemeStatus(status: SchemeStatus) {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  return "Completed";
}

export function formatEventType(type: AcademicEventType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}