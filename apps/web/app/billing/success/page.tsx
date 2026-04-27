"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { track } from "@/lib/analytics";

type VerifyState = "loading" | "ok" | "error";

type SuccessDetails = {
  planName: string;
  creditsAdded: number | null;
  previousBalance: number | null;
  newBalance: number | null;
  alreadyProcessed: boolean;
  benefits: string[];
};

const TEACHER_PLAN_NAMES: Record<string, string> = {
  basic: "Basic",
  starter: "Starter",
  pro: "Pro",
  premium: "Premium",
};

const SCHOOL_PLAN_NAMES: Record<string, string> = {
  school_starter: "Starter",
  school_growth: "Growth",
  school_full: "Full School",
  school_enterprise: "Enterprise",
};

const TEACHER_PLAN_BENEFITS: Record<string, string[]> = {
  basic: ["Personal credits added", "Lesson generation access", "Library saving"],
  starter: ["More lesson generations", "Worksheet and lesson tools", "Library saving"],
  pro: ["Expanded credits", "Priority classroom creation tools", "Saved library access"],
  premium: ["Highest teacher credit pack", "Full classroom creation toolkit", "Saved library access"],
};

const SCHOOL_PLAN_BENEFITS: Record<string, string[]> = {
  school_starter: ["Shared school credits", "Teacher join code", "Principal dashboard"],
  school_growth: ["Larger shared credit pool", "More teacher seats", "Principal dashboard"],
  school_full: ["Full-school shared credits", "Expanded teacher seats", "Principal analytics"],
  school_enterprise: ["Enterprise shared credits", "Highest teacher capacity", "Principal analytics"],
};

function formatNumber(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        border: "1px solid rgba(255,255,255,0.35)",
        background: copied ? "#fff" : "rgba(255,255,255,0.08)",
        color: copied ? "#1E1B4B" : "#fff",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 800,
        padding: "9px 14px",
      }}
    >
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}

function LoadingScreen() {
  return (
    <main
      style={{
        alignItems: "center",
        background: "#FAF9F6",
        display: "flex",
        fontFamily: "'Trebuchet MS', sans-serif",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <section
        style={{
          background: "#fff",
          border: "1px solid #E8E5DC",
          borderRadius: 22,
          boxShadow: "0 18px 50px rgba(30,27,75,0.08)",
          maxWidth: 420,
          padding: 34,
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #534AB7, #2F7D6D)",
            borderRadius: 18,
            height: 58,
            margin: "0 auto 18px",
            width: 58,
          }}
        />
        <h1 style={{ color: "#1E1B4B", fontFamily: "Georgia, serif", fontSize: 24, margin: 0 }}>
          Confirming payment...
        </h1>
        <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, margin: "10px 0 0" }}>
          We are securely verifying your transaction and updating your credits.
        </p>
      </section>
    </main>
  );
}

function SuccessInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const reference = sp.get("reference");
  const type = sp.get("type");
  const flow = sp.get("flow");
  const isSchoolFlow = type === "school" || flow === "principal_onboarding";

  const [state, setState] = useState<VerifyState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [details, setDetails] = useState<SuccessDetails | null>(null);
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);

  const supabase = useMemo(() => createBrowserSupabase(), []);

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!reference) {
        setState("error");
        setErrorMsg("Missing payment reference.");
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token ?? "";
        const endpoint = isSchoolFlow
          ? `/api/paystack/school/verify?reference=${encodeURIComponent(reference)}`
          : `/api/paystack/verify?reference=${encodeURIComponent(reference)}`;

        const res = await fetch(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;

        if (!res.ok || json?.ok === false) {
          setState("error");
          setErrorMsg(json?.error || "Could not confirm payment. Please try again.");
          track("payment_failed", {
            user_role: isSchoolFlow ? "principal" : "teacher",
            active_role: isSchoolFlow ? "principal" : "teacher",
            plan_name: String(json?.plan ?? ""),
          });
          return;
        }

        if (isSchoolFlow) {
          const planId = String(json.plan ?? "");
          const schoolId = String(json.schoolId ?? "");
          const planName = SCHOOL_PLAN_NAMES[planId] ?? (planId || "School Plan");
          if (schoolId) {
            const { data: codeRow } = await supabase
              .from("school_codes")
              .select("code")
              .eq("school_id", schoolId)
              .eq("is_active", true)
              .maybeSingle();
            if (active && codeRow?.code) setSchoolCode(codeRow.code);
          }

          setDetails({
            planName,
            creditsAdded:
              typeof json.sharedCreditsAwarded === "number" ? json.sharedCreditsAwarded : null,
            previousBalance:
              typeof json.previousBalance === "number" ? json.previousBalance : null,
            newBalance: typeof json.newBalance === "number" ? json.newBalance : null,
            alreadyProcessed: Boolean(json.alreadyProcessed),
            benefits:
              SCHOOL_PLAN_BENEFITS[planId] ?? [
                "Shared school credits",
                "Teacher join code",
                "Principal dashboard",
              ],
          });
          track("payment_success", {
            user_role: "principal",
            active_role: "principal",
            school_id: schoolId,
            plan_name: planName,
          });
        } else {
          const planId = String(json.plan ?? "");
          const planName = TEACHER_PLAN_NAMES[planId] ?? (planId || "Teacher Plan");
          setDetails({
            planName,
            creditsAdded: typeof json.creditsAwarded === "number" ? json.creditsAwarded : null,
            previousBalance:
              typeof json.previousBalance === "number" ? json.previousBalance : null,
            newBalance: typeof json.newBalance === "number" ? json.newBalance : null,
            alreadyProcessed: Boolean(json.alreadyProcessed),
            benefits:
              TEACHER_PLAN_BENEFITS[planId] ?? [
                "Credits added",
                "Lesson generation access",
                "Library saving",
              ],
          });
          track("payment_success", {
            user_role: "teacher",
            active_role: "teacher",
            plan_name: planName,
          });
        }

        setState("ok");
      } catch (e) {
        if (!active) return;
        setState("error");
        setErrorMsg(e instanceof Error ? e.message : "Verification failed.");
        track("payment_failed", {
          user_role: isSchoolFlow ? "principal" : "teacher",
          active_role: isSchoolFlow ? "principal" : "teacher",
        });
      }
    }

    void verify();
    return () => {
      active = false;
    };
  }, [reference, isSchoolFlow, supabase]);

  useEffect(() => {
    if (state !== "ok") return;
    const interval = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          router.push(isSchoolFlow ? "/principal" : "/dashboard");
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state, router, isSchoolFlow]);

  if (state === "loading") return <LoadingScreen />;

  if (state === "error") {
    return (
      <main
        style={{
          alignItems: "center",
          background: "#FAF9F6",
          display: "flex",
          fontFamily: "'Trebuchet MS', sans-serif",
          justifyContent: "center",
          minHeight: "100vh",
          padding: 24,
        }}
      >
        <section
          style={{
            background: "#fff",
            border: "1px solid #FCA5A5",
            borderRadius: 22,
            boxShadow: "0 18px 50px rgba(30,27,75,0.08)",
            maxWidth: 480,
            padding: 34,
            textAlign: "center",
            width: "100%",
          }}
        >
          <h1 style={{ color: "#1E1B4B", fontFamily: "Georgia, serif", fontSize: 26, margin: 0 }}>
            Payment verification failed
          </h1>
          <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6 }}>{errorMsg}</p>
          <Link href={isSchoolFlow ? "/principal" : "/dashboard"} style={primaryButtonStyle}>
            Go to dashboard
          </Link>
        </section>
      </main>
    );
  }

  const resolvedDetails =
    details ??
    ({
      planName: isSchoolFlow ? "School Plan" : "Teacher Plan",
      creditsAdded: null,
      previousBalance: null,
      newBalance: null,
      alreadyProcessed: false,
      benefits: [],
    } satisfies SuccessDetails);

  return (
    <main
      style={{
        background: "linear-gradient(180deg, #FAF9F6 0%, #F4F1EA 100%)",
        color: "#1E1B4B",
        fontFamily: "'Trebuchet MS', sans-serif",
        minHeight: "100vh",
        padding: "32px 20px",
      }}
    >
      <section style={{ margin: "0 auto", maxWidth: 760 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #E8E5DC",
            borderRadius: 28,
            boxShadow: "0 24px 70px rgba(30,27,75,0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #1E1B4B, #534AB7 60%, #2F7D6D)",
              color: "#fff",
              padding: "34px 34px 30px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, opacity: 0.75 }}>
              PAYMENT SUCCESSFUL
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 36, lineHeight: 1.1, margin: "10px 0 8px" }}>
              Payment successful
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, maxWidth: 560, opacity: 0.82 }}>
              Your {isSchoolFlow ? "school workspace" : "account"} has been updated. You can keep working now.
            </p>
            {resolvedDetails.alreadyProcessed ? (
              <div
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 12,
                  fontSize: 13,
                  marginTop: 18,
                  padding: "10px 12px",
                }}
              >
                This payment was already confirmed, so we are showing the saved success details.
              </div>
            ) : null}
          </div>

          <div style={{ padding: 34 }}>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                marginBottom: 24,
              }}
            >
              <Metric label="Plan purchased" value={resolvedDetails.planName} />
              <Metric
                label={isSchoolFlow ? "School credits added" : "Credits added"}
                value={formatNumber(resolvedDetails.creditsAdded)}
              />
              <Metric label="Previous balance" value={formatNumber(resolvedDetails.previousBalance)} />
              <Metric
                label={isSchoolFlow ? "School balance" : "New balance"}
                value={formatNumber(resolvedDetails.newBalance)}
                accent
              />
            </div>

            <div
              style={{
                border: "1px solid #E8E5DC",
                borderRadius: 18,
                marginBottom: 22,
                padding: 18,
              }}
            >
              <div style={{ color: "#64748B", fontSize: 12, fontWeight: 800, letterSpacing: 1.4, marginBottom: 12 }}>
                BENEFITS UNLOCKED
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {resolvedDetails.benefits.map((benefit) => (
                  <div key={benefit} style={{ alignItems: "center", display: "flex", gap: 10 }}>
                    <span
                      style={{
                        background: "#E7F6EF",
                        borderRadius: 999,
                        color: "#167A52",
                        display: "inline-flex",
                        fontSize: 12,
                        fontWeight: 900,
                        height: 22,
                        justifyContent: "center",
                        lineHeight: "22px",
                        width: 22,
                      }}
                    >
                      OK
                    </span>
                    <span style={{ color: "#334155", fontSize: 14 }}>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {isSchoolFlow ? (
              <div
                style={{
                  background: "#1E1B4B",
                  borderRadius: 18,
                  color: "#fff",
                  marginBottom: 22,
                  padding: 20,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, opacity: 0.6 }}>
                  SCHOOL JOIN CODE
                </div>
                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginTop: 10 }}>
                  <strong style={{ fontFamily: "monospace", fontSize: 28, letterSpacing: 5 }}>
                    {schoolCode ?? "Loading..."}
                  </strong>
                  {schoolCode ? <CopyButton text={schoolCode} /> : null}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {isSchoolFlow ? (
                <Link href="/principal" style={primaryButtonStyle}>
                  Go to principal dashboard
                </Link>
              ) : (
                <Link href="/dashboard" style={primaryButtonStyle}>
                  Go to dashboard
                </Link>
              )}
              <Link href="/generate" style={secondaryButtonStyle}>
                Generate lesson
              </Link>
              {!isSchoolFlow ? (
                <Link href="/dashboard" style={secondaryButtonStyle}>
                  Go to dashboard
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <p style={{ color: "#64748B", fontSize: 12, marginTop: 14, textAlign: "center" }}>
          Redirecting to {isSchoolFlow ? "Principal Dashboard" : "Dashboard"} in{" "}
          <strong style={{ color: "#534AB7" }}>{countdown}s</strong>
          {reference ? ` | Ref: ${reference}` : ""}
        </p>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? "#E7F6EF" : "#F8F7F2",
        border: accent ? "1px solid #BFE8D4" : "1px solid #ECE8DE",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ color: accent ? "#167A52" : "#64748B", fontSize: 11, fontWeight: 800, letterSpacing: 1.4 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ color: "#1E1B4B", fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 800, marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}

const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(135deg, #534AB7, #3D35A0)",
  borderRadius: 12,
  boxShadow: "0 10px 24px rgba(83,74,183,0.25)",
  color: "#fff",
  display: "inline-flex",
  fontSize: 14,
  fontWeight: 800,
  justifyContent: "center",
  minWidth: 170,
  padding: "13px 18px",
  textDecoration: "none",
};

const secondaryButtonStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #D9D4C7",
  borderRadius: 12,
  color: "#1E1B4B",
  display: "inline-flex",
  fontSize: 14,
  fontWeight: 800,
  justifyContent: "center",
  minWidth: 150,
  padding: "13px 18px",
  textDecoration: "none",
};

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SuccessInner />
    </Suspense>
  );
}
