"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, FileQuestion, FileText, Presentation, X } from "lucide-react";
import MetricCard from "@/components/principal/MetricCard";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import {
  PrincipalForbiddenState,
  PrincipalLoadingState,
  PrincipalOnboardingRequiredState,
} from "@/components/principal/PrincipalStates";
import { formatDateOnly, timeAgo, usePrincipalDashboard } from "@/lib/principal/client";
import type { PrincipalActivityType, TeacherListItem } from "@/lib/principal/types";

type SortKey =
  | "name"
  | "lessonsGenerated"
  | "slidesGenerated"
  | "worksheetsCreated"
  | "examsGenerated"
  | "creditsUsed"
  | "lastActiveAt";

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
};

const typeLabels: Record<PrincipalActivityType, string> = {
  lesson_pack: "lesson plan",
  slides: "slide deck",
  worksheet: "worksheet",
  exam: "exam",
};

const typeIcons: Record<PrincipalActivityType, ReactNode> = {
  lesson_pack: <BookOpen className="h-4 w-4" />,
  slides: <Presentation className="h-4 w-4" />,
  worksheet: <FileText className="h-4 w-4" />,
  exam: <FileQuestion className="h-4 w-4" />,
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function compareDates(a?: string | null, b?: string | null) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
}

function sortValue(teacher: TeacherListItem, key: SortKey) {
  if (key === "name") return teacher.name.toLowerCase();
  if (key === "lastActiveAt") return teacher.lastActiveAt;
  return teacher[key];
}

function TeacherStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
      ].join(" ")}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ActivityIcon({ type }: { type: PrincipalActivityType }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-[#6C63FF]">
      {typeIcons[type]}
    </span>
  );
}

export default function PrincipalAnalyticsPage() {
  const { loading, forbidden, error, dashboard, onboardingRequired, loadDashboard } = usePrincipalDashboard();
  const [sort, setSort] = useState<SortState>({ key: "creditsUsed", direction: "desc" });
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const sortedTeachers = useMemo(() => {
    if (!dashboard) return [];
    return [...dashboard.teachers].sort((a, b) => {
      const aValue = sortValue(a, sort.key);
      const bValue = sortValue(b, sort.key);
      let result = 0;

      if (sort.key === "lastActiveAt") {
        result = compareDates(aValue as string | null, bValue as string | null);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        result = aValue - bValue;
      } else {
        result = String(aValue).localeCompare(String(bValue));
      }

      return sort.direction === "asc" ? result : -result;
    });
  }, [dashboard, sort]);

  const selectedTeacher = useMemo(
    () => dashboard?.teachers.find((teacher) => teacher.userId === selectedTeacherId) ?? null,
    [dashboard, selectedTeacherId]
  );

  const setSortKey = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const sortLabel = (key: SortKey) => (sort.key === key ? (sort.direction === "desc" ? "down" : "up") : "");

  if (loading) return <PrincipalLoadingState />;
  if (forbidden) return <PrincipalForbiddenState />;
  if (onboardingRequired) return <PrincipalOnboardingRequiredState />;

  return (
    <div className="space-y-5 rounded-3xl bg-[var(--bg)] p-4 md:p-6">
      <PrincipalPageHeader
        eyebrow="School Analytics"
        title="Teacher Activity Analytics"
        description="Monitor generation output, credit consumption, and recent teacher activity across the school."
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {dashboard ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard title="Lessons generated" value={dashboard.overview.totalLessonsGenerated} subtitle="All-time school output" />
            <MetricCard title="Lesson slides generated" value={dashboard.overview.totalSlidesGenerated} subtitle="All-time slide decks" />
            <MetricCard title="Worksheets generated" value={dashboard.overview.totalWorksheetsGenerated} subtitle="All-time worksheets" />
            <MetricCard title="Exams generated" value={dashboard.overview.totalExamsGenerated} subtitle="All-time exams" />
            <MetricCard
              title="Credits used"
              value={dashboard.overview.totalCreditsUsed}
              subtitle={`of ${dashboard.schoolCredits.total} school credits`}
            />
            <MetricCard title="Active teachers" value={dashboard.overview.activeTeachers} subtitle="Currently active accounts" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <SectionCard title="Teacher activity table" subtitle="Click a teacher name to inspect their full generation history.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                        {[
                          ["Teacher Name", "name"],
                          ["Lessons Generated", "lessonsGenerated"],
                          ["Slides Generated", "slidesGenerated"],
                          ["Worksheets Generated", "worksheetsCreated"],
                          ["Exams Generated", "examsGenerated"],
                          ["Credits Used", "creditsUsed"],
                          ["Last Active", "lastActiveAt"],
                        ].map(([label, key]) => (
                          <th key={key} className="py-2 pr-3">
                            <button
                              type="button"
                              onClick={() => setSortKey(key as SortKey)}
                              className="font-bold text-[var(--text-tertiary)] hover:text-[#6C63FF]"
                            >
                              {label} {sortLabel(key as SortKey)}
                            </button>
                          </th>
                        ))}
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeachers.map((teacher, index) => {
                        const active = teacher.lessonsGenerated > 0;
                        return (
                          <tr
                            key={teacher.userId}
                            className={[
                              "border-b border-[var(--border)] hover:bg-violet-50/50",
                              index % 2 === 1 ? "bg-slate-50/60 dark:bg-white/[0.03]" : "",
                            ].join(" ")}
                          >
                            <td className="py-3 pr-3">
                              <button
                                type="button"
                                onClick={() => setSelectedTeacherId(teacher.userId)}
                                className="text-left font-semibold text-[#6C63FF] hover:underline"
                              >
                                {teacher.name}
                              </button>
                              <div className="text-xs text-[var(--text-tertiary)]">{teacher.email || teacher.userId}</div>
                            </td>
                            <td className="py-3 pr-3">{teacher.lessonsGenerated}</td>
                            <td className="py-3 pr-3">{teacher.slidesGenerated}</td>
                            <td className="py-3 pr-3">{teacher.worksheetsCreated}</td>
                            <td className="py-3 pr-3">{teacher.examsGenerated}</td>
                            <td className="py-3 pr-3 font-bold text-violet-700">{teacher.creditsUsed}</td>
                            <td className="py-3 pr-3 text-[var(--text-secondary)]">{timeAgo(teacher.lastActiveAt)}</td>
                            <td className="py-3">
                              <TeacherStatusBadge active={active} />
                            </td>
                          </tr>
                        );
                      })}
                      {!sortedTeachers.length ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-sm text-[var(--text-secondary)]">
                            Analytics will appear after teacher activity starts.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="Recent Activity" subtitle="Last 20 teacher generation actions across the school.">
                <div className="divide-y divide-[var(--border)]">
                  {dashboard.recentActivity.map((activity) => (
                    <div key={`${activity.type}-${activity.id}`} className="flex gap-3 py-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6C63FF] text-sm font-black text-white">
                        {initials(activity.teacherName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--text-primary)]">
                          <span className="font-bold">{activity.teacherName}</span> generated a {typeLabels[activity.type]} on{" "}
                          <span className="font-semibold">&quot;{activity.topic ?? "Untitled topic"}&quot;</span>
                          <span className="text-[var(--text-secondary)]">
                            {" "}
                            - {activity.subject ?? "Subject"} {activity.grade ?? ""} - {timeAgo(activity.createdAt)}
                          </span>
                        </p>
                      </div>
                      <span className="h-fit rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                        -{activity.creditsUsed} credits
                      </span>
                    </div>
                  ))}
                  {!dashboard.recentActivity.length ? (
                    <div className="py-6 text-center text-sm text-[var(--text-secondary)]">No recent teacher activity yet.</div>
                  ) : null}
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-4 xl:col-span-4">
              <SectionCard title="Operational Insights" subtitle="Accountability signals for principal follow-up.">
                <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                  <InsightRow
                    label="Most active teacher this week"
                    value={
                      dashboard.insights.mostActiveTeacherThisWeek
                        ? `${dashboard.insights.mostActiveTeacherThisWeek.name} (${dashboard.insights.mostActiveTeacherThisWeek.creditsUsed} credits)`
                        : "No activity this week"
                    }
                  />
                  <InsightRow
                    label="Most generated subject this week"
                    value={
                      dashboard.insights.mostGeneratedSubjectThisWeek
                        ? `${dashboard.insights.mostGeneratedSubjectThisWeek.subject} (${dashboard.insights.mostGeneratedSubjectThisWeek.count})`
                        : "No subject activity this week"
                    }
                  />
                  <InsightRow
                    label="Possible credit waste"
                    value={
                      dashboard.insights.possibleCreditWaste.length
                        ? dashboard.insights.possibleCreditWaste
                            .map((item) => `${item.teacherName}: ${item.topic} (${item.count}x)`)
                            .join("; ")
                        : "No repeated topic alert"
                    }
                    tone={dashboard.insights.possibleCreditWaste.length ? "warning" : "default"}
                  />
                  <InsightRow
                    label="Low activity alert"
                    value={
                      dashboard.insights.lowActivityTeachers.length
                        ? dashboard.insights.lowActivityTeachers.map((teacher) => teacher.name).join(", ")
                        : "No inactive joined teachers"
                    }
                    tone={dashboard.insights.lowActivityTeachers.length ? "warning" : "default"}
                  />
                  <CreditsProgress
                    used={dashboard.schoolCredits.used}
                    total={dashboard.schoolCredits.total}
                    percent={dashboard.schoolCredits.percentUsed}
                  />
                </div>
              </SectionCard>
            </aside>
          </div>
        </div>
      ) : null}

      {selectedTeacher ? <TeacherDetailModal teacher={selectedTeacher} onClose={() => setSelectedTeacherId(null)} /> : null}
    </div>
  );
}

function InsightRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div
      className={[
        "rounded-xl border px-3 py-2",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]",
      ].join(" ")}
    >
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function CreditsProgress({ used, total, percent }: { used: number; total: number; percent: number }) {
  const color = percent > 80 ? "bg-red-500" : percent >= 50 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-[var(--text-primary)]">Credits remaining</span>
        <span className="text-[var(--text-secondary)]">
          Used {used} of {total} credits ({percent}% used)
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  );
}

function TeacherDetailModal({ teacher, onClose }: { teacher: TeacherListItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)]">{teacher.name}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {teacher.email || "No email"} - Joined {formatDateOnly(teacher.joinedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)]"
            aria-label="Close teacher detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
          <MiniStat label="Lessons" value={teacher.lessonsGenerated} />
          <MiniStat label="Slides" value={teacher.slidesGenerated} />
          <MiniStat label="Worksheets" value={teacher.worksheetsCreated} />
          <MiniStat label="Exams" value={teacher.examsGenerated} />
          <MiniStat label="Credits" value={teacher.creditsUsed} />
        </div>
        <div className="max-h-[52vh] overflow-y-auto border-t border-[var(--border)] p-5">
          <div className="space-y-3">
            {teacher.generatedItems.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                <ActivityIcon type={item.type} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[var(--text-primary)]">{item.topic ?? "Untitled topic"}</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {typeLabels[item.type]} - {item.subject ?? "Subject"} {item.grade ?? ""} - {formatDateOnly(item.createdAt)}
                  </div>
                </div>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">-{item.creditsUsed}</span>
              </div>
            ))}
            {!teacher.generatedItems.length ? (
              <div className="py-8 text-center text-sm text-[var(--text-secondary)]">This teacher has not generated anything yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 text-center dark:bg-white/[0.03]">
      <div className="text-xl font-black text-[var(--text-primary)]">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div>
    </div>
  );
}
