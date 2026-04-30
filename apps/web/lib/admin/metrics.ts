import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const ADMIN_USER_ID = "a6ec2b75-6f89-4368-bb24-f010b459799d";
const NA = "Not available yet";

export type MetricValue = number | string | null;

export type AdminStat = {
  label: string;
  value: MetricValue;
  tone?: "green" | "yellow" | "red" | "neutral";
  note?: string;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolName: string;
  schoolCode: string;
  creditType: string;
  currentCreditBalance: MetricValue;
  totalGenerations: number;
  paidOrFree: "Paid" | "Free";
  totalAmountPaid: number;
  signupDate: string | null;
  lastActiveDate: string | null;
  status: "Active" | "Idle" | "Churned" | "Unknown";
};

export type AdminPaymentRow = {
  userName: string;
  email: string;
  plan: string;
  amount: number;
  currency: string;
  date: string | null;
  reference: string;
  source: string;
};

export type AdminSchoolRow = {
  schoolName: string;
  schoolCode: string;
  principalName: string;
  principalEmail: string;
  teacherCount: MetricValue;
  schoolCreditBalance: MetricValue;
  totalGenerations: MetricValue;
  planPurchased: string;
  createdAt: string | null;
};

export type AdminDashboardData = {
  lastUpdated: string;
  intelligence: {
    tone: "green" | "yellow" | "red" | "neutral";
    message: string;
  };
  stats: AdminStat[];
  users: AdminUserRow[];
  payments: AdminPaymentRow[];
  revenueBySchool: Array<{ name: string; revenue: number }>;
  revenueByTeacher: Array<{ name: string; email: string; revenue: number }>;
  revenueTrend: Array<{ label: string; revenue: number }>;
  generation: {
    lessons: number;
    slides: number;
    worksheets: number;
    total: number;
    topTeachers: Array<{ name: string; email: string; total: number }>;
    topTopics: Array<{ topic: string; count: number }> | null;
    neverGenerated: AdminUserRow[];
    trend: Array<{ label: string; total: number }>;
  };
  credits: {
    schoolCreditUsers: number;
    personalCreditUsers: number;
    usersWithCredits: number;
    zeroCreditUsers: number;
    lowCreditUsers: number;
    ranOutNotRecharged: number;
    rows: AdminUserRow[];
  };
  newUsers: AdminUserRow[];
  support: {
    stored: false;
    message: string;
  };
  schools: AdminSchoolRow[];
  progress: {
    userGrowthRate: string;
    revenueGrowthRate: string;
    bestPerformingSchool: string;
    mostActiveTeacher: string;
    biggestChurnRisk: string;
    churnRisks: Array<{ name: string; email: string; credits: number; lastGenerationDate: string | null }>;
    trend: string;
    recommendation: string;
  };
  unavailable: string[];
  sourceTables: Array<{ section: string; tables: string[] }>;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  app_role?: string | null;
  role?: string | null;
  school_id?: string | null;
  credits?: number | null;
  credits_balance?: number | null;
  plan?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SchoolRow = {
  id: string;
  name?: string | null;
  code?: string | null;
  license_code?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  principal_name?: string | null;
  shared_credits?: number | null;
  credits_used?: number | null;
  plan?: string | null;
  plan_type?: string | null;
};

type SchoolMemberRow = {
  school_id?: string | null;
  user_id?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type SchoolCodeRow = {
  school_id?: string | null;
  code?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type LessonRow = {
  id: string;
  user_id?: string | null;
  topic?: string | null;
  type?: string | null;
  created_at?: string | null;
};

type WorksheetRow = {
  id: string;
  user_id?: string | null;
  topic?: string | null;
  created_at?: string | null;
};

type PaymentRow = {
  reference?: string | null;
  user_id?: string | null;
  school_id?: string | null;
  plan?: string | null;
  amount?: number | null;
  currency?: string | null;
  processed?: boolean | null;
  status?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
  paystack_email?: string | null;
  is_test?: boolean | null;
  mode?: string | null;
  environment?: string | null;
  channel?: string | null;
  provider_payload?: unknown;
};

type AuthUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  appRole: string | null;
  appRoles: string[];
  createdAt: string | null;
  updatedAt: string | null;
  lastSignInAt: string | null;
};

type RoleRow = {
  user_id?: string | null;
  profile_id?: string | null;
  id?: string | null;
  role?: string | null;
  name?: string | null;
  app_role?: string | null;
};

type SubscriptionRow = {
  reference?: string | null;
  user_id?: string | null;
  school_id?: string | null;
  plan?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

type ExamRow = {
  id: string;
  user_id?: string | null;
  topic_or_coverage?: string | null;
  exam_title?: string | null;
  created_at?: string | null;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function asDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function moneyFromMinorUnits(amount: number | null | undefined) {
  const value = Number(amount ?? 0);
  return Number.isFinite(value) ? value / 100 : 0;
}

function inRange(value: string | null | undefined, start: Date, end = new Date()) {
  const date = asDate(value);
  return Boolean(date && date >= start && date <= end);
}

function pct(current: number, previous: number) {
  if (previous <= 0 && current > 0) return "+100%";
  if (previous <= 0) return "0%";
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = (getKey(row) ?? "").trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function dedupePayments(rows: PaymentRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const reference = String(row.reference ?? "").trim();
    if (!reference) return false;
    if (seen.has(reference)) return false;
    seen.add(reference);
    return row.processed === true || String(row.status ?? "").toLowerCase() === "success";
  });
}

async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no cookie writes during admin render
        },
      },
    }
  );
}

export async function getAdminSessionUserId() {
  const supabase = await createServerSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function metadataRoles(metadata: Record<string, unknown>) {
  const roles = new Set<string>();
  const appRole = metadataString(metadata, "app_role");
  if (appRole) roles.add(appRole);
  const appRoles = Array.isArray(metadata.app_roles) ? metadata.app_roles : [];
  for (const role of appRoles) {
    if (typeof role === "string") roles.add(role);
  }
  return [...roles];
}

async function listAuthUsers() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return new Map<string, AuthUserRow>();
    return new Map(
      (data.users ?? []).map((user) => {
        const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
        const authRow: AuthUserRow = {
          id: user.id,
          email: user.email ?? null,
          fullName: metadataString(metadata, "full_name") ?? metadataString(metadata, "name"),
          appRole: metadataString(metadata, "app_role"),
          appRoles: metadataRoles(metadata),
          createdAt: user.created_at ?? null,
          updatedAt: user.updated_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
        };
        return [user.id, authRow];
      })
    );
  } catch {
    return new Map<string, AuthUserRow>();
  }
}

async function safeSelect<T>(table: string, select: string, orderColumn?: string) {
  try {
    let query = createAdminClient().from(table).select(select).limit(5000);
    if (orderColumn) query = query.order(orderColumn, { ascending: false });
    const { data, error } = await query;
    if (error) {
      console.warn(`[admin] ${table} unavailable:`, error.message);
      return [] as T[];
    }
    return (data ?? []) as T[];
  } catch (error) {
    console.warn(`[admin] ${table} unavailable:`, error);
    return [] as T[];
  }
}

async function safeSelectFirst<T>(table: string, selects: string[], orderColumn?: string) {
  for (const select of selects) {
    const rows = await safeSelect<T>(table, select, orderColumn);
    if (rows.length > 0) return rows;
  }
  return [] as T[];
}

function profileCredits(profile: ProfileRow) {
  return Number(profile.credits ?? profile.credits_balance ?? 0);
}

function isPrincipalRole(role: string | null | undefined) {
  return ["principal", "admin", "owner", "school_admin", "headteacher"].includes(String(role ?? "").toLowerCase());
}

function isTeacherMembership(member: SchoolMemberRow) {
  const role = String(member.role ?? "").toLowerCase();
  const status = String(member.status ?? "").toLowerCase();
  if (isPrincipalRole(role)) return false;
  if (status === "removed" || status === "disabled" || role === "removed_teacher" || role === "disabled_teacher") return false;
  return Boolean(member.user_id && member.school_id);
}

function normalizeRoleClaim(role: string | null | undefined) {
  const value = String(role ?? "").toLowerCase();
  if (value === "teacher" || value.includes("teacher")) return "teacher";
  if (isPrincipalRole(value) || value.includes("principal")) return "principal";
  return null;
}

function roleUserId(row: RoleRow) {
  return row.user_id ?? row.profile_id ?? row.id ?? null;
}

function roleValue(row: RoleRow) {
  return row.role ?? row.app_role ?? row.name ?? null;
}

function hasTestReference(reference: string) {
  const value = reference.trim().toLowerCase();
  return value.includes("test") || value.startsWith("t") || value.startsWith("demo") || value.startsWith("sandbox");
}

function isRealPayment(row: PaymentRow) {
  const isTest = row.is_test;
  if (isTest === false) return true;
  if (isTest === true) return false;

  const mode = String(row.mode ?? row.environment ?? row.channel ?? "").trim().toLowerCase();
  if (["live", "production", "prod"].includes(mode)) return true;
  if (["test", "sandbox", "development", "dev", "staging"].includes(mode)) return false;

  const payloadText =
    row.provider_payload && typeof row.provider_payload === "object"
      ? JSON.stringify(row.provider_payload).toLowerCase()
      : String(row.provider_payload ?? "").toLowerCase();
  if (payloadText.includes('"mode":"live"') || payloadText.includes('"environment":"live"')) return true;
  if (payloadText.includes("test") || payloadText.includes("sandbox")) return false;

  return !hasTestReference(String(row.reference ?? ""));
}

function isLikelyTestSchool(school: SchoolRow) {
  const value = [school.name, school.code, school.license_code, school.principal_name].join(" ").toLowerCase();
  return /\b(test|dummy|demo|sample|sandbox)\b/.test(value);
}

function resolveProfileName(profile: ProfileRow | undefined, userId?: string | null) {
  const fallback = userId ? `User ${userId.slice(0, 8)}` : "Not available yet";
  return profile?.full_name || profile?.email?.split("@")[0] || profile?.email || fallback;
}

function resolveProfileEmail(profile: ProfileRow | undefined, userId?: string | null) {
  return profile?.email || (userId ? `No email on profile (${userId.slice(0, 8)})` : "Not available yet");
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    profiles,
    schools,
    schoolMembers,
    schoolCodes,
    lessons,
    worksheets,
    exams,
    teacherPaymentsRaw,
    schoolPaymentsRaw,
    subscriptionsRaw,
    userRoles,
    roles,
    authUsers,
  ] = await Promise.all([
    safeSelectFirst<ProfileRow>(
      "profiles",
      [
        "id, full_name, email, role, app_role, credits, credits_balance, school_id, plan, created_at, updated_at",
        "id, full_name, email, role, app_role, credits_balance, school_id, plan, created_at, updated_at",
        "id, full_name, email, role, school_id, credits_balance, created_at, updated_at",
      ],
      "created_at"
    ),
    safeSelectFirst<SchoolRow>(
      "schools",
      [
        "id, name, code, license_code, created_at, created_by, principal_name, shared_credits, credits_used, plan, plan_type",
        "id, name, code, created_at, created_by, principal_name, shared_credits, credits_used, plan, plan_type",
        "id, name, code, created_at, created_by, shared_credits, credits_used",
        "id, name, created_at, created_by",
      ],
      "created_at"
    ),
    safeSelectFirst<SchoolMemberRow>(
      "school_members",
      [
        "school_id, user_id, role, status, created_at",
        "school_id, user_id, role, created_at",
        "school_id, user_id, role",
      ]
    ),
    safeSelectFirst<SchoolCodeRow>(
      "school_codes",
      ["school_id, code, is_active, created_at", "school_id, code, created_at", "school_id, code"]
    ),
    safeSelectFirst<LessonRow>(
      "lessons",
      ["id, user_id, topic, type, created_at", "id, user_id, topic, created_at", "id, user_id, created_at"],
      "created_at"
    ),
    safeSelectFirst<WorksheetRow>(
      "worksheets",
      ["id, user_id, topic, created_at", "id, user_id, created_at"],
      "created_at"
    ),
    safeSelectFirst<ExamRow>(
      "exams",
      ["id, user_id, topic_or_coverage, exam_title, created_at", "id, user_id, created_at"],
      "created_at"
    ),
    safeSelectFirst<PaymentRow>(
      "teacher_payment_transactions",
      [
        "reference, user_id, plan, amount, currency, processed, status, created_at, processed_at, paystack_email, is_test, mode, environment, channel, provider_payload",
        "reference, user_id, plan, amount, currency, processed, status, created_at, processed_at, paystack_email, provider_payload",
        "reference, user_id, plan, amount, currency, processed, status, created_at, processed_at, paystack_email",
      ],
      "created_at"
    ),
    safeSelectFirst<PaymentRow>(
      "school_payment_transactions",
      [
        "reference, user_id, school_id, plan, amount, currency, processed, status, created_at, processed_at, paystack_email, is_test, mode, environment, channel, provider_payload",
        "reference, user_id, school_id, plan, amount, currency, processed, status, created_at, processed_at, paystack_email, provider_payload",
        "reference, user_id, school_id, plan, amount, currency, processed, status, created_at, processed_at, paystack_email",
      ],
      "created_at"
    ),
    safeSelectFirst<SubscriptionRow>(
      "subscriptions",
      [
        "reference, user_id, school_id, plan, amount, currency, status, paid_at, created_at",
        "reference, school_id, amount, currency, status, paid_at, created_at",
        "school_id, amount, currency, status, paid_at, created_at",
      ],
      "created_at"
    ),
    safeSelectFirst<RoleRow>(
      "user_roles",
      ["user_id, role", "profile_id, role", "id, role"],
    ),
    safeSelectFirst<RoleRow>(
      "roles",
      ["user_id, role", "user_id, name", "profile_id, role", "id, role"],
    ),
    listAuthUsers(),
  ]);

  const now = new Date();
  const weekStart = daysAgo(7);
  const prevWeekStart = daysAgo(14);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const profilesById = new Map<string, ProfileRow>();
  for (const profile of profiles) {
    profilesById.set(profile.id, profile);
  }
  for (const authUser of authUsers.values()) {
    if (profilesById.has(authUser.id)) continue;
    profilesById.set(authUser.id, {
      id: authUser.id,
      full_name: authUser.fullName,
      email: authUser.email,
      app_role: authUser.appRole,
      created_at: authUser.createdAt,
      updated_at: authUser.updatedAt,
    });
  }
  const referencedUserIds = new Set<string>();
  for (const member of schoolMembers) if (member.user_id) referencedUserIds.add(member.user_id);
  for (const row of [...lessons, ...worksheets, ...exams]) if (row.user_id) referencedUserIds.add(row.user_id);
  for (const payment of [...teacherPaymentsRaw, ...schoolPaymentsRaw]) if (payment.user_id) referencedUserIds.add(payment.user_id);
  for (const userId of referencedUserIds) {
    if (profilesById.has(userId)) continue;
    profilesById.set(userId, { id: userId });
  }
  const allProfiles = [...profilesById.values()];
  const schoolsById = new Map(schools.map((school) => [school.id, school]));
  const roleClaimsByUser = new Map<string, Set<string>>();
  function addRoleClaim(userId: string | null | undefined, role: string | null | undefined) {
    if (!userId) return;
    const normalized = normalizeRoleClaim(role);
    if (!normalized) return;
    const claims = roleClaimsByUser.get(userId) ?? new Set<string>();
    claims.add(normalized);
    roleClaimsByUser.set(userId, claims);
  }
  for (const profile of allProfiles) {
    addRoleClaim(profile.id, profile.role);
    addRoleClaim(profile.id, profile.app_role);
  }
  for (const authUser of authUsers.values()) {
    addRoleClaim(authUser.id, authUser.appRole);
    for (const role of authUser.appRoles) addRoleClaim(authUser.id, role);
  }
  for (const row of [...userRoles, ...roles]) {
    addRoleClaim(roleUserId(row), roleValue(row));
  }
  const activeCodes = new Map<string, string>();
  for (const code of schoolCodes) {
    if (!code.school_id || !code.code) continue;
    if (code.is_active === false && activeCodes.has(code.school_id)) continue;
    if (!activeCodes.has(code.school_id)) activeCodes.set(code.school_id, code.code);
  }

  const teacherPayments = dedupePayments(teacherPaymentsRaw);
  const schoolPayments = dedupePayments(schoolPaymentsRaw);
  const subscriptionPayments: PaymentRow[] = subscriptionsRaw
    .filter((row) => ["paid", "success", "active"].includes(String(row.status ?? "").toLowerCase()))
    .map((row, index) => ({
      reference: row.reference || `subscription-${row.school_id ?? row.user_id ?? index}-${row.created_at ?? row.paid_at ?? index}`,
      user_id: row.user_id,
      school_id: row.school_id,
      plan: row.plan,
      amount: Number(row.amount ?? 0) * 100,
      currency: row.currency,
      processed: true,
      status: "success",
      created_at: row.created_at,
      processed_at: row.paid_at ?? row.created_at,
    }));
  const allPaymentsIncludingTest = dedupePayments([...teacherPayments, ...schoolPayments, ...subscriptionPayments]);
  const realTeacherPayments = teacherPayments.filter(isRealPayment);
  const realSchoolPayments = dedupePayments([...schoolPayments.filter(isRealPayment), ...subscriptionPayments.filter(isRealPayment)]);
  const allPayments = dedupePayments([...realTeacherPayments, ...realSchoolPayments]);
  const totalRevenueIncludingTest = allPaymentsIncludingTest.reduce((sum, row) => sum + moneyFromMinorUnits(row.amount), 0);
  const totalRevenue = allPayments.reduce((sum, row) => sum + moneyFromMinorUnits(row.amount), 0);
  const revenueMonth = allPayments
    .filter((row) => inRange(row.processed_at ?? row.created_at, monthStart))
    .reduce((sum, row) => sum + moneyFromMinorUnits(row.amount), 0);
  const revenueWeek = allPayments
    .filter((row) => inRange(row.processed_at ?? row.created_at, weekStart))
    .reduce((sum, row) => sum + moneyFromMinorUnits(row.amount), 0);
  const revenuePrevWeek = allPayments
    .filter((row) => {
      const date = asDate(row.processed_at ?? row.created_at);
      return Boolean(date && date >= prevWeekStart && date < weekStart);
    })
    .reduce((sum, row) => sum + moneyFromMinorUnits(row.amount), 0);

  const lessonOnly = lessons.filter((row) => String(row.type ?? "lesson") !== "slides");
  const slidesOnly = lessons.filter((row) => String(row.type ?? "") === "slides");
  const generationRows = [
    ...lessonOnly.map((row) => ({ userId: row.user_id, topic: row.topic, createdAt: row.created_at, kind: "lesson" })),
    ...slidesOnly.map((row) => ({ userId: row.user_id, topic: row.topic, createdAt: row.created_at, kind: "slides" })),
    ...worksheets.map((row) => ({ userId: row.user_id, topic: row.topic, createdAt: row.created_at, kind: "worksheet" })),
    ...exams.map((row) => ({
      userId: row.user_id,
      topic: row.topic_or_coverage ?? row.exam_title,
      createdAt: row.created_at,
      kind: "exam",
    })),
  ];
  for (const row of generationRows) {
    addRoleClaim(row.userId, "teacher");
  }
  const generationCountByUser = countBy(generationRows, (row) => row.userId);
  const latestGenerationByUser = new Map<string, string | null>();
  for (const row of generationRows) {
    if (!row.userId || !row.createdAt) continue;
    const current = latestGenerationByUser.get(row.userId);
    if (!current || new Date(row.createdAt) > new Date(current)) {
      latestGenerationByUser.set(row.userId, row.createdAt);
    }
  }

  const amountPaidByUser = new Map<string, number>();
  for (const payment of realTeacherPayments) {
    if (!payment.user_id) continue;
    addRoleClaim(payment.user_id, "teacher");
    amountPaidByUser.set(payment.user_id, (amountPaidByUser.get(payment.user_id) ?? 0) + moneyFromMinorUnits(payment.amount));
  }
  for (const payment of realSchoolPayments) {
    const ownerId = payment.user_id || (payment.school_id ? schoolsById.get(payment.school_id)?.created_by : null);
    if (!ownerId) continue;
    addRoleClaim(ownerId, "principal");
    amountPaidByUser.set(ownerId, (amountPaidByUser.get(ownerId) ?? 0) + moneyFromMinorUnits(payment.amount));
  }

  const memberSchoolsByUser = new Map<string, string>();
  for (const member of schoolMembers) {
    if (!member.user_id || !member.school_id) continue;
    if (String(member.status ?? "").toLowerCase() === "disabled") continue;
    if (!memberSchoolsByUser.has(member.user_id)) memberSchoolsByUser.set(member.user_id, member.school_id);
  }

  function resolveRole(profile: ProfileRow) {
    const roles = new Set<string>();
    const claims = roleClaimsByUser.get(profile.id);
    for (const claim of claims ?? []) roles.add(claim);
    const memberships = schoolMembers.filter((member) => member.user_id === profile.id);
    if (memberships.some((member) => isPrincipalRole(member.role))) roles.add("principal");
    if (memberships.some(isTeacherMembership)) roles.add("teacher");
    if (schools.some((school) => school.created_by === profile.id)) roles.add("principal");
    if (roles.has("teacher") && roles.has("principal")) return "both";
    if (roles.has("principal")) return "principal";
    if (roles.has("teacher")) return "teacher";
    return "unknown";
  }

  function resolveStatus(profile: ProfileRow): AdminUserRow["status"] {
    const authUser = authUsers.get(profile.id);
    const lastActivity =
      latestGenerationByUser.get(profile.id) ||
      authUser?.lastSignInAt ||
      profile.updated_at ||
      authUser?.updatedAt ||
      profile.created_at ||
      authUser?.createdAt;
    const date = asDate(lastActivity);
    if (!date) return "Unknown";
    if (date >= daysAgo(14)) return "Active";
    if (date >= daysAgo(30)) return "Idle";
    return "Churned";
  }

  const users: AdminUserRow[] = allProfiles.map((profile) => {
    const schoolId = profile.school_id || memberSchoolsByUser.get(profile.id) || "";
    const school = schoolId ? schoolsById.get(schoolId) : null;
    const principalSchool = schools.find((item) => item.created_by === profile.id);
    const effectiveSchool = school ?? principalSchool ?? null;
    const schoolCode =
      (principalSchool?.id ? activeCodes.get(principalSchool.id) : "") ||
      (school?.id ? activeCodes.get(school.id) : "") ||
      principalSchool?.code ||
      principalSchool?.license_code ||
      school?.code ||
      school?.license_code ||
      "";
    const schoolCredits = effectiveSchool ? Number(effectiveSchool.shared_credits ?? 0) : null;
    const personalCredits = profileCredits(profile);
    const totalGenerations = generationCountByUser.get(profile.id) ?? 0;
    const authUser = authUsers.get(profile.id);
    const lastActiveDate = latestGenerationByUser.get(profile.id) || authUser?.lastSignInAt || profile.updated_at || authUser?.updatedAt || null;
    return {
      id: profile.id,
      name: resolveProfileName(profile, profile.id),
      email: resolveProfileEmail(profile, profile.id),
      role: resolveRole(profile),
      schoolName: effectiveSchool?.name || NA,
      schoolCode: schoolCode || NA,
      creditType: effectiveSchool ? "School Credits" : personalCredits > 0 ? "Personal Credits" : "None",
      currentCreditBalance: effectiveSchool ? schoolCredits : personalCredits,
      totalGenerations,
      paidOrFree: (amountPaidByUser.get(profile.id) ?? 0) > 0 ? "Paid" : "Free",
      totalAmountPaid: amountPaidByUser.get(profile.id) ?? 0,
      signupDate: profile.created_at ?? authUser?.createdAt ?? null,
      lastActiveDate,
      status: resolveStatus(profile),
    };
  });

  const totalTeachers = users.filter((user) => user.role === "teacher" || user.role === "both").length;
  const totalPrincipals = users.filter((user) => user.role === "principal" || user.role === "both").length;
  const newUsersWeek = users.filter((user) => inRange(user.signupDate, weekStart)).length;
  const newUsersPrevWeek = users.filter((user) => {
    const date = asDate(user.signupDate);
    return Boolean(date && date >= prevWeekStart && date < weekStart);
  }).length;
  const zeroCreditUsers = users.filter((user) => Number(user.currentCreditBalance ?? -1) === 0).length;
  const lowCreditUsers = users.filter((user) => {
    const balance = Number(user.currentCreditBalance ?? NaN);
    return Number.isFinite(balance) && balance > 0 && balance <= 5;
  }).length;
  const ranOutNotRecharged = users.filter((user) => Number(user.currentCreditBalance ?? -1) === 0 && user.paidOrFree === "Paid").length;
  const signedUpNoGeneration = users.filter((user) => user.totalGenerations === 0);
  const revenueUp = revenueWeek > revenuePrevWeek;

  let intelligence: AdminDashboardData["intelligence"] = {
    tone: "neutral",
    message: "Admin intelligence is partially available — some metrics need more tracking data.",
  };
  if (newUsersWeek === 0) {
    intelligence = { tone: "red", message: "No new signups in the last 7 days." };
  } else if (revenueWeek < revenuePrevWeek) {
    intelligence = { tone: "red", message: "Revenue this week is lower than last week." };
  } else if (ranOutNotRecharged > 0) {
    intelligence = {
      tone: "yellow",
      message: `${ranOutNotRecharged} teachers have run out of credits and haven’t recharged — possible churn risk.`,
    };
  } else if (newUsersWeek > 0 && signedUpNoGeneration.length >= Math.max(3, Math.ceil(newUsersWeek / 2))) {
    intelligence = { tone: "yellow", message: "Users are signing up but not generating — possible onboarding issue." };
  } else if (newUsersWeek > 0 && revenueUp) {
    intelligence = { tone: "green", message: `LessonForge is growing — ${newUsersWeek} new users this week and revenue is up.` };
  }

  const payments: AdminPaymentRow[] = allPayments
    .sort((a, b) => Number(asDate(b.processed_at ?? b.created_at)?.getTime() ?? 0) - Number(asDate(a.processed_at ?? a.created_at)?.getTime() ?? 0))
    .map((payment) => {
      const resolvedUserId = payment.user_id || (payment.school_id ? schoolsById.get(payment.school_id)?.created_by : null);
      const profile = resolvedUserId ? profilesById.get(resolvedUserId) : null;
      return {
        userName: resolveProfileName(profile ?? undefined, resolvedUserId),
        email: profile?.email || payment.paystack_email || "Not available yet",
        plan: payment.plan || "Not available yet",
        amount: moneyFromMinorUnits(payment.amount),
        currency: payment.currency || "NGN",
        date: payment.processed_at ?? payment.created_at ?? null,
        reference: payment.reference || "Not available yet",
        source: payment.school_id ? "School" : "Teacher",
      };
    });

  const revenueByTeacher = [...realTeacherPayments.reduce((map, payment) => {
    if (!payment.user_id) return map;
    map.set(payment.user_id, (map.get(payment.user_id) ?? 0) + moneyFromMinorUnits(payment.amount));
    return map;
  }, new Map<string, number>()).entries()]
    .map(([userId, revenue]) => {
      const profile = profilesById.get(userId);
      return {
        name: resolveProfileName(profile, userId),
        email: resolveProfileEmail(profile, userId),
        revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const revenueBySchool = [...realSchoolPayments.reduce((map, payment) => {
    const key = payment.school_id || payment.user_id || "unknown";
    map.set(key, (map.get(key) ?? 0) + moneyFromMinorUnits(payment.amount));
    return map;
  }, new Map<string, number>()).entries()]
    .map(([key, revenue]) => {
      const school = schoolsById.get(key) || schools.find((item) => item.created_by === key);
      return {
        name: school?.name || "Not available yet",
        revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  function trendByWeek<T>(rows: T[], dateGetter: (row: T) => string | null | undefined, valueGetter: (row: T) => number) {
    const buckets = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const start = startOfDay(daysAgo(i * 7));
      const label = `${start.getMonth() + 1}/${start.getDate()}`;
      buckets.set(label, 0);
    }
    const labels = [...buckets.keys()];
    for (const row of rows) {
      const date = asDate(dateGetter(row));
      if (!date || date < daysAgo(42)) continue;
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
      const bucketIndex = Math.min(5, Math.max(0, 5 - Math.floor(diffDays / 7)));
      const label = labels[bucketIndex];
      buckets.set(label, (buckets.get(label) ?? 0) + valueGetter(row));
    }
    return labels.map((label) => ({ label, revenue: buckets.get(label) ?? 0 }));
  }

  const revenueTrend = trendByWeek(allPayments, (row) => row.processed_at ?? row.created_at, (row) => moneyFromMinorUnits(row.amount));
  const generationTrend = trendByWeek(generationRows, (row) => row.createdAt, () => 1).map((row) => ({
    label: row.label,
    total: row.revenue,
  }));
  const topicCounts = [...countBy(generationRows, (row) => row.topic).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));
  const topTeachers = [...generationCountByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, total]) => {
      const profile = profilesById.get(userId);
      return {
        name: resolveProfileName(profile, userId),
        email: resolveProfileEmail(profile, userId),
        total,
      };
    });

  const schoolGenerations = new Map<string, number>();
  for (const user of users) {
    const profile = allProfiles.find((item) => item.id === user.id);
    const schoolId = profile?.school_id || memberSchoolsByUser.get(user.id) || schools.find((school) => school.created_by === user.id)?.id || "";
    if (!schoolId) continue;
    schoolGenerations.set(schoolId, (schoolGenerations.get(schoolId) ?? 0) + user.totalGenerations);
  }
  const teacherCountBySchool = countBy(
    schoolMembers.filter(isTeacherMembership),
    (member) => member.school_id
  );
  const memberCountBySchool = countBy(
    schoolMembers.filter((member) => !["disabled", "removed"].includes(String(member.status ?? "").toLowerCase())),
    (member) => member.school_id
  );

  const activeSchoolIds = new Set(
    schools
      .filter((school) => !isLikelyTestSchool(school))
      .filter((school) => (memberCountBySchool.get(school.id) ?? 0) > 0 || (schoolGenerations.get(school.id) ?? 0) > 0)
      .map((school) => school.id)
  );
  const principalBySchool = new Map<string, ProfileRow>();
  for (const member of schoolMembers) {
    if (!member.school_id || !member.user_id || !isPrincipalRole(member.role)) continue;
    const profile = profilesById.get(member.user_id);
    if (profile && !principalBySchool.has(member.school_id)) {
      principalBySchool.set(member.school_id, profile);
    }
  }

  const schoolRows: AdminSchoolRow[] = schools.map((school) => {
    const principal = (school.created_by ? profilesById.get(school.created_by) : null) ?? principalBySchool.get(school.id) ?? null;
    return {
      schoolName: school.name || NA,
      schoolCode: activeCodes.get(school.id) || school.code || school.license_code || NA,
      principalName: school.principal_name || principal?.full_name || NA,
      principalEmail: principal?.email || NA,
      teacherCount: teacherCountBySchool.get(school.id) ?? 0,
      schoolCreditBalance: Number(school.shared_credits ?? 0),
      totalGenerations: schoolGenerations.get(school.id) ?? 0,
      planPurchased: school.plan_type || school.plan || NA,
      createdAt: school.created_at ?? null,
    };
  });
  const activeSchoolRows = schoolRows.filter((_, index) => activeSchoolIds.has(schools[index]?.id));

  const bestSchool = activeSchoolRows
    .filter((school) => typeof school.totalGenerations === "number")
    .sort((a, b) => Number(b.totalGenerations) - Number(a.totalGenerations))[0];
  const biggestChurnRisk = users
    .filter((user) => user.status === "Churned" || Number(user.currentCreditBalance ?? -1) === 0)
    .sort((a, b) => b.totalGenerations - a.totalGenerations)[0];
  const churnRiskUsers = users
    .filter((user) => {
      const profile = profilesById.get(user.id);
      const latestGeneration = latestGenerationByUser.get(user.id);
      const latestGenerationDate = asDate(latestGeneration);
      return profileCredits(profile ?? { id: user.id }) === 0 && Boolean(latestGenerationDate && latestGenerationDate < daysAgo(14));
    })
    .sort((a, b) => Number(asDate(a.lastActiveDate)?.getTime() ?? 0) - Number(asDate(b.lastActiveDate)?.getTime() ?? 0));
  const biggestResolvedChurnRisk = churnRiskUsers[0] ?? biggestChurnRisk;
  const activeTrend =
    newUsersWeek > newUsersPrevWeek && revenueWeek >= revenuePrevWeek
      ? "Trending upward"
      : newUsersWeek < newUsersPrevWeek || revenueWeek < revenuePrevWeek
      ? "Trending downward"
      : "Flat";

  return {
    lastUpdated: now.toISOString(),
    intelligence,
    stats: [
      { label: "Total users all time", value: users.length },
      { label: "New users this week", value: newUsersWeek },
      { label: "Real revenue all time", value: totalRevenue, note: "Live payments only; test references excluded" },
      { label: "Revenue including test", value: totalRevenueIncludingTest, note: "Successful processed payments before test filtering" },
      { label: "Revenue this month", value: revenueMonth },
      { label: "Revenue this week", value: revenueWeek, tone: revenueWeek >= revenuePrevWeek ? "green" : "red" },
      { label: "Total lessons generated all time", value: lessonOnly.length },
      { label: "Total slides generated all time", value: slidesOnly.length },
      { label: "Total worksheets generated all time", value: worksheets.length },
      { label: "Total generations overall", value: generationRows.length },
      { label: "Total active schools", value: activeSchoolRows.length, note: "At least one member or generation; test/dummy schools excluded" },
      { label: "Total teachers", value: totalTeachers },
      { label: "Total principals", value: totalPrincipals },
    ],
    users,
    payments,
    revenueBySchool,
    revenueByTeacher,
    revenueTrend,
    generation: {
      lessons: lessonOnly.length,
      slides: slidesOnly.length,
      worksheets: worksheets.length,
      total: generationRows.length,
      topTeachers,
      topTopics: topicCounts.length ? topicCounts : null,
      neverGenerated: signedUpNoGeneration,
      trend: generationTrend,
    },
    credits: {
      schoolCreditUsers: users.filter((user) => user.creditType === "School Credits").length,
      personalCreditUsers: users.filter((user) => user.creditType === "Personal Credits").length,
      usersWithCredits: users.filter((user) => Number(user.currentCreditBalance ?? 0) > 0).length,
      zeroCreditUsers,
      lowCreditUsers,
      ranOutNotRecharged,
      rows: users.filter((user) => user.creditType !== "Unknown"),
    },
    newUsers: [...users].sort((a, b) => Number(asDate(b.signupDate)?.getTime() ?? 0) - Number(asDate(a.signupDate)?.getTime() ?? 0)).slice(0, 20),
    support: {
      stored: false,
      message: "Support requests are currently sent to support@lessonforge.app only. Database inbox is not enabled yet.",
    },
    schools: activeSchoolRows,
    progress: {
      userGrowthRate: pct(newUsersWeek, newUsersPrevWeek),
      revenueGrowthRate: pct(revenueWeek, revenuePrevWeek),
      bestPerformingSchool: bestSchool?.schoolName ?? NA,
      mostActiveTeacher: topTeachers[0] ? `${topTeachers[0].name} (${topTeachers[0].total})` : NA,
      biggestChurnRisk: biggestResolvedChurnRisk ? `${biggestResolvedChurnRisk.name} (${biggestResolvedChurnRisk.email})` : NA,
      churnRisks: churnRiskUsers.map((user) => ({
        name: user.name,
        email: user.email,
        credits: profileCredits(profilesById.get(user.id) ?? { id: user.id }),
        lastGenerationDate: latestGenerationByUser.get(user.id) ?? null,
      })),
      trend: activeTrend,
      recommendation:
        ranOutNotRecharged > 0
          ? `${ranOutNotRecharged} teachers ran out of credits — send a recharge reminder email.`
          : signedUpNoGeneration.length > 0
          ? `${signedUpNoGeneration.length} users have never generated anything — improve onboarding prompts.`
          : "Keep monitoring weekly revenue and generation volume.",
    },
    unavailable: [
      "Support inbox storage",
      "Exact credit consumption rate over time",
      "Last active date is approximate when auth last sign-in is unavailable",
      "Churn status is approximate from generation/login timestamps",
    ],
    sourceTables: [
      { section: "Users, teachers, principals, credits, churn risk", tables: ["profiles", "auth.users", "user_roles", "roles", "school_members", "schools", "lessons", "worksheets", "exams"] },
      { section: "Revenue and payments", tables: ["teacher_payment_transactions", "school_payment_transactions", "subscriptions", "profiles", "schools"] },
      { section: "Generation analytics", tables: ["lessons", "worksheets", "exams", "profiles"] },
      { section: "Schools", tables: ["schools", "school_members", "school_codes", "profiles", "lessons", "worksheets"] },
      { section: "Last active approximation", tables: ["auth.users", "profiles", "lessons", "worksheets"] },
    ],
  };
}
