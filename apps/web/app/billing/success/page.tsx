"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type VerifyState = "loading" | "ok" | "error";

const SCHOOL_PLAN_NAMES: Record<string, string> = {
  school_starter: "Starter",
  school_growth: "Growth",
  school_full: "Full School",
  school_enterprise: "Enterprise",
};

const SCHOOL_PLAN_CREDITS: Record<string, number> = {
  school_starter: 200,
  school_growth: 450,
  school_full: 850,
  school_enterprise: 1200,
};

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
        padding: "8px 16px",
        borderRadius: "8px",
        border: "1.5px solid #534AB7",
        background: copied ? "#534AB7" : "transparent",
        color: copied ? "#fff" : "#534AB7",
        fontSize: "12px",
        fontWeight: "700",
        fontFamily: "'Trebuchet MS', sans-serif",
        cursor: "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ Copied!" : "Copy Code"}
    </button>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#FAF9F6",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Trebuchet MS', sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, #534AB7, #3D35A0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "26px",
          margin: "0 auto 20px",
          animation: "pulse 1.5s ease-in-out infinite",
        }}>🎓</div>
        <p style={{ color: "#534AB7", fontWeight: "600", fontSize: "15px" }}>
          Confirming your payment...
        </p>
        <p style={{ color: "#94A3B8", fontSize: "13px", marginTop: "6px" }}>
          This takes just a moment
        </p>
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(83,74,183,0.3); }
            50% { transform: scale(1.08); box-shadow: 0 8px 32px rgba(83,74,183,0.5); }
          }
        `}</style>
      </div>
    </div>
  );
}

function SuccessInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const reference = sp.get("reference");
  const type = sp.get("type"); // "school" or "teacher"
  const flow = sp.get("flow");

  const [state, setState] = useState<VerifyState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(8);

  const supabase = useMemo(() => createBrowserSupabase(), []);

  const isSchoolFlow = type === "school" || flow === "principal_onboarding";

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!reference) {
        setState("error");
        setErrorMsg("Missing payment reference.");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
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

        if (res.ok && json?.ok !== false) {
          setState("ok");

          if (isSchoolFlow) {
            // Get school code from database
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: schoolMember } = await supabase
                .from("school_members")
                .select("school_id")
                .eq("user_id", user.id)
                .maybeSingle();

              if (schoolMember?.school_id) {
                const { data: codeRow } = await supabase
                  .from("school_codes")
                  .select("code")
                  .eq("school_id", schoolMember.school_id)
                  .eq("is_active", true)
                  .maybeSingle();

                if (codeRow?.code) setSchoolCode(codeRow.code);
              }

              // Get plan from payment metadata
              if (json.plan) {
                setPlan(SCHOOL_PLAN_NAMES[json.plan] ?? json.plan);
                setCredits(SCHOOL_PLAN_CREDITS[json.plan] ?? json.sharedCreditsAwarded ?? null);
              }
            }
          } else {
            // Teacher flow — get updated profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("credits_balance, plan")
                .eq("id", user.id)
                .single();

              if (profile) {
                setCredits(profile.credits_balance);
                setPlan(profile.plan);
              }
            }
          }
        } else {
          setState("error");
          setErrorMsg(json?.error || "Could not confirm payment. Please try again.");
        }
      } catch (e) {
        if (!active) return;
        setState("error");
        setErrorMsg(e instanceof Error ? e.message : "Verification failed.");
      }
    }

    void verify();
    return () => { active = false; };
  }, [reference, isSchoolFlow, supabase]);

  // Countdown auto-redirect
  useEffect(() => {
    if (state !== "ok") return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          router.push(isSchoolFlow ? "/principal" : "/dashboard");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state, router, isSchoolFlow]);

  if (state === "loading") return <LoadingScreen />;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FAF9F6",
      fontFamily: "'Trebuchet MS', sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes confetti {
          0% { opacity: 0; transform: translateY(-10px) scale(0.8); }
          50% { opacity: 1; transform: translateY(0) scale(1.1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div style={{ maxWidth: "560px", width: "100%", animation: "slideUp 0.5s ease" }}>

        {state === "error" ? (
          /* ── Error State ── */
          <div style={{
            background: "#fff",
            border: "1px solid #FCA5A5",
            borderRadius: "20px",
            padding: "36px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h1 style={{
              fontFamily: "Georgia, serif",
              fontSize: "24px",
              fontWeight: "700",
              color: "#1E1B4B",
              marginBottom: "10px",
            }}>Payment Verification Failed</h1>
            <p style={{ color: "#64748B", fontSize: "14px", marginBottom: "24px", lineHeight: "1.6" }}>
              {errorMsg}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href={isSchoolFlow ? "/principal/pricing" : "/pricing"} style={{
                padding: "11px 20px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #534AB7, #3D35A0)",
                color: "#fff",
                fontWeight: "700",
                fontSize: "13px",
                textDecoration: "none",
              }}>
                Try Again
              </Link>
              <Link href={isSchoolFlow ? "/principal" : "/dashboard"} style={{
                padding: "11px 20px",
                borderRadius: "10px",
                border: "1.5px solid #E2E8F0",
                color: "#475569",
                fontWeight: "600",
                fontSize: "13px",
                textDecoration: "none",
              }}>
                Go to Dashboard
              </Link>
            </div>
            {reference && (
              <p style={{ color: "#94A3B8", fontSize: "11px", marginTop: "20px", fontFamily: "monospace" }}>
                Ref: {reference}
              </p>
            )}
          </div>
        ) : (
          /* ── Success State ── */
          <>
            {/* Celebration banner */}
            <div style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(83,74,183,0.12))",
              border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: "16px",
              padding: "18px 22px",
              marginBottom: "20px",
              textAlign: "center",
              animation: "confetti 0.6s ease both",
            }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎊</div>
              <div style={{
                fontFamily: "Georgia, serif",
                fontSize: "18px",
                fontWeight: "700",
                color: "#1E1B4B",
                marginBottom: "4px",
              }}>
                {isSchoolFlow ? "School workspace activated!" : "Credits added successfully!"}
              </div>
              <div style={{ color: "#64748B", fontSize: "13px" }}>
                {isSchoolFlow
                  ? "Your school is ready. Share the code below with your teachers."
                  : "Your account has been upgraded. Start generating immediately."}
              </div>
            </div>

            {/* Main card */}
            <div style={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: "20px",
              padding: "32px",
              boxShadow: "0 4px 24px rgba(83,74,183,0.08)",
              marginBottom: "16px",
            }}>
              {/* Plan + Credits */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "24px",
              }}>
                <div style={{
                  background: "#EEEDFE",
                  borderRadius: "14px",
                  padding: "16px",
                }}>
                  <div style={{ fontSize: "11px", color: "#534AB7", fontWeight: "700", letterSpacing: "1.5px", marginBottom: "6px" }}>
                    PLAN
                  </div>
                  <div style={{
                    fontFamily: "Georgia, serif",
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#1E1B4B",
                  }}>
                    {plan ?? (isSchoolFlow ? "School Plan" : "Pro")}
                  </div>
                </div>

                <div style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "14px",
                  padding: "16px",
                }}>
                  <div style={{ fontSize: "11px", color: "#92400E", fontWeight: "700", letterSpacing: "1.5px", marginBottom: "6px" }}>
                    {isSchoolFlow ? "SHARED CREDITS" : "YOUR CREDITS"}
                  </div>
                  <div style={{
                    fontFamily: "Georgia, serif",
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#1E1B4B",
                  }}>
                    {credits !== null ? credits : "—"}
                  </div>
                </div>
              </div>

              {/* School code section */}
              {isSchoolFlow && (
                <div style={{
                  background: "linear-gradient(135deg, #1E1B4B, #3D35A0)",
                  borderRadius: "16px",
                  padding: "20px 22px",
                  marginBottom: "20px",
                }}>
                  <div style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.6)",
                    letterSpacing: "2px",
                    fontWeight: "700",
                    marginBottom: "10px",
                  }}>
                    YOUR SCHOOL CODE
                  </div>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}>
                    <div style={{
                      fontFamily: "monospace",
                      fontSize: "28px",
                      fontWeight: "800",
                      color: "#fff",
                      letterSpacing: "6px",
                    }}>
                      {schoolCode ?? "Loading..."}
                    </div>
                    {schoolCode && <CopyButton text={schoolCode} />}
                  </div>
                  <p style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "12px",
                    marginTop: "10px",
                    lineHeight: "1.5",
                  }}>
                    Share this code with your teachers. They enter it on their dashboard to join your school and access shared credits.
                  </p>
                </div>
              )}

              {/* Next steps */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#94A3B8",
                  letterSpacing: "1.5px",
                  marginBottom: "12px",
                }}>
                  NEXT STEPS
                </div>
               <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
  {(isSchoolFlow
    ? [
        { icon: "📋", text: "Go to your Principal Dashboard to see school credits" },
        { icon: "👩‍🏫", text: "Share the school code with your teachers" },
        { icon: "🎓", text: "Teachers join school → credits are shared automatically" },
        { icon: "📊", text: "Monitor teacher activity from your Principal Analytics" },
      ]
    : [
        { icon: "⚡", text: "Credits are in your account immediately" },
        { icon: "📋", text: "Generate lesson plans, worksheets, slides, and exams" },
        { icon: "📚", text: "All generated content saves to your Library automatically" },
      ]
  ).map(({ icon, text }) => (
    <div
      key={text}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 14px",
        background: "#FAFAFA",
        borderRadius: "10px",
        border: "1px solid #F1F5F9",
      }}
    >
      <span style={{ fontSize: "16px" }}>{icon}</span>
      <span style={{ fontSize: "13px", color: "#475569" }}>{text}</span>
    </div>
  ))}
</div>
              </div>

              {/* CTA buttons */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link
                  href={isSchoolFlow ? "/principal" : "/dashboard"}
                  style={{
                    flex: 1,
                    minWidth: "140px",
                    padding: "13px 20px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #534AB7, #3D35A0)",
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: "14px",
                    textDecoration: "none",
                    textAlign: "center",
                    boxShadow: "0 4px 16px rgba(83,74,183,0.35)",
                  }}
                >
                  {isSchoolFlow ? "Go to Principal Dashboard →" : "Start Generating →"}
                </Link>
                {!isSchoolFlow && (
                  <Link href="/generate" style={{
                    padding: "13px 20px",
                    borderRadius: "12px",
                    border: "1.5px solid #534AB7",
                    color: "#534AB7",
                    fontWeight: "700",
                    fontSize: "14px",
                    textDecoration: "none",
                    textAlign: "center",
                  }}>
                    Generate Now
                  </Link>
                )}
              </div>
            </div>

            {/* Auto-redirect notice */}
            <div style={{
              textAlign: "center",
              padding: "12px",
              background: "rgba(83,74,183,0.06)",
              borderRadius: "10px",
            }}>
              <p style={{ fontSize: "12px", color: "#64748B" }}>
                Redirecting to {isSchoolFlow ? "Principal Dashboard" : "Dashboard"} in{" "}
                <strong style={{ color: "#534AB7" }}>{countdown}s</strong>
              </p>
              {reference && (
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px", fontFamily: "monospace" }}>
                  Ref: {reference}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SuccessInner />
    </Suspense>
  );
}