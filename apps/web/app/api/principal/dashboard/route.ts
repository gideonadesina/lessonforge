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
  PrincipalDashboardPayload,
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
 
async function getSlotLimit(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  fallback: number
) {
  const slotRes = await admin
    .from("teacher_slots")
    .select("slot_limit")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
 
  if (!slotRes.error && Number(slotRes.data?.slot_limit) > 0) {
    return Number(slotRes.data?.slot_limit);
  }
 
  if (slotRes.error && !isMissingTableOrColumnError(slotRes.error)) {
    throw new Error(slotRes.error.message);
  }
 
  const licenseRes = await admin
    .from("school_licenses")
    .select("seats")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
 
  if (!licenseRes.error && Number(licenseRes.data?.seats) > 0) {
    return Number(licenseRes.data?.seats);
  }
 
  if (licenseRes.error && !isMissingTableOrColumnError(licenseRes.error)) {
    throw new Error(licenseRes.error.message);
  }
 
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
 
    const lessonCount = new Map<string, number>();
    const worksheetCount = new Map<string, number>();
    const lessonLastActive = new Map<string, string | null>();
    const worksheetLastActive = new Map<string, string | null>();
 
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let weeklyLessons = 0;
    let weeklyWorksheets = 0;
 
    if (teacherIds.length) {
      const lessonRes = await admin
        .from("lessons")
        .select("user_id, created_at")
        .in("user_id", teacherIds)
        .order("created_at", { ascending: false })
        .limit(5000);
 
      if (lessonRes.error && !isMissingTableOrColumnError(lessonRes.error)) {
        return NextResponse.json(
          { ok: false, error: lessonRes.error.message },
          { status: 500 }
        );
      }
 
      for (const row of (lessonRes.data ?? []) as ActivityRow[]) {
        const userId = String(row.user_id ?? "");
        if (!userId) continue;
 
        lessonCount.set(userId, (lessonCount.get(userId) ?? 0) + 1);
 
        const createdAt = row.created_at ?? null;
        lessonLastActive.set(userId, pickLatestDate(lessonLastActive.get(userId), createdAt));
 
        if (createdAt) {
          const created = new Date(createdAt);
          if (Number.isFinite(created.getTime()) && created >= sevenDaysAgo) {
            weeklyLessons += 1;
          }
        }
      }
 
      const worksheetRes = await admin
        .from("worksheets")
        .select("user_id, created_at")
        .in("user_id", teacherIds)
        .order("created_at", { ascending: false })
        .limit(5000);
 
      if (worksheetRes.error && !isMissingTableOrColumnError(worksheetRes.error)) {
        return NextResponse.json(
          { ok: false, error: worksheetRes.error.message },
          { status: 500 }
        );
      }
 
      for (const row of (worksheetRes.data ?? []) as ActivityRow[]) {
        const userId = String(row.user_id ?? "");
        if (!userId) continue;
 
        worksheetCount.set(userId, (worksheetCount.get(userId) ?? 0) + 1);
 
        const createdAt = row.created_at ?? null;
        worksheetLastActive.set(
          userId,
          pickLatestDate(worksheetLastActive.get(userId), createdAt)
        );
 
        if (createdAt) {
          const created = new Date(createdAt);
          if (Number.isFinite(created.getTime()) && created >= sevenDaysAgo) {
            weeklyWorksheets += 1;
          }
        }
      }
    }
 
    const teachers: TeacherListItem[] = teacherMembers.map((member) => {
      const profile = profileMap.get(member.user_id);
      const status = normalizeTeacherStatus({
        role: member.role,
        status: member.status ?? null,
      });
 
      const name = profile?.full_name || profile?.email || "Teacher";
      const lastActiveAt = pickLatestDate(
        member.last_active_at,
        lessonLastActive.get(member.user_id),
        worksheetLastActive.get(member.user_id)
      );
 
      return {
        userId: member.user_id,
        name,
        email: profile?.email ?? null,
        role: member.role ?? null,
        status,
        lessonsGenerated: lessonCount.get(member.user_id) ?? 0,
        worksheetsCreated: worksheetCount.get(member.user_id) ?? 0,
        lastActiveAt,
        joinedAt: member.created_at ?? null,
      };
    });
 
    const totalLessonsGenerated = teachers.reduce(
      (sum, t) => sum + t.lessonsGenerated,
      0
    );
    const activeTeachers = teachers.filter((t) => t.status === "active").length;
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
 
    const payload: PrincipalDashboardPayload = {
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
        weeklyActivityCount: weeklyLessons + weeklyWorksheets,
      },
      teachers,
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