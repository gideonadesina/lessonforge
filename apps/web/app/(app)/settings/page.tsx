"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOutAndRedirect } from "@/lib/auth/logout";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { LESSON_PACK_CREDIT_COST } from "@/lib/billing/pricing";
import type { Plan } from "@/lib/useProfile";

type Profile = {
  email: string | null;
  plan: Plan;
  credits_balance: number;
};

function normalizePlan(plan: string | null): Plan {
  const p = (plan ?? "free").toLowerCase();
  if (
    p === "basic" ||
    p === "pro" ||
    p === "pro_plus" ||
    p === "ultra_pro" ||
    p === "free"
  ) {
    return p;
  }
  return "free";
}

function getPlanDisplay(plan: Plan) {
  if (plan === "basic") return { label: "Basic", colorClass: "text-slate-900" };
  if (plan === "pro") return { label: "Pro", colorClass: "text-green-600" };
  if (plan === "pro_plus") return { label: "Pro Plus", colorClass: "text-violet-700" };
  if (plan === "ultra_pro") return { label: "Ultra Pro", colorClass: "text-violet-700" };
  return { label: "Free Trial", colorClass: "text-slate-900" };
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const supabase = createBrowserSupabase();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      // ✅ Use the REAL fields that should tally everywhere:
      // plan + credits_balance (NOT free_credits, NOT is_pro)
      const { data, error } = await supabase
        .from("profiles")
        .select("email, plan, credits_balance")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile({
        email: data?.email ?? user.email ?? "",
        plan: normalizePlan(data?.plan ?? "free"),
        credits_balance: Number(data?.credits_balance ?? 0),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      setLoggingOut(true);
      const supabase = createBrowserSupabase();
      await signOutAndRedirect({
        signOut: () => supabase.auth.signOut(),
        to: "/login",
      });
    } catch (err) {
      console.error(err);
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-slate-600">Loading settings...</div>
      </div>
    );
  }

  const planInfo = getPlanDisplay(profile?.plan ?? "free");
  const isPaidPlan = profile?.plan !== "free";

  return (
     <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">Manage your account and plan.</p>
      </div>

      {/* Account Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Account</h2>

        <div className="space-y-3 text-sm">
           <div className="flex justify-between">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-900">{profile?.email}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">Plan</span>
            <span className={`font-medium ${planInfo.colorClass}`}>
              {planInfo.label}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">Remaining Credits</span>
            <span className="font-medium text-slate-900">
              {profile?.credits_balance ?? 0}
            </span>
          </div>
         </div>
      </div>

      {/* Billing */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Billing</h2>

        {isPaidPlan ? (
          <div className="space-y-3">
            <div className="text-green-600 text-sm font-medium">
              Your {planInfo.label} plan is active.
            </div>
            <div className="text-xs text-slate-500">
              1 lesson pack uses {LESSON_PACK_CREDIT_COST} credits.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              Upgrade to get more credits for lesson generation.
            </div>
            <Link
              href="/pricing"
              className="inline-flex bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 text-sm font-semibold"
            >
              View Pricing
            </Link>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Danger Zone</h2>

        <button
          onClick={logout}
          disabled={loggingOut}
          className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 text-sm font-semibold disabled:opacity-50"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
      </div>
  );
}
