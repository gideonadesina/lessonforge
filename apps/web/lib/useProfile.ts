"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { roleFromUserMetadata, type AppRole } from "@/lib/auth/roles";
import { formatNaira, TEACHER_PRICING_PLANS } from "@/lib/billing/pricing";

export type Plan = "free" | "basic" | "pro" | "pro_plus" | "ultra_pro";

export type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  app_role: AppRole | null;

 
  plan: Plan;
  credits_balance: number;
 
};

export function getPlanInfo(plan: Plan) {
  const matchedPlan = TEACHER_PRICING_PLANS.find((entry) => entry.id === plan);
  if (matchedPlan) {
    return {
      label: matchedPlan.name,
      priceLabel: `${formatNaira(matchedPlan.priceNaira)} per top-up`,
    };
  }
  return { label: "Free Trial", priceLabel: "₦0" };
}

function normalizePlan(plan: string | null): Plan {
  const p = (plan ?? "free").toLowerCase();
  if (
    p === "free" ||
    p === "basic" ||
    p === "pro" ||
    p === "pro_plus" ||
    p === "ultra_pro"
  ) {
    return p;
  }
  
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

       
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, email, plan, credits_balance")
          .eq("id", user.id)
          .single();

        if (profErr) throw profErr;

         const normalizedPlan = normalizePlan(prof?.plan ?? null);

        const normalized: Profile = {
          full_name: prof?.full_name ?? null,
          avatar_url: prof?.avatar_url ?? null,
          email: prof?.email ?? null,
                    app_role: roleFromUserMetadata(user.user_metadata),

          plan: normalizedPlan,
          credits_balance: Number(prof?.credits_balance ?? 0),
          
        };

        if (alive.current) setProfile(normalized);
      } catch (err: unknown) {
        const isAbortError = err instanceof DOMException && err.name === "AbortError";
        if (!isAbortError) console.error("useProfile error:", err);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();
  }, [supabase]);

 
  const planInfo = getPlanInfo(profile?.plan ?? "free");

  return {
    profile,
    loading,

   
    plan: profile?.plan ?? "free",
    role: profile?.app_role ?? null,
    planLabel: planInfo.label,
    planPriceLabel: planInfo.priceLabel,

    creditsRemaining: profile?.credits_balance ?? 0,
  };
}
