"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type Plan = "free" | "basic" | "pro";

export type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;

  // NEW: make UI tally everywhere
  plan: Plan;
  credits_balance: number;
  credits_monthly_allowance: number;
  pro_expires_at: string | null;
};

export function getPlanInfo(plan: Plan) {
  if (plan === "basic") return { label: "Basic", priceLabel: "₦2,000/mo" };
  if (plan === "pro") return { label: "Pro", priceLabel: "₦5,000/mo" };
  return { label: "Free Trial", priceLabel: "₦0" };
}

function normalizePlan(plan: string | null, isPro?: boolean | null): Plan {
  const p = (plan ?? "free").toLowerCase();
  if (p === "free" || p === "basic" || p === "pro") return p;
  // if old data ever used is_pro
  if (isPro) return "pro";
  return "free";
}

export function useProfile() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const user = data.user;
        if (!user) {
          if (alive.current) setProfile(null);
          return;
        }

        // IMPORTANT: select plan + credits_balance so settings & dashboard match
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select(
            "full_name, avatar_url, email, plan, credits_balance, credits_monthly_allowance, pro_expires_at, is_pro"
          )
          .eq("id", user.id)
          .single();

        if (profErr) throw profErr;

        const normalizedPlan = normalizePlan(prof?.plan ?? null, prof?.is_pro ?? null);

        const normalized: Profile = {
          full_name: prof?.full_name ?? null,
          avatar_url: prof?.avatar_url ?? null,
          email: prof?.email ?? null,

          plan: normalizedPlan,
          credits_balance: Number(prof?.credits_balance ?? 0),
          credits_monthly_allowance: Number(prof?.credits_monthly_allowance ?? 0),
          pro_expires_at: prof?.pro_expires_at ?? null,
        };

        if (alive.current) setProfile(normalized);
      } catch (err: any) {
        if (err?.name !== "AbortError") console.error("useProfile error:", err);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();
  }, [supabase]);

  // NEW: normalized UI-friendly fields (won't break old code)
  const planInfo = getPlanInfo(profile?.plan ?? "free");

  return {
    profile,
    loading,

    // extra helpers: use these in Settings + Dashboard so they tally
    plan: profile?.plan ?? "free",
    planLabel: planInfo.label,
    planPriceLabel: planInfo.priceLabel,

    creditsRemaining: profile?.credits_balance ?? 0,
    monthlyAllowance: profile?.credits_monthly_allowance ?? 0,
    proExpiresAt: profile?.pro_expires_at ?? null,
  };
}
