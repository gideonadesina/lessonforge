/**
 * Server-side school billing configuration.
 * Single source of truth for school plan pricing and allowances.
 * Must match frontend lib/billing/pricing.ts values.
 */

export const SCHOOL_SHARED_CREDIT_COST = 1;

export type SchoolPlanId = "starter" | "growth" | "full_school" | "enterprise";

export interface SchoolPlanPricing {
  id: SchoolPlanId;
  name: string;
  priceNaira: number;
  priceUsdCents: number;
  teacherLimit: number;
  sharedCredits: number;
  lessonPacks: number;
}

export const SCHOOL_PLAN_PRICING: Record<SchoolPlanId, SchoolPlanPricing> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceNaira: 25000,
    priceUsdCents: 25000,
    teacherLimit: 15,
    sharedCredits: 120,
    lessonPacks: 30,
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceNaira: 55000,
    priceUsdCents: 55000,
    teacherLimit: 35,
    sharedCredits: 280,
    lessonPacks: 70,
  },
  full_school: {
    id: "full_school",
    name: "Full School",
    priceNaira: 95000,
    priceUsdCents: 95000,
    teacherLimit: 70,
    sharedCredits: 560,
    lessonPacks: 140,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceNaira: 0, // Custom pricing - not used for checkout
    priceUsdCents: 0, // Custom pricing - not used for checkout
    teacherLimit: 999,
    sharedCredits: 9999,
    lessonPacks: 9999,
  },
};

/**
 * Get pricing and allowances for a specific school plan.
 */
export function getSchoolPlanPricing(planId: unknown): SchoolPlanPricing | null {
  const id = String(planId ?? "").toLowerCase().trim() as SchoolPlanId;
  return SCHOOL_PLAN_PRICING[id] ?? null;
}

/**
 * Validate school plan ID
 */
export function isValidSchoolPlanId(planId: unknown): planId is SchoolPlanId {
  return Boolean(getSchoolPlanPricing(planId));
}

/**
 * Check if plan has custom pricing (non-standard checkout)
 */
export function isEnterprisePlan(planId: unknown): boolean {
  return planId === "enterprise";
}

/**
 * Convert plan price to Paystack minor units.
 * Paystack expects:
 * - NGN: kobo (multiply by 100)
 * - USD: cents (as-is)
 */
export function getSchoolPlanPaystackAmount(planId: SchoolPlanId, currency: "NGN" | "USD"): number {
  const plan = getSchoolPlanPricing(planId);
  if (!plan || planId === "enterprise") return 0; // Enterprise has custom pricing

  return currency === "NGN" ? plan.priceNaira * 100 : plan.priceUsdCents;
}

/**
 * Get shared credits allowance for a school plan.
 */
export function getSchoolPlanSharedCredits(planId: unknown): number {
  const plan = getSchoolPlanPricing(planId);
  return plan?.sharedCredits ?? 0;
}

/**
 * Get teacher limit for a school plan.
 */
export function getSchoolPlanTeacherLimit(planId: unknown): number {
  const plan = getSchoolPlanPricing(planId);
  return plan?.teacherLimit ?? 0;
}

/**
 * Monthly cycle duration in milliseconds.
 */
export const MONTHLY_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
