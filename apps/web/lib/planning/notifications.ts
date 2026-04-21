import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AuthUserContext = {
  ok: boolean;
  error?: string;
  status?: number;
  supabase?: any;
  user?: { id: string; email: string | null };
};

export type NotificationInsertPayload = {
  user_id: string;
  notification_type: "URGENT" | "PREP_WARNING" | "COMPLETED" | "INFO" | "NEUTRAL";
  message: string;
  sub_message?: string | null;
  action_label?: string | null;
  action_url?: string | null;
  timetable_slot_id?: string | null;
  notification_date: string;
};

export function getBearerTokenFromHeaders(headers: Headers) {
  const auth = headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

export function userScopedSupabaseClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export const createUserSupabaseClientWithToken = userScopedSupabaseClient;
export const supabaseWithToken = userScopedSupabaseClient;

export async function resolveAuthenticatedUser(supabase: { auth: { getUser: () => Promise<{ data: { user: { id: string; email?: string | null } | null }; error: unknown }> } }) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export async function getAuthUserFromToken(token: string): Promise<AuthUserContext> {
  if (!token) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }
  const supabase = userScopedSupabaseClient(token);
  const user = await resolveAuthenticatedUser(supabase);
  if (!user) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }
  return { ok: true, supabase, user };
}

export async function getAuthenticatedUserClient(req: NextRequest): Promise<AuthUserContext> {
  const token = getBearerTokenFromHeaders(req.headers);
  return getAuthUserFromToken(token);
}

export function jsonError(error: string, status = 500) {
  return NextResponse.json({ ok: false, error }, { status });
}

export function utcNowIso() {
  return new Date().toISOString();
}

export const toUtcIsoNow = utcNowIso;

export function isoUtcDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export const isoDateUtc = isoUtcDate;
export const toUtcDateOnly = isoUtcDate;

// Returns ISO weekday: Monday=1 ... Sunday=7
export function utcDayOfWeek(value = new Date()) {
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

export const getUtcIsoWeekday = utcDayOfWeek;

export function startTimeToUtcDate(date: Date, hour: number, minute: number, second = 0) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, second)
  );
}

export function combineUtcDateAndTime(isoDate: string, timeValue: string) {
  const normalizedTime = timeValue.length === 5 ? `${timeValue}:00` : timeValue;
  return new Date(`${isoDate}T${normalizedTime}Z`);
}

export function withMinutesOffset(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

export function minutesUntil(target: Date, now = new Date()) {
  return Math.floor((target.getTime() - now.getTime()) / 60000);
}
