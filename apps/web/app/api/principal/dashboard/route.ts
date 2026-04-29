import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBearerTokenFromHeaders,
  resolveActiveSchoolCode,
  resolvePrincipalContext,
} from "@/lib/principal/server";
import { resolvePrincipalBillingState } from "@/lib/principal/billing";
import {
  DEFAULT_BILLING_CYCLE,
  DEFAULT_CURRENCY,
  DEFAULT_SLOT_PRICE,
  isMissingTableOrColumnError,
  isPrincipalRole,
  normalizeTeacherStatus,
  randomId,
  toISODateOnly,
} from "@/lib/principal/utils";
import type {
  BillingHistoryItem,
  PrincipalActivityType,
  PrincipalDashboardPayload,
  PrincipalGeneratedItem,
  TeacherListItem,
} from "@/lib/principal/types";
 
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
 
type MemberRow = {
  user_id: string;
  role: string | null;
  created_at: string | null;
  status?: string | null;
  last_active_at?: string | null;
};
 
type SubscriptionRow = {
  id: string;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  provider: string | null;
  reference: string | null;
  paid_at: string | null;
};
 
type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};
 
type ActivityRow = {
  user_id: string;
  created_at: string | null;
};

type LessonActivityRow = ActivityRow & {
  id: string;
  type?: string | null;
  subject?: string | null;
  topic?: string | null;
  grade?: string | null;
};

type WorksheetActivityRow = ActivityRow & {
  id: string;
  subject?: string | null;
  topic?: string | null;
  grade?: string | null;
};

type ExamActivityRow = ActivityRow & {
  id: string;
  subject?: string | null;
  topic_or_coverage?: string | null;
  class_or_grade?: string | null;
  exam_title?: string | null;
};

type SchoolCreditsRow = {
  shared_credits?: number | null;
  credits_used?: number | null;
} | null;
 
function buildFallbackEvents() {
  const now = new Date();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
 
  return [
    {
      id: randomId("event"),
      title: "Assessment moderation meeting",
      startsAt: new Date(now.getTime() + oneWeekMs).toISOString(),
      category: "meeting" as const,
    },
    {
      id: randomId("event"),
      title: "Mid-term progress check",
      startsAt: new Date(now.getTime() + oneWeekMs * 2).toISOString(),
      category: "deadline" as const,
    },
    {
      id: randomId("event"),
      title: "Exam preparation briefing",
      startsAt: new Date(now.getTime() + oneWeekMs * 3).toISOString(),
      category: "exam" as const,
    },
  ];
}
 
function pickLatestDate(...dates: Array<string | null | undefined>) {
  const validTimes = dates
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime())
    .filter((n) => Number.isFinite(n));
 
  if (!validTimes.length) return null;
  return new Date(Math.max(...validTimes)).toISOString();
}

function normalizeActivityType(type: string | null | undefined): PrincipalActivityType {
  const value = String(type ?? "").toLowerCase();
  if (value === "slides" || value === "lesson_slides" || value === "slide_deck") return "slides";
  if (value === "worksheet" || value === "worksheets") return "worksheet";
  if (value === "exam" || value === "exam_builder") return "exam";
  return "lesson_pack";
}

function defaultCreditsForType(type: PrincipalActivityType) {
  if (type === "lesson_pack") return 4;
  if (type === "slides") return 2;
  return 1;
}

function readCreditValue(row: Record<string, unknown>) {
  const candidates = [
    row.credits_used,
    row.credits_cost,
    row.credit_cost,
    row.credits,
    row.cost,
  ];
  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

function toDisplayText(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || null;
}
 
async function getSlotLimit(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  fallback: number
) {
  return Math.max(fallback, 1);
}
 
async function getBillingHistory(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string
): Promise<BillingHistoryItem[]> {
  const subRes = await admin
    .from("subscriptions")
    .select("id, amount, currency, status, provider, reference, paid_at, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(20);
 
  if (subRes.error && !isMissingTableOrColumnError(subRes.error)) {
    throw new Error(subRes.error.message);
  }
 
  const rows = (subRes.data ?? []) as SubscriptionRow[];
  if (!rows.length) {
    return [
      {
        id: randomId("billing"),
        amount: 0,
        currency: DEFAULT_CURRENCY,
        status: "pending",
        provider: "placeholder",
        reference: null,
        paidAt: null,
      },
    ];
  }
 
  return rows.map((r) => ({
    id: String(r.id),
    amount: Number(r.amount ?? 0),
    currency: (r.currency ?? DEFAULT_CURRENCY) as BillingHistoryItem["currency"],
    status: (r.status ?? "pending") as BillingHistoryItem["status"],
    provider: (r.provider ?? "placeholder") as BillingHistoryItem["provider"],
    reference: r.reference ?? null,
    paidAt: r.paid_at ?? null,
  }));
}
 
export async function GET(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);
 
    if (!context.ok) {
      return NextResponse.json(
        { ok: false, error: context.error },
        { status: context.status ?? 401 }
      );
    }
 
    if (context.isTeacherOnly) {
      return NextResponse.json(
        { ok: false, error: "Principal access required for this route." },
        { status: 403 }
      );
    }
 
    if (!context.school || !context.user) {
      return NextResponse.json(
        {
          ok: true,
          onboardingRequired: true,
          data: {
            principalName: null,
            schoolName: null,
            slotPrice: DEFAULT_SLOT_PRICE,
            currency: DEFAULT_CURRENCY,
          },
        },
        { status: 200 }
      );
    }
 
    const admin = createAdminClient();
    const schoolId = context.school.id;
 
    const membersRes = await admin
      .from("school_members")
      .select("user_id, role, created_at, status, last_active_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
 
    if (membersRes.error && !isMissingTableOrColumnError(membersRes.error)) {
      return NextResponse.json(
        { ok: false, error: membersRes.error.message },
        { status: 500 }
      );
    }
 
    const members = (membersRes.data ?? []) as MemberRow[];
 
    // Keep only latest membership row per teacher user_id.
    const latestTeacherMembershipByUser = new Map<string, MemberRow>();
    for (const member of members) {
      if (isPrincipalRole(member.role)) continue;
      if (member.user_id === context.user.id) continue;
      if (!latestTeacherMembershipByUser.has(member.user_id)) {
        latestTeacherMembershipByUser.set(member.user_id, member);
      }
    }
 
    const teacherMembers = Array.from(latestTeacherMembershipByUser.values());
    const teacherIds = teacherMembers.map((m) => m.user_id);
 
    const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (teacherIds.length) {
      const profileRes = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", teacherIds);
 
      if (profileRes.error && !isMissingTableOrColumnError(profileRes.error)) {
        return NextResponse.json(
          { ok: false, error: profileRes.error.message },
          { status: 500 }
        );
      }
 
      for (const row of (profileRes.data ?? []) as ProfileRow[]) {
        profileMap.set(row.id, {
          full_name: row.full_name ?? null,
          email: row.email ?? null,
        });
      }
    }
 
    const generatedItemsByTeacher = new Map<string, PrincipalGeneratedItem[]>();
    const creditsUsedFromUsageLogs = new Map<string, number>();
    const creditsUsedFromItems = new Map<string, number>();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const allGeneratedItems: PrincipalGeneratedItem[] = [];

    if (teacherIds.length) {
      const lessonRes = await admin
        .from("lessons")
        .select("id, user_id, type, subject, topic, grade, created_at")
        .in("user_id", teacherIds)
        .order("created_at", { ascending: false })
        .limit(5000);
 
      if (lessonRes.error && !isMissingTableOrColumnError(lessonRes.error)) {
        return NextResponse.json(
          { ok: false, error: lessonRes.error.message },
          { status: 500 }
        );
      }
 
      for (const row of (lessonRes.data ?? []) as LessonActivityRow[]) {
        const userId = String(row.user_id ?? "");
        if (!userId) continue;

        const type = normalizeActivityType(row.type);
        const item: PrincipalGeneratedItem = {
          id: String(row.id),
          userId,
          type,
          subject: toDisplayText(row.subject),
          topic: toDisplayText(row.topic),
          grade: toDisplayText(row.grade),
          createdAt: row.created_at ?? null,
          creditsUsed: defaultCreditsForType(type),
        };
        allGeneratedItems.push(item);
      }

      const worksheetRes = await admin
        .from("worksheets")
        .select("id, user_id, subject, topic, grade, created_at")
        .in("user_id", teacherIds)
        .order("created_at", { ascending: false })
        .limit(5000);
 
      if (worksheetRes.error && !isMissingTableOrColumnError(worksheetRes.error)) {
        return NextResponse.json(
          { ok: false, error: worksheetRes.error.message },
          { status: 500 }
        );
      }
 
      for (const row of (worksheetRes.data ?? []) as WorksheetActivityRow[]) {
        const userId = String(row.user_id ?? "");
        if (!userId) continue;

        allGeneratedItems.push({
          id: String(row.id),
          userId,
          type: "worksheet",
          subject: toDisplayText(row.subject),
          topic: toDisplayText(row.topic),
          grade: toDisplayText(row.grade),
          createdAt: row.created_at ?? null,
          creditsUsed: defaultCreditsForType("worksheet"),
        });
      }

      const examRes = await admin
        .from("exams")
        .select("id, user_id, subject, topic_or_coverage, class_or_grade, exam_title, created_at")
        .in("user_id", teacherIds)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (examRes.error && !isMissingTableOrColumnError(examRes.error)) {
        return NextResponse.json(
          { ok: false, error: examRes.error.message },
          { status: 500 }
        );
      }

      for (const row of (examRes.data ?? []) as ExamActivityRow[]) {
        const userId = String(row.user_id ?? "");
        if (!userId) continue;

        allGeneratedItems.push({
          id: String(row.id),
          userId,
          type: "exam",
          subject: toDisplayText(row.subject),
          topic: toDisplayText(row.topic_or_coverage) ?? toDisplayText(row.exam_title),
          grade: toDisplayText(row.class_or_grade),
          createdAt: row.created_at ?? null,
          creditsUsed: defaultCreditsForType("exam"),
        });
      }

      const usageLogRes = await admin
        .from("usage_logs")
        .select("*")
        .in("user_id", teacherIds)
        .limit(5000);

      if (usageLogRes.error && !isMissingTableOrColumnError(usageLogRes.error)) {
        return NextResponse.json(
          { ok: false, error: usageLogRes.error.message },
          { status: 500 }
        );
      }

      for (const row of (usageLogRes.data ?? []) as Array<Record<string, unknown>>) {
        const userId = String(row.user_id ?? "");
        if (!userId) continue;
        const creditValue = readCreditValue(row);
        if (creditValue !== null) {
          creditsUsedFromUsageLogs.set(userId, (creditsUsedFromUsageLogs.get(userId) ?? 0) + creditValue);
        }
      }
    }

    allGeneratedItems.sort((a, b) => {
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    for (const item of allGeneratedItems) {
      const current = generatedItemsByTeacher.get(item.userId) ?? [];
      current.push(item);
      generatedItemsByTeacher.set(item.userId, current);
      creditsUsedFromItems.set(item.userId, (creditsUsedFromItems.get(item.userId) ?? 0) + item.creditsUsed);
    }

    const weeklyItems = allGeneratedItems.filter((item) => {
      if (!item.createdAt) return false;
      const created = new Date(item.createdAt);
      return Number.isFinite(created.getTime()) && created >= sevenDaysAgo;
    });
 
    const teachers: TeacherListItem[] = teacherMembers.map((member) => {
      const profile = profileMap.get(member.user_id);
      const status = normalizeTeacherStatus({
        role: member.role,
        status: member.status ?? null,
      });
 
      const name = profile?.full_name || profile?.email || "Teacher";
      const generatedItems = generatedItemsByTeacher.get(member.user_id) ?? [];
      const lastGeneratedAt = generatedItems[0]?.createdAt ?? null;
      const lastActiveAt = pickLatestDate(member.last_active_at, lastGeneratedAt);
      const countType = (type: PrincipalActivityType) =>
        generatedItems.filter((item) => item.type === type).length;
 
      return {
        userId: member.user_id,
        name,
        email: profile?.email ?? null,
        role: member.role ?? null,
        status,
        lessonsGenerated: countType("lesson_pack"),
        slidesGenerated: countType("slides"),
        worksheetsCreated: countType("worksheet"),
        examsGenerated: countType("exam"),
        creditsUsed:
          creditsUsedFromUsageLogs.get(member.user_id) ??
          creditsUsedFromItems.get(member.user_id) ??
          0,
        lastActiveAt,
        joinedAt: member.created_at ?? null,
        generatedItems,
      };
    });
 
    const totalLessonsGenerated = teachers.reduce(
      (sum, t) => sum + t.lessonsGenerated,
      0
    );
    const totalSlidesGenerated = teachers.reduce((sum, t) => sum + t.slidesGenerated, 0);
    const totalWorksheetsGenerated = teachers.reduce((sum, t) => sum + t.worksheetsCreated, 0);
    const totalExamsGenerated = teachers.reduce((sum, t) => sum + t.examsGenerated, 0);
    const totalCreditsUsed = teachers.reduce((sum, t) => sum + t.creditsUsed, 0);
    const activeTeachers = teachers.filter((t) => t.lessonsGenerated > 0).length;
    const slotLimit = await getSlotLimit(admin, schoolId, Math.max(teachers.length, 1));
    const billingHistory = await getBillingHistory(admin, schoolId);
    const latestPaid = billingHistory.find((x) => x.status === "paid");
 
    const billingState = await resolvePrincipalBillingState(admin, schoolId);
    const nextBillingDate = billingState.entitlementEndsAt;
 
    const subscriptionStatus: PrincipalDashboardPayload["subscription"]["status"] =
      billingState.renewalRequired
        ? latestPaid
          ? "past_due"
          : "trialing"
        : "active";
 
    const progressBase = Math.max(slotLimit * 8, 1);
    const schemeProgressPercent = Math.max(
      5,
      Math.min(100, Math.round((totalLessonsGenerated / progressBase) * 100))
    );
    const totalMilestones = 8;
    const completedMilestones = Math.max(
      1,
      Math.min(
        totalMilestones,
        Math.round((schemeProgressPercent / 100) * totalMilestones)
      )
    );
 
    const schoolCode = await resolveActiveSchoolCode(
      schoolId,
      context.school.code ?? null
    );
 
    const { data: schoolCreditsRaw, error: schoolCreditsError } = await admin
      .from("schools")
      .select("shared_credits, credits_used")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolCreditsError && !isMissingTableOrColumnError(schoolCreditsError)) {
      return NextResponse.json(
        { ok: false, error: schoolCreditsError.message },
        { status: 500 }
      );
    }

    const schoolCreditsRow = (schoolCreditsRaw ?? null) as SchoolCreditsRow;
    const remainingSchoolCredits = Math.max(
      0,
      Number(schoolCreditsRow?.shared_credits ?? 0)
    );
    const usedSchoolCredits = Math.max(
      0,
      Number(schoolCreditsRow?.credits_used ?? 0)
    );
    const totalSchoolCredits = remainingSchoolCredits + usedSchoolCredits;
    const percentUsed =
      totalSchoolCredits > 0
        ? Math.round((usedSchoolCredits / totalSchoolCredits) * 100)
        : 0;

    const profileForItem = (userId: string) => profileMap.get(userId);
    const recentActivity = allGeneratedItems.slice(0, 20).map((item) => ({
      ...item,
      teacherName:
        profileForItem(item.userId)?.full_name ||
        profileForItem(item.userId)?.email ||
        "Teacher",
      teacherEmail: profileForItem(item.userId)?.email ?? null,
    }));

    const weeklyByTeacher = new Map<string, { generatedCount: number; creditsUsed: number }>();
    const weeklyBySubject = new Map<string, number>();
    for (const item of weeklyItems) {
      const teacherWeekly = weeklyByTeacher.get(item.userId) ?? {
        generatedCount: 0,
        creditsUsed: 0,
      };
      teacherWeekly.generatedCount += 1;
      teacherWeekly.creditsUsed += item.creditsUsed;
      weeklyByTeacher.set(item.userId, teacherWeekly);

      const subject = item.subject ?? "Unspecified";
      weeklyBySubject.set(subject, (weeklyBySubject.get(subject) ?? 0) + 1);
    }

    const mostActiveTeacherEntry = Array.from(weeklyByTeacher.entries()).sort(
      (a, b) => b[1].creditsUsed - a[1].creditsUsed || b[1].generatedCount - a[1].generatedCount
    )[0];
    const mostGeneratedSubjectEntry = Array.from(weeklyBySubject.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const wasteByTeacherTopic = new Map<string, { userId: string; topic: string; count: number }>();
    for (const item of allGeneratedItems) {
      const topic = item.topic?.trim();
      if (!topic) continue;
      const key = `${item.userId}:${topic.toLowerCase()}`;
      const existing = wasteByTeacherTopic.get(key) ?? { userId: item.userId, topic, count: 0 };
      existing.count += 1;
      wasteByTeacherTopic.set(key, existing);
    }

    const possibleCreditWaste = Array.from(wasteByTeacherTopic.values())
      .filter((item) => item.count > 3)
      .map((item) => ({
        userId: item.userId,
        teacherName:
          profileForItem(item.userId)?.full_name ||
          profileForItem(item.userId)?.email ||
          "Teacher",
        topic: item.topic,
        count: item.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const lowActivityTeachers = teachers
      .filter((teacher) => {
        if (teacher.generatedItems.length > 0 || !teacher.joinedAt) return false;
        const joined = new Date(teacher.joinedAt);
        if (!Number.isFinite(joined.getTime())) return false;
        return joined <= sevenDaysAgo;
      })
      .map((teacher) => ({
        userId: teacher.userId,
        name: teacher.name,
        email: teacher.email,
        joinedAt: teacher.joinedAt,
      }));

    const payload = {
      school: {
        id: schoolId,
        name: context.school.name ?? "Unnamed School",
        principalName:
          (context.school as { principal_name?: string | null }).principal_name ?? null,
        code: schoolCode || "N/A",
        createdAt: context.school.created_at ?? null,
      },
      overview: {
        totalTeachers: teachers.length,
        activeTeachers,
        totalLessonsGenerated,
        totalSlidesGenerated,
        totalWorksheetsGenerated,
        totalExamsGenerated,
        totalCreditsUsed,
        weeklyActivityCount: weeklyItems.length,
      },
      teachers,
      recentActivity,
      insights: {
        mostActiveTeacherThisWeek: mostActiveTeacherEntry
          ? {
              userId: mostActiveTeacherEntry[0],
              name:
                profileForItem(mostActiveTeacherEntry[0])?.full_name ||
                profileForItem(mostActiveTeacherEntry[0])?.email ||
                "Teacher",
              creditsUsed: mostActiveTeacherEntry[1].creditsUsed,
              generatedCount: mostActiveTeacherEntry[1].generatedCount,
            }
          : null,
        mostGeneratedSubjectThisWeek: mostGeneratedSubjectEntry
          ? {
              subject: mostGeneratedSubjectEntry[0],
              count: mostGeneratedSubjectEntry[1],
            }
          : null,
        possibleCreditWaste,
        lowActivityTeachers,
      },
      planning: {
        schemeProgressPercent,
        completedSchemeMilestones: completedMilestones,
        totalSchemeMilestones: totalMilestones,
        upcomingAcademicEvents: buildFallbackEvents().map((e) => ({
          ...e,
          startsAt: toISODateOnly(e.startsAt),
        })),
      },
      subscription: {
        planName: "School Workspace",
        slotLimit,
        slotPrice: DEFAULT_SLOT_PRICE,
        amountPerCycle: slotLimit * DEFAULT_SLOT_PRICE,
        currency: DEFAULT_CURRENCY,
        billingCycle: DEFAULT_BILLING_CYCLE,
        status: subscriptionStatus,
        nextBillingDate,
 
        renewalMode: "manual",
        entitlementEndsAt: billingState.entitlementEndsAt,
        daysUntilExpiry: billingState.daysUntilExpiry,
        renewalRequired: billingState.renewalRequired,
        reminderLevel: billingState.reminderLevel,
        reminderMessage: billingState.reminderMessage,
      },
      billingHistory,
      schoolCredits: {
        total: totalSchoolCredits,
        used: usedSchoolCredits,
        remaining: remainingSchoolCredits,
        percentUsed,
        isLow:
          remainingSchoolCredits <= Math.round(totalSchoolCredits * 0.1),
        isEmpty: remainingSchoolCredits <= 0,
      },
    };
 
    return NextResponse.json(
      { ok: true, onboardingRequired: false, data: payload },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to load principal dashboard";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
