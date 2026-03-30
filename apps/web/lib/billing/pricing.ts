export const LESSON_PACK_CREDIT_COST = 4;
export const NEW_USER_FREE_CREDITS = 8;

export type TeacherPlanId = "basic" | "pro" | "pro_plus" | "ultra_pro";

export type TeacherPlanConfig = {
  id: TeacherPlanId;
  name: string;
  priceNaira: number;
  credits: number;
  ctaLabel: string;
  highlighted?: boolean;
};

export const TEACHER_PRICING_PLANS: TeacherPlanConfig[] = [
  {
    id: "basic",
    name: "Basic",
    priceNaira: 3000,
    credits: 20,
    ctaLabel: "Choose Basic",
  },
  {
    id: "pro",
    name: "Pro",
    priceNaira: 5000,
    credits: 30,
    ctaLabel: "Choose Pro",
    highlighted: true,
  },
  {
    id: "pro_plus",
    name: "Pro Plus",
    priceNaira: 7000,
    credits: 50,
    ctaLabel: "Choose Pro Plus",
  },
  {
    id: "ultra_pro",
    name: "Ultra Pro",
    priceNaira: 15000,
    credits: 100,
    ctaLabel: "Choose Ultra Pro",
  },
];

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function estimateLessonPacks(credits: number): number {
  return Math.floor(credits / LESSON_PACK_CREDIT_COST);
}
