import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableOrColumnError } from "@/lib/principal/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ENTITLEMENT_DAYS = Number(process.env.PRINCIPAL_ENTITLEMENT_DAYS ?? 30);
const DEFAULT_REMINDER_DAYS = Number(process.env.PRINCIPAL_RENEWAL_REMINDER_DAYS ?? 7);

export type PrincipalBillingState = {
  status: "active" | "inactive" | "expired";
  latestPaidAt: string | null;
  entitlementEndsAt: string | null;
  daysUntilExpiry: number | null;
  renewalRequired: boolean;
  reminderLevel: "none" | "upcoming" | "due" | "expired";
  reminderMessage: string | null;
};

type LatestPaidSubscriptionRow = {
  paid_at: string | null;
  created_at: string | null;
};

function toIso(input: string | null | undefined) {
  if (!input) return null;
  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function safeDaysUntil(endsAtIso: string | null) {
  if (!endsAtIso) return null;
  const ms = new Date(endsAtIso).getTime() - Date.now();
  return Math.ceil(ms / DAY_MS);
}

function buildReminder(state: {
  status: "active" | "inactive" | "expired";
  daysUntilExpiry: number | null;
}) {
  if (state.status === "inactive") {
    return {
      level: "due" as const,
      message: "No active school payment found. Pay manually to activate teacher slot actions.",
    };
  }

  if (state.status === "expired") {
    return {
      level: "expired" as const,
      message: "School payment has expired. Renew manually to restore paid school actions.",
    };
  }

  if (typeof state.daysUntilExpiry === "number" && state.daysUntilExpiry <= 0) {
    return {
      level: "due" as const,
      message: "School payment is due now. Renew manually to avoid restriction of paid actions.",
    };
  }

  if (
    typeof state.daysUntilExpiry === "number" &&
    state.daysUntilExpiry > 0 &&
    state.daysUntilExpiry <= DEFAULT_REMINDER_DAYS
  ) {
    return {
      level: "upcoming" as const,
      message: `Renewal reminder: ${state.daysUntilExpiry} day(s) left. Renew manually to keep paid school actions active.`,
    };
  }

  return { level: "none" as const, message: null };
}

export async function resolvePrincipalBillingState(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string
): Promise<PrincipalBillingState> {
  const latestPaidRes = await admin
    .from("subscriptions")
    .select("paid_at, created_at")
    .eq("school_id", schoolId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPaidRes.error && !isMissingTableOrColumnError(latestPaidRes.error)) {
    throw new Error(latestPaidRes.error.message);
  }

  const row = (latestPaidRes.data as LatestPaidSubscriptionRow | null) ?? null;
  const latestPaidAt = toIso(row?.paid_at ?? row?.created_at ?? null);

  if (!latestPaidAt) {
    const reminder = buildReminder({ status: "inactive", daysUntilExpiry: null });
    return {
      status: "inactive",
      latestPaidAt: null,
      entitlementEndsAt: null,
      daysUntilExpiry: null,
      renewalRequired: true,
      reminderLevel: reminder.level,
      reminderMessage: reminder.message,
    };
  }

  const entitlementEndsAt = new Date(new Date(latestPaidAt).getTime() + DEFAULT_ENTITLEMENT_DAYS * DAY_MS).toISOString();
  const daysUntilExpiry = safeDaysUntil(entitlementEndsAt);
  const status = (daysUntilExpiry ?? -1) < 0 ? "expired" : "active";
  const renewalRequired = status !== "active";
  const reminder = buildReminder({ status, daysUntilExpiry });

  return {
    status,
    latestPaidAt,
    entitlementEndsAt,
    daysUntilExpiry,
    renewalRequired,
    reminderLevel: reminder.level,
    reminderMessage: reminder.message,
  };
}

export async function ensurePrincipalBillingActive(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string
) {
  const billing = await resolvePrincipalBillingState(admin, schoolId);
  if (billing.renewalRequired) {
    return {
      ok: false as const,
      status: 402,
      error: billing.reminderMessage ?? "School payment is not active.",
      billing,
    };
  }

  return { ok: true as const, billing };
}