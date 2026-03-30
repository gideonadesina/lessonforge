/**
 * Server-side teacher billing configuration.
 * Single source of truth for pricing, credits, and allowances.
 * Must match frontend lib/billing/pricing.ts values.
 */

export const LESSON_PACK_CREDIT_COST = 4;
export const NEW_USER_FREE_CREDITS = 8;

export type TeacherPlanId = "basic" | "pro" | "pro_plus" | "ultra_pro";

export interface TeacherPlanPricing {
  id: TeacherPlanId;
  name: string;
  priceNaira: number;
  priceUsdCents: number; // In cents (e.g., 3000 = $30.00)
  credits: number;
}

export const TEACHER_PLAN_PRICING: Record<TeacherPlanId, TeacherPlanPricing> = {
  basic: {
    id: "basic",
    name: "Basic",
    priceNaira: 3000,
    priceUsdCents: 3000,
    credits: 20,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceNaira: 5000,
    priceUsdCents: 5000,
    credits: 30,
  },
  pro_plus: {
    id: "pro_plus",
    name: "Pro Plus",
    priceNaira: 7000,
    priceUsdCents: 7000,
    credits: 50,
  },
  ultra_pro: {
    id: "ultra_pro",
    name: "Ultra Pro",
    priceNaira: 15000,
    priceUsdCents: 15000,
    credits: 100,
  },
};

/**
 * Get pricing and credits for a specific plan.
 */
export function getPlanPricing(
  planId: unknown
): TeacherPlanPricing | null {
  const id = String(planId ?? "").toLowerCase().trim() as TeacherPlanId;
  return TEACHER_PLAN_PRICING[id] ?? null;
}

/**
 * Validate plan ID
 */
export function isValidTeacherPlanId(planId: unknown): planId is TeacherPlanId {
  return Boolean(getPlanPricing(planId));
}

/**
 * Get plan by amount (NGN or USD).
 * Useful for inferring tier from payment amount.
 */
export function inferPlanFromAmount(
  amountMinor: number,
  currency: "NGN" | "USD"
): TeacherPlanId | null {
  const plans = Object.values(TEACHER_PLAN_PRICING)
    .sort((a, b) => a.priceNaira - b.priceNaira);

  const priceField = currency === "NGN" ? "priceNaira" : "priceUsdCents";

  // Find the plan that matches or is closest above the amount
  for (const plan of plans) {
    if (amountMinor >= plan[priceField]) {
      // Keep checking if a higher plan matches better
      const nextPlan = plans[plans.indexOf(plan) + 1];
      if (nextPlan && amountMinor >= nextPlan[priceField]) {
        continue;
      }
      return plan.id;
    }
  }

  return null;
}

/**
 * Convert plan price to Paystack minor units.
 * Paystack expects:
 * - NGN: kobo (divide by 100)
 * - USD: cents (as-is)
 */
export function getPlanPaystackAmount(
  planId: TeacherPlanId,
  currency: "NGN" | "USD"
): number {
  const plan = getPlanPricing(planId);
  if (!plan) return 0;

  return currency === "NGN" ? plan.priceNaira * 100 : plan.priceUsdCents;
}

/**
 * Get credits allowance for a plan.
 */
export function getPlanCredits(planId: unknown): number {
  const plan = getPlanPricing(planId);
  return plan?.credits ?? 0;
}

/**
 * Monthly cycle duration in milliseconds.
 */
export const MONTHLY_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Default plan validity period in milliseconds.
 */
export const PLAN_VALIDITY_MS = MONTHLY_CYCLE_MS;
