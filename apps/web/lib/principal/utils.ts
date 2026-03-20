import { TeacherStatus, PrincipalRole } from "@/lib/principal/types";

const PRINCIPAL_ROLE_SET: ReadonlySet<string> = new Set<PrincipalRole>([
  "principal",
  "admin",
  "owner",
  "school_admin",
  "headteacher",
]);

export const DEFAULT_CURRENCY = "NGN" as const;
export const DEFAULT_BILLING_CYCLE = "monthly" as const;
export const DEFAULT_SLOT_PRICE = Number(process.env.PRINCIPAL_PRICE_PER_TEACHER_NGN ?? 3500);
export const MIN_TEACHER_SLOTS = 1;
export const MAX_TEACHER_SLOTS = 500;

export function isPrincipalRole(role: string | null | undefined) {
  if (!role) return false;
  return PRINCIPAL_ROLE_SET.has(role.toLowerCase());
}

export function normalizeTeacherStatus(input: {
  role?: string | null;
  status?: string | null;
}): TeacherStatus {
  const status = String(input.status ?? "").toLowerCase();
  const role = String(input.role ?? "").toLowerCase();

  if (status === "removed" || role === "removed_teacher") return "removed";
  if (status === "disabled" || role === "disabled_teacher") return "disabled";
  if (status === "pending" || role === "pending_teacher") return "pending";
  return "active";
}

export function sanitizeSlotCount(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return MIN_TEACHER_SLOTS;
  return Math.max(MIN_TEACHER_SLOTS, Math.min(MAX_TEACHER_SLOTS, Math.trunc(n)));
}

export function computeSubscriptionAmount(slotCount: number, slotPrice = DEFAULT_SLOT_PRICE) {
  return Math.max(0, sanitizeSlotCount(slotCount) * Math.max(0, slotPrice));
}

export function generateSchoolCode(schoolName: string) {
  const cleaned = (schoolName || "LessonForge School")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials = (cleaned.map((w) => w[0]).join("").slice(0, 4) || "LFSC").padEnd(4, "X");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${initials}-${rand}`;
}

export function isMissingTableOrColumnError(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const code = String(err?.code ?? "");
  if (code === "42P01" || code === "42703") return true;

  const message = String(err?.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("undefined column") ||
    message.includes("relation") ||
    message.includes("table")
  );
}

export function toISODateOnly(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toISOString().slice(0, 10);
}

export function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}