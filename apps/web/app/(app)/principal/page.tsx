"use client";
 
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import MetricCard from "@/components/principal/MetricCard";
import PrincipalOnboardingCard from "@/components/principal/PrincipalOnboardingCard";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import { useToast } from "@/components/ui/ToastProvider";
import { formatDateOnly, timeAgo, toNaira, usePrincipalDashboard } from "@/lib/principal/client";
import { track } from "@/lib/analytics";
 
const QUICK_LINKS = [
  {
    href: "/principal/teachers",
    title: "Teachers",
    description: "Manage access, statuses, and school staffing health.",
  },
  {
    href: "/principal/workspace",
    title: "Workspace",
    description: "Manage school identity and refresh join code securely.",
  },
  {
    href: "/principal/planning",
    title: "Planning",
    description: "Track milestones and upcoming events at school level.",
  },
  {
    href: "/principal/analytics",
    title: "Analytics",
    description: "Review usage trends, output, and engagement signals.",
  },
  {
    href: "/principal/billing",
    title: "Billing",
    description: "Review plan, shared credits, payment history, and checkout actions.",
  },
  {
    href: "/principal/library",
    title: "Library",
    description: "Open curated content and shared resources for staff.",
  },
];
 
export default function PrincipalPage() {
  const { showToast } = useToast();
  const { supabase, loading, forbidden, error, setError, dashboard, onboardingRequired, getToken, loadDashboard } =
    usePrincipalDashboard();
  const creditToastFlagsRef = useRef({
    emptyShown: false,
    lowShown: false,
  });
  const [schoolCodeCopied, setSchoolCodeCopied] = useState(false);
  const [showWorkspaceSuccessBanner, setShowWorkspaceSuccessBanner] = useState(false);
  const [principalOnboardingSkipped, setPrincipalOnboardingSkipped] = useState(false);
  const [profileSchoolId, setProfileSchoolId] = useState<string | null | undefined>(undefined);
 
  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowWorkspaceSuccessBanner(params.get("success") === "true");
  }, []);

  useEffect(() => {
    setPrincipalOnboardingSkipped(
      window.localStorage.getItem("lessonforge:principal-onboarding-skipped") === "1"
    );
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        setProfileSchoolId(null);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      if (profileError) {
        setProfileSchoolId(null);
        return;
      }

      const schoolId =
        typeof data?.school_id === "string" && data.school_id.trim()
          ? data.school_id
          : null;
      setProfileSchoolId(schoolId);
    })();

    return () => {
      active = false;
    };
  }, [supabase]);


  useEffect(() => {
    if (!dashboard) return;
    track("principal_dashboard_viewed", {
      user_role: "principal",
      active_role: "principal",
      school_id: dashboard.school.id,
      school_name: dashboard.school.name,
      plan_name: dashboard.subscription.planName,
    });

    if (dashboard.schoolCredits.isEmpty) {
      if (!creditToastFlagsRef.current.emptyShown) {
        showToast({
          message:
            "Your school has run out of credits. Teachers cannot generate until you top up.",
          action: { label: "Top up now", href: "/principal/pricing" },
          duration: "persistent",
          color: "rose",
        });
        creditToastFlagsRef.current.emptyShown = true;
      }
      return;
    }

    creditToastFlagsRef.current.emptyShown = false;

    if (dashboard.schoolCredits.isLow) {
      if (creditToastFlagsRef.current.lowShown) return;
      const timeout = window.setTimeout(() => {
        track("school_credits_low_warning_seen", {
          user_role: "principal",
          active_role: "principal",
          school_id: dashboard.school.id,
          school_name: dashboard.school.name,
          plan_name: dashboard.subscription.planName,
        });
        showToast({
          message: `School credits running low - ${dashboard.schoolCredits.remaining} credits left (${dashboard.schoolCredits.percentUsed}% used). Top up soon to avoid interruption.`,
          action: { label: "Top up", href: "/principal/pricing" },
          duration: 10000,
          color: "amber",
        });
      }, 2000);
      creditToastFlagsRef.current.lowShown = true;
      return () => {
        window.clearTimeout(timeout);
      };
    }

    creditToastFlagsRef.current.lowShown = false;
  }, [dashboard, showToast]);

  const alerts = useMemo(() => {
    if (!dashboard) return [] as string[];
 
    const nextAlerts: string[] = [];
    const disabledTeachers = dashboard.teachers.filter((teacher) => teacher.status === "disabled").length;
    if (disabledTeachers > 0) {
      nextAlerts.push(`${disabledTeachers} teacher account(s) are disabled and may need review.`);
    }
 
    if (dashboard.overview.weeklyActivityCount < 5) {
      nextAlerts.push("Weekly teacher activity is low. Share goals or templates to boost momentum.");
    }
 
    if (!nextAlerts.length) {
      nextAlerts.push("Everything looks healthy right now. Keep monitoring growth and teacher adoption.");
    }
 
    return nextAlerts;
  }, [dashboard]);

  async function copySchoolCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setSchoolCodeCopied(true);
      track("school_code_copied", {
        user_role: "principal",
        active_role: "principal",
        school_id: dashboard?.school.id,
        school_name: dashboard?.school.name,
      });
      showToast("School code copied.");
      window.setTimeout(() => setSchoolCodeCopied(false), 2000);
    } catch {
      showToast("Could not copy school code.");
    }
  }
 
 if (loading) return <div style={{color:"red",fontSize:"24px",padding:"40px"}}>LOADING...</div>;
if (forbidden) return <div style={{color:"red",fontSize:"24px",padding:"40px"}}>FORBIDDEN</div>;
if (error) return <div style={{color:"red",fontSize:"24px",padding:"40px"}}>ERROR: {error}</div>;
if (!dashboard && !onboardingRequired) return <div style={{color:"red",fontSize:"24px",padding:"40px"}}>NO DASHBOARD DATA</div>;

const showNoWorkspaceDashboard =
  onboardingRequired && principalOnboardingSkipped && !profileSchoolId;

 return (
    <div className="space-y-5 bg-[var(--bg)] p-4 md:p-6">
      {showNoWorkspaceDashboard ? <NoWorkspaceActivationBanner /> : null}
      {showWorkspaceSuccessBanner && dashboard ? (
        <SchoolWorkspaceSuccessBanner
          code={dashboard.school.code}
          copied={schoolCodeCopied}
          onCopy={() => copySchoolCode(dashboard.school.code)}
        />
      ) : null}

      <PrincipalPageHeader
        eyebrow="LessonForge Executive Suite"
        title="Principal Command Center"
        description="Track school health, unblock team execution, and navigate directly to the exact area you need."
      />

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--card-alt)]"
        >
          🎓 Switch to Teacher View
        </Link>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      ) : null}
 
      {onboardingRequired && !showNoWorkspaceDashboard ? (
        <PrincipalOnboardingCard getToken={getToken} onCompleted={loadDashboard} setParentError={setError} />
      ) : null}

      {showNoWorkspaceDashboard ? <NoWorkspaceDashboard /> : null}
 
      {!onboardingRequired && dashboard ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
  title="Total Teachers"
  value={dashboard.overview.totalTeachers}
  subtitle="Unlimited teachers"
/>
<div className="flex flex-col gap-1">
  <MetricCard
    title="School credits"
    value={dashboard.schoolCredits.remaining}
    subtitle={`of ${dashboard.schoolCredits.total} total · ${dashboard.schoolCredits.percentUsed}% used`}
  />
  {dashboard.schoolCredits.isEmpty ? (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 self-start">
      Credits exhausted
    </span>
  ) : dashboard.schoolCredits.isLow ? (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 self-start">
      Running low
    </span>
  ) : null}
</div>
<MetricCard
  title="Active Teachers"
  value={dashboard.overview.activeTeachers}
  subtitle="Currently active this cycle"
/>
<MetricCard
  title="Lessons Generated"
  value={dashboard.overview.totalLessonsGenerated}
  subtitle="Total output from staff"
/>
<MetricCard
  title="Weekly Activity"
  value={dashboard.overview.weeklyActivityCount}
  subtitle="Last 7 days events"
/>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm dark:border-violet-900/50 dark:bg-violet-900/10">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
                  Teacher Join Code
                </div>
                <div className="mt-1 font-mono text-2xl font-black tracking-wider text-[var(--text-primary)]">
                  {dashboard.school.code}
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Share this with teachers so they can join from the School section.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copySchoolCode(dashboard.school.code)}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                {schoolCodeCopied ? "Copied" : "Copy code"}
              </button>
            </div>
          </div>
 
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-7">
              <SectionCard
                title="Focus this week"
                subtitle="A concise snapshot of where leadership attention should go now."
                action={
                  <Link
                    href="/principal/pricing"
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-900/40"
                  >
                    Manage billing
                  </Link>
                }
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-amber-50/60 p-3 dark:bg-amber-900/20">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Planning progress</div>
                    <div className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                      {dashboard.planning.schemeProgressPercent}%
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {dashboard.planning.completedSchemeMilestones} / {dashboard.planning.totalSchemeMilestones} milestones.
                    </p>
                  </div>
 
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Next billing date</div>
                    <div className="mt-1 text-base font-bold text-[var(--text-primary)]">
                      {formatDateOnly(dashboard.subscription.nextBillingDate)}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Current monthly amount: {toNaira(dashboard.subscription.amountPerCycle)}
                    </p>
                  </div>
 
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 md:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Upcoming highlight</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {dashboard.planning.upcomingAcademicEvents[0]?.title ?? "No upcoming event yet"}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {dashboard.planning.upcomingAcademicEvents[0]?.startsAt
                        ? `Scheduled ${dashboard.planning.upcomingAcademicEvents[0].startsAt}`
                        : "Add school events to keep everyone aligned."}
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>
 
            <div className="space-y-4 xl:col-span-5">
              <SectionCard title="Alerts & watchlist" subtitle="Signals that deserve immediate visibility.">
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div key={alert} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                      {alert}
                    </div>
                  ))}
                </div>
              </SectionCard>
 
              <SectionCard title="Recent school activity" subtitle="Most recent teacher engagement in your workspace.">
                <div className="space-y-2">
                  {dashboard.teachers.slice(0, 3).map((teacher) => (
                    <div key={teacher.userId} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                      <div className="font-semibold text-[var(--text-primary)]">{teacher.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {teacher.lessonsGenerated} lessons • {teacher.worksheetsCreated} worksheets • {timeAgo(teacher.lastActiveAt)}
                      </div>
                    </div>
                  ))}
                  {!dashboard.teachers.length ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                      No teacher activity yet. Invite your team using your school code.
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          </div>
 
          <SectionCard title="Quick links" subtitle="Jump directly to the exact principal workflow you need.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition hover:border-violet-200 hover:bg-violet-50/40 dark:hover:bg-violet-900/20"
                >
                  <div className="text-sm font-bold text-[var(--text-primary)]">{link.title}</div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">{link.description}</div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

function SchoolWorkspaceSuccessBanner({
  code,
  copied,
  onCopy,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-950 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-semibold">
          Your school workspace is ready! Your school code is{" "}
          <span className="font-mono tracking-wider">{code}</span>. Share it
          with your teachers.
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
    </div>
  );
}

function NoWorkspaceActivationBanner() {
  return (
    <div className="rounded-2xl bg-[#6C63FF] px-5 py-4 text-white shadow-[0_8px_24px_rgba(108,99,255,0.22)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-semibold">
          Your school workspace is not activated. Purchase a plan to get your
          school code and start inviting teachers.
        </p>
        <Link
          href="/principal/pricing"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#534AB7] transition hover:bg-[#F5F3FF]"
        >
          Activate Now →
        </Link>
      </div>
    </div>
  );
}

function NoWorkspaceDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Teachers" value={0} subtitle="Unlimited teachers" />
        <MetricCard title="School credits" value={0} subtitle="of 0 total - 0% used" />
        <MetricCard title="Active Teachers" value={0} subtitle="Currently active this cycle" />
        <MetricCard title="Lessons Generated" value={0} subtitle="Total output from staff" />
      </div>

      <SectionCard
        title="Teacher Join Code"
        subtitle="Activate your school workspace to receive a code for inviting teachers."
        action={
          <Link
            href="/principal/pricing"
            className="rounded-lg bg-[#6C63FF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#534AB7]"
          >
            Activate Now →
          </Link>
        }
      >
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card-alt)] px-4 py-5 text-sm text-[var(--text-secondary)]">
          No school code yet. Your code appears here after workspace activation.
        </div>
      </SectionCard>

      <SectionCard title="Quick links" subtitle="Principal tools remain available while your workspace is inactive.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition hover:border-violet-200 hover:bg-violet-50/40 dark:hover:bg-violet-900/20"
            >
              <div className="text-sm font-bold text-[var(--text-primary)]">{link.title}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{link.description}</div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
