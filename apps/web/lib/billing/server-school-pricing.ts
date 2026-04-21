/**
 * Server-side school billing configuration.
 * Single source of truth for school plan pricing and allowances.
 * Must match frontend lib/billing/pricing.ts values.
 */

export const SCHOOL_SHARED_CREDIT_COST = 1;

export type SchoolPlanId =
  | "school_starter"
  | "school_growth"
  | "school_full"
  | "school_enterprise";

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
  school_starter: {
    id: "school_starter",
    name: "Starter",
    priceNaira: 35000,
    priceUsdCents: 35000,
    teacherLimit: 15,
    sharedCredits: 200,
    lessonPacks: 50,
  },
  school_growth: {
    id: "school_growth",
    name: "Growth",
    priceNaira: 75000,
    priceUsdCents: 75000,
    teacherLimit: 35,
    sharedCredits: 450,
    lessonPacks: 112,
  },
  school_full: {
    id: "school_full",
    name: "Full School",
    priceNaira: 130000,
    priceUsdCents: 130000,
    teacherLimit: 70,
    sharedCredits: 850,
    lessonPacks: 212,
  },
  school_enterprise: {
    id: "school_enterprise",
    name: "Enterprise",
    priceNaira: 200000,
    priceUsdCents: 200000,
    teacherLimit: 70,
    sharedCredits: 1200,
    lessonPacks: 300,
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
  return planId === "school_enterprise";
}

/**
 * Convert plan price to Paystack minor units.
 * Paystack expects:
 * - NGN: kobo (multiply by 100)
 * - USD: cents (as-is)
 */
export function getSchoolPlanPaystackAmount(planId: SchoolPlanId, currency: "NGN" | "USD"): number {
  const plan = getSchoolPlanPricing(planId);
  if (!plan) return 0;

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
