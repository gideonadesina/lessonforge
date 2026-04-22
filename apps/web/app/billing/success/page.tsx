"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { TEACHER_PRICING_PLANS, SCHOOL_PRICING_PLANS, formatNaira } from "@/lib/billing/pricing";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type VerifyState = "loading" | "ok" | "bad";

type TeacherSuccessData = {
  planName: string;
  credits: number;
  firstName: string;
  monthlyPriceNaira: number;
};

type SchoolSuccessData = {
  planName: string;
  schoolCode: string;
  sharedCredits: number;
  teacherSeats: number;
  monthlyPriceNaira: number;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function normalizeNaira(value: number) {
  if (value > 1_000_000) return Math.round(value / 100);
  return Math.round(value);
}

function formatDatePlus30Days() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toTitleCasePlan(value: string) {
  if (!value.trim()) return "Plan";
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getFirstNameFromFullName(name: string) {
  return name.trim().split(/\s+/)[0] || "";
}

function CheckIconCircle({ className }: { className?: string }) {
  return (
    <span className={["inline-flex items-center justify-center rounded-full", className ?? ""].join(" ")}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path fill="currentColor" d="M9.55 16.35 5.7 12.5l1.4-1.4 2.45 2.45 7.35-7.35 1.4 1.4z" />
      </svg>
    </span>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-slate-500">
      <path
        fill="currentColor"
        d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2m-7-2a2 2 0 1 1 4 0v2h-4z"
      />
    </svg>
  );
}

function SuccessInner() {
  const sp = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const copiedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reference = String(sp.get("reference") ?? sp.get("trxref") ?? "").trim();
  const flow = String(sp.get("flow") ?? "").trim();
  const type = String(sp.get("type") ?? "").trim().toLowerCase();
  const isSchoolSuccess = type === "school";

  const [state, setState] = useState<VerifyState>("loading");
  const [msg, setMsg] = useState("Confirming your payment...");
  const [teacherData, setTeacherData] = useState<TeacherSuccessData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolSuccessData | null>(null);
  const [copied, setCopied] = useState<"none" | "code" | "share">("none");

  useEffect(() => {
    let active = true;

    async function verifyAndLoad() {
      if (!reference) {
        if (!active) return;
        setState("bad");
        setMsg("Missing payment reference.");
        return;
      }

      try {
        const verifyEndpoint = isSchoolSuccess
          ? `/api/principal/payment/verify?reference=${encodeURIComponent(reference)}`
          : `/api/paystack/verify?reference=${encodeURIComponent(reference)}`;

        let authHeader: Record<string, string> = {};
        if (isSchoolSuccess) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            authHeader = { Authorization: `Bearer ${token}` };
          }
        }

        const verifyRes = await fetch(verifyEndpoint, {
          method: "GET",
          headers: authHeader,
          cache: "no-store",
        });
        const verifyJson = await verifyRes.json().catch(() => ({} as Record<string, unknown>));
        if (!active) return;

        if (!verifyRes.ok || verifyJson?.ok === false) {
          setState("bad");
          setMsg(String(verifyJson?.error ?? "Could not confirm payment yet. Please refresh shortly."));
          return;
        }

        const verifyData = (verifyJson?.data ?? verifyJson) as Record<string, unknown>;

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (isSchoolSuccess) {
          const { data: schools } = await supabase
            .from("schools")
            .select("*")
            .eq("created_by", user?.id ?? "")
            .order("created_at", { ascending: false })
            .limit(1);

          const schoolRecord = ((schools ?? [])[0] ?? null) as Record<string, unknown> | null;
          const schoolId = String(schoolRecord?.id ?? "").trim();
          let schoolCode = pickString(schoolRecord?.code);

          if (schoolId) {
            const { data: codeRows } = await supabase
              .from("school_codes")
              .select("*")
              .eq("school_id", schoolId)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(1);

            const activeCode = ((codeRows ?? [])[0] ?? null) as Record<string, unknown> | null;
            schoolCode = pickString(activeCode?.code, schoolCode);
          }

          const schoolPlan = pickString(
            schoolRecord?.plan_name,
            schoolRecord?.plan,
            verifyData?.plan_name,
            verifyData?.plan,
            verifyData?.tier
          );
          const sharedCredits =
            pickNumber(
              schoolRecord?.shared_credits,
              schoolRecord?.credits,
              schoolRecord?.credits_balance,
              verifyData?.shared_credits,
              verifyData?.credits
            ) ?? 0;
          const teacherSeats =
            pickNumber(
              schoolRecord?.teacher_seats,
              schoolRecord?.teacher_slots,
              schoolRecord?.teachers,
              verifyData?.teacher_seats,
              verifyData?.teacher_slots
            ) ?? 0;

          const matchedSchoolPlan =
            SCHOOL_PRICING_PLANS.find((plan) => normalize(plan.name) === normalize(schoolPlan)) ??
            SCHOOL_PRICING_PLANS.find((plan) => normalize(plan.id) === normalize(schoolPlan));
          const paidAmount = pickNumber(verifyData?.amount_major, verifyData?.amount, verifyData?.paid_amount_major);
          const monthlyPriceNaira = Math.max(
  0,
  Number(matchedSchoolPlan?.priceNaira ?? normalizeNaira(paidAmount ?? 0))
);

          setSchoolData({
            planName: toTitleCasePlan(schoolPlan || matchedSchoolPlan?.name || "School Plan"),
            schoolCode,
            sharedCredits: Math.max(0, Math.round(sharedCredits)),
            teacherSeats: Math.max(0, Math.round(teacherSeats)),
            monthlyPriceNaira,
          });
        } else {
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id ?? "").maybeSingle();
          const profileRecord = (profile ?? null) as Record<string, unknown> | null;
          const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;

          const teacherPlan = pickString(
            verifyData?.plan_name,
            verifyData?.plan,
            verifyData?.tier,
            profileRecord?.plan_name,
            profileRecord?.plan
          );
          const matchedTeacherPlan =
            TEACHER_PRICING_PLANS.find((plan) => normalize(plan.name) === normalize(teacherPlan)) ??
            TEACHER_PRICING_PLANS.find((plan) => normalize(plan.id) === normalize(teacherPlan));
          const credits =
            pickNumber(
              verifyData?.credits,
              verifyData?.credits_added,
              verifyData?.allocated_credits,
              profileRecord?.credits_balance
            ) ?? matchedTeacherPlan?.credits ?? 0;
          const paidAmount = pickNumber(verifyData?.amount_major, verifyData?.amount, verifyData?.paid_amount_major);
         const monthlyPriceNaira = Math.max(
  0,
  Number(matchedTeacherPlan?.priceNaira ?? normalizeNaira(paidAmount ?? 0))
);

          const firstName = pickString(
            profileRecord?.first_name,
            getFirstNameFromFullName(pickString(profileRecord?.full_name)),
            metadata?.first_name,
            getFirstNameFromFullName(pickString(metadata?.full_name, metadata?.name)),
            pickString(user?.email).split("@")[0]
          );

          setTeacherData({
            planName: toTitleCasePlan(teacherPlan || matchedTeacherPlan?.name || "Plan"),
            credits: Math.max(0, Math.round(credits)),
            firstName: toTitleCasePlan(firstName || "Teacher"),
            monthlyPriceNaira,
          });
        }

        setState("ok");
        setMsg("Payment successful.");
      } catch (error: unknown) {
        if (!active) return;
        setState("bad");
        setMsg(error instanceof Error ? error.message : "Verification failed.");
      }
    }

    void verifyAndLoad();

    return () => {
      active = false;
    };
  }, [isSchoolSuccess, reference, supabase]);

  useEffect(() => {
    return () => {
      if (copiedResetTimerRef.current) clearTimeout(copiedResetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (state !== "ok") return;
    track("payment_success", {
      reference,
      flow: flow || "default",
      type: isSchoolSuccess ? "school" : "teacher",
    });
  }, [flow, isSchoolSuccess, reference, state]);

  const nextBilling = formatDatePlus30Days();

  const teacherPlanLower = String(teacherData?.planName ?? "").toLowerCase();
  const teacherIsProOrAbove =
    teacherPlanLower.includes("pro") ||
    teacherPlanLower.includes("premium") ||
    teacherPlanLower.includes("growth") ||
    teacherPlanLower.includes("full") ||
    teacherPlanLower.includes("enterprise");
  const teacherLessonPacks = Math.floor((teacherData?.credits ?? 0) / 4);

  const schoolPlanLower = String(schoolData?.planName ?? "").toLowerCase();
  const schoolGrowthOrAbove =
    schoolPlanLower.includes("growth") ||
    schoolPlanLower.includes("full") ||
    schoolPlanLower.includes("enterprise");
  const schoolLessonPacks = Math.floor((schoolData?.sharedCredits ?? 0) / 4);

  async function copyToClipboard(value: string, mode: "code" | "share") {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(mode);
    if (copiedResetTimerRef.current) clearTimeout(copiedResetTimerRef.current);
    copiedResetTimerRef.current = setTimeout(() => setCopied("none"), 2000);
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <div className="w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">Confirming your payment...</p>
        </div>
      </div>
    );
  }

  if (state === "bad") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <div className="w-full max-w-[480px] rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">We could not confirm this payment yet</h1>
          <p className="mt-2 text-sm text-slate-600">{msg}</p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Back home
            </Link>
            <Link
              href="/settings"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white"
            >
              View billing settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSchoolSuccess) {
    const schoolCode = schoolData?.schoolCode ?? "";
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <div className="w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEEDFE] text-[#3C3489]">
            <CheckIconCircle className="h-10 w-10" />
          </div>
          <div className="mt-4 text-center">
            <span className="inline-flex rounded-full bg-[#EEEDFE] px-3 py-1 text-xs font-semibold text-[#3C3489]">
              School {schoolData?.planName ?? "Plan"} · Active
            </span>
            <h1 className="mt-3 text-[22px] font-medium text-slate-900">Your school is now on LessonForge</h1>
            <p className="mt-2 text-sm text-slate-600">
              Share your school code with teachers to get everyone started today.
            </p>
          </div>

          <div className="my-6 h-px bg-slate-200" />

          <div className="rounded-xl border border-[#AFA9EC] bg-[#EEEDFE] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#534AB7]">Your school code</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-[26px] font-medium tracking-[0.12em] text-[#3C3489]">{schoolCode || "—"}</p>
              <button
                type="button"
                onClick={() => copyToClipboard(schoolCode, "code")}
                className="inline-flex rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white"
              >
                {copied === "code" ? "Copied!" : "Copy code"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Share this with your teachers via WhatsApp or email. They enter it in the School section of their
              dashboard.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-semibold text-slate-900">{schoolData?.sharedCredits ?? 0}</p>
              <p className="text-xs text-slate-600">Shared credits</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-semibold text-slate-900">~{schoolLessonPacks}</p>
              <p className="text-xs text-slate-600">Lesson packs</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-semibold text-slate-900">{schoolData?.teacherSeats ?? 0}</p>
              <p className="text-xs text-slate-600">Teacher seats</p>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">What you unlocked</h2>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <CheckIconCircle className="h-6 w-6 bg-emerald-100 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Principal dashboard activated</p>
                  <p className="text-xs text-slate-600">See every teacher&apos;s activity and lessons generated</p>
                </div>
              </div>
              {schoolGrowthOrAbove ? (
                <>
                  <div className="flex gap-3 rounded-xl border border-slate-100 p-3">
                    <CheckIconCircle className="h-6 w-6 bg-emerald-100 text-emerald-700" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Per-teacher credit limits</p>
                      <p className="text-xs text-slate-600">Control how much each teacher can generate</p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-slate-100 p-3">
                    <CheckIconCircle className="h-6 w-6 bg-emerald-100 text-emerald-700" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">2-month credit rollover + analytics</p>
                      <p className="text-xs text-slate-600">Unused credits carry forward</p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Plan</span>
              <span className="font-semibold text-slate-900">
                {schoolData?.planName ?? "School Plan"} · {formatNaira(schoolData?.monthlyPriceNaira ?? 0)}/month
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Credits</span>
              <span className="font-semibold text-slate-900">{schoolData?.sharedCredits ?? 0} credits</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Next billing</span>
              <span className="font-semibold text-slate-900">{nextBilling}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Receipt</span>
              <span className="font-semibold text-[#534AB7]">Sent to your email</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/principal/dashboard"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#534AB7] px-4 py-3 text-sm font-semibold text-white"
            >
              Go to principal dashboard
            </Link>
            <button
              type="button"
              onClick={() => copyToClipboard(schoolCode, "share")}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
            >
              {copied === "share" ? "Copied!" : "Share school code with teachers"}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600">
            <LockIcon />
            <span>Payment secured · Cancel anytime · Teachers can join immediately</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEEDFE] text-[#3C3489]">
          <CheckIconCircle className="h-10 w-10" />
        </div>
        <div className="mt-4 text-center">
          <span className="inline-flex rounded-full bg-[#EEEDFE] px-3 py-1 text-xs font-semibold text-[#3C3489]">
            {teacherData?.planName ?? "Plan"} · Active
          </span>
          <h1 className="mt-3 text-[22px] font-medium text-slate-900">
            Welcome to LessonForge {teacherData?.planName ?? "Plan"}, {teacherData?.firstName ?? "Teacher"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your plan is live. Everything you need to teach better starts right here.
          </p>
        </div>

        <div className="my-6 h-px bg-slate-200" />

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">What you unlocked</h2>
          <div className="mt-3 space-y-3">
            <div className="flex gap-3 rounded-xl border border-slate-100 p-3">
              <CheckIconCircle className="h-6 w-6 bg-emerald-100 text-emerald-700" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{teacherData?.credits ?? 0} credits added to your account</p>
                <p className="text-xs text-slate-600">
                  Enough for ~{teacherLessonPacks} complete lesson packs this month
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-slate-100 p-3">
              <CheckIconCircle className="h-6 w-6 bg-emerald-100 text-emerald-700" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Full lesson packs unlocked</p>
                <p className="text-xs text-slate-600">Lesson plan · slides · teacher notes · worksheet · quiz</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-slate-100 p-3">
              <CheckIconCircle className="h-6 w-6 bg-emerald-100 text-emerald-700" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {teacherIsProOrAbove ? "Advanced templates + PDF/PPT export" : "Standard templates · lesson plan and notes"}
                </p>
                <p className="text-xs text-slate-600">
                  {teacherIsProOrAbove ? "Share and print your lessons instantly" : "Built for fast everyday planning"}
                </p>
              </div>
            </div>
            {teacherIsProOrAbove ? (
              <div className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <CheckIconCircle className="h-6 w-6 bg-emerald-100 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">2-month credit rollover</p>
                  <p className="text-xs text-slate-600">Unused credits carry forward — nothing wasted</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Plan</span>
            <span className="font-semibold text-slate-900">
              {teacherData?.planName ?? "Plan"} · {formatNaira(teacherData?.monthlyPriceNaira ?? 0)}/month
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Credits</span>
            <span className="font-semibold text-slate-900">{teacherData?.credits ?? 0} credits</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Next billing</span>
            <span className="font-semibold text-slate-900">{nextBilling}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Receipt</span>
            <span className="font-semibold text-[#534AB7]">Sent to your email</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Link
            href="/generate"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#534AB7] px-4 py-3 text-sm font-semibold text-white"
          >
            Start generating lessons →
          </Link>
          <Link
            href="/settings"
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
          >
            View my plan details
          </Link>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600">
          <LockIcon />
          <span>Payment secured · Cancel anytime · Credits never expire mid-month</span>
        </div>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6 text-slate-900">
          Loading…
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}