export const LESSON_PACK_CREDIT_COST = 4;
export const WORKSHEET_CREDIT_COST = 1;
export const EXAM_BUILDER_CREDIT_COST = 1;
export const NEW_USER_FREE_CREDITS = 8;

export type TeacherPlanId = "basic" | "pro" | "pro_plus" | "ultra_pro";
export type SchoolPlanId = "starter" | "growth" | "full_school" | "enterprise";

export type TeacherPlanConfig = {
  id: TeacherPlanId;
  name: string;
  priceNaira: number;
  credits: number;
  lessonPacks: number;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
};

export type SchoolPlanConfig = {
  id: SchoolPlanId;
  name: string;
  priceNaira: number | string;
  teachers: number | string;
  credits: number | string;
  lessonPacks: number | string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
  customPricing?: boolean;
};

export const TEACHER_PRICING_PLANS: TeacherPlanConfig[] = [
  {
    id: "basic",
    name: "Basic",
    priceNaira: 3000,
    credits: 20,
    lessonPacks: 5,
    features: [
      "Lesson plan + notes",
      "Slides + images",
      "Standard templates",
    ],
    ctaLabel: "Choose Basic",
  },
  {
    id: "pro",
    name: "Pro",
    priceNaira: 5000,
    credits: 32,
    lessonPacks: 8,
    features: [
      "Everything in Basic",
      "Advanced templates",
      "PDF + PPT export",
      "2-month credit rollover",
    ],
    ctaLabel: "Choose Pro",
    highlighted: true,
  },
  {
    id: "pro_plus",
    name: "Pro+",
    priceNaira: 8000,
    credits: 52,
    lessonPacks: 13,
    features: [
      "Everything in Pro",
      "Custom branding",
      "Priority support",
      "3-month credit rollover",
      "Curriculum planner",
    ],
    ctaLabel: "Choose Pro+",
  },
  {
    id: "ultra_pro",
    name: "Ultra Pro",
    priceNaira: 15000,
    credits: 100,
    lessonPacks: 25,
    features: [
      "Everything in Pro+",
      "Bulk pack generation",
      "Team sharing (up to 3)",
      "Dedicated support",
      "Early feature access",
    ],
    ctaLabel: "Choose Ultra Pro",
  },
];

export const SCHOOL_PRICING_PLANS: SchoolPlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
    priceNaira: 25000,
    teachers: 15,
    credits: 120,
    lessonPacks: 30,
    features: [
      "Principal dashboard",
      "Add/remove teacher accounts",
      "Basic usage reports",
      "Credit pool management",
      "Unused credits expire monthly",
    ],
    ctaLabel: "Start with Starter",
  },
  {
    id: "growth",
    name: "Growth",
    priceNaira: 55000,
    teachers: 35,
    credits: 280,
    lessonPacks: 70,
    features: [
      "Everything in Starter",
      "Department grouping",
      "Per-teacher credit limits",
      "2-month rollover",
      "Analytics dashboard",
    ],
    ctaLabel: "Start with Growth",
    highlighted: true,
  },
  {
    id: "full_school",
    name: "Full School",
    priceNaira: 95000,
    teachers: 70,
    credits: 560,
    lessonPacks: 140,
    features: [
      "Everything in Growth",
      "3-month credit rollover",
      "Onboarding support",
      "Priority phone/WhatsApp support",
      "Curriculum-level reports",
    ],
    ctaLabel: "Start with Full School",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceNaira: "Custom",
    teachers: "70+",
    credits: "Custom",
    lessonPacks: "Custom",
    features: [
      "Unlimited teachers",
      "White-label option",
      "Annual billing option",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    ctaLabel: "Contact sales",
    customPricing: true,
  },
];

export function formatNaira(amount: number | string): string {
  if (typeof amount === "string") return amount;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function estimateLessonPacks(credits: number): number {
  return Math.floor(credits / LESSON_PACK_CREDIT_COST);
}

export function getCreditUsageNote(): string {
  return `Lesson Pack = ${LESSON_PACK_CREDIT_COST} credits • Worksheet = ${WORKSHEET_CREDIT_COST} credit • Exam Builder = ${EXAM_BUILDER_CREDIT_COST} credit`;
}
