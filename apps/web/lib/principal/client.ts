"use client";

import { useCallback, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { PrincipalDashboardPayload } from "@/lib/principal/types";

export type PaymentQuote = {
  teacherSlots: number;
  slotPrice: number;
  amount: number;
  currency: "NGN" | "USD";
  billingCycle: "monthly";
  provider: "placeholder" | "paystack";
  reference: string;
};

type DashboardApiResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  data?: PrincipalDashboardPayload;
  error?: string;
};

export function toNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "No activity yet";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "No activity yet";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function formatDateOnly(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function usePrincipalDashboard() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<PrincipalDashboardPayload | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, [supabase]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please login to continue.");

      const res = await fetch("/api/principal/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as DashboardApiResponse;

      if (res.status === 403) {
        setForbidden(true);
        setDashboard(null);
        setOnboardingRequired(false);
        return;
      }

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load principal workspace.");
      }

      setOnboardingRequired(Boolean(json.onboardingRequired));
      setDashboard(json.data ?? null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load principal workspace."));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  return {
    supabase,
    loading,
    forbidden,
    error,
    setError,
    dashboard,
    onboardingRequired,
    getToken,
    loadDashboard,
  };
}