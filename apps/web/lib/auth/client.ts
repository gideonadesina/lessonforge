"use client";

import type { AppRole } from "@/lib/auth/roles";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type RoleContextResponse = {
  availableRoles: AppRole[];
  activeRole: AppRole | null;
  needsRoleSelection: boolean;
  hasTeacherAccess: boolean;
  hasPrincipalAccess: boolean;
  isRegistered: boolean;
  roleHomes: {
    teacher: string;
    principal: string;
  };
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function getAccessToken() {
  const supabase = createBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export async function fetchRoleContext(): Promise<RoleContextResponse> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Please log in to continue.");
  }

  const res = await fetch("/api/auth/roles", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as ApiSuccess<RoleContextResponse> | ApiFailure;
  if (!res.ok || !json.ok) {
    throw new Error((json as ApiFailure).error || "Failed to load role access.");
  }

  return json.data;
}

async function requestRoleSwitch(
  role: AppRole,
  options: { claimIfUnprovisioned?: boolean } = {}
) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Please log in to continue.");
  }

  const res = await fetch("/api/auth/roles", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role,
      claimIfUnprovisioned: Boolean(options.claimIfUnprovisioned),
    }),
  });
  const json = (await res.json()) as
    | ApiSuccess<{ activeRole: AppRole; homePath: string }>
    | ApiFailure;
  if (!res.ok || !json.ok) {
    throw new Error((json as ApiFailure).error || "Failed to switch role.");
  }

  return json.data;
}

export async function switchRole(
  role: AppRole,
  options: { claimIfUnprovisioned?: boolean } = {}
) {
  return requestRoleSwitch(role, options);
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  return getErrorMessage(error, fallback);
}
