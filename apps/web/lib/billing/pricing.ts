export const LESSON_PACK_CREDIT_COST = 4;
export const WORKSHEET_CREDIT_COST = 1;
export const EXAM_BUILDER_CREDIT_COST = 1;
export const NEW_USER_FREE_CREDITS = 8;

export type TeacherPlanId = "basic" | "pro" | "pro_plus" | "ultra_pro";
export type SchoolPlanId =
  | "school_starter"
  | "school_growth"
  | "school_full"
  | "school_enterprise";

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
    credits: 30,
    lessonPacks: 7,
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
    credits: 50,
    lessonPacks: 12,
    features: [
      "Everything in Basic",
      "Advanced templates",
      "PDF + PPT export",
    ],
    ctaLabel: "Choose Pro",
    highlighted: true,
  },
  {
    id: "pro_plus",
    name: "Pro+",
    priceNaira: 8000,
    credits: 80,
    lessonPacks: 20,
    features: [
      "Everything in Pro",
      "Custom branding",
      "Priority support",
      "Curriculum planner",
    ],
    ctaLabel: "Choose Pro+",
  },
  {
    id: "ultra_pro",
    name: "Ultra Pro",
    priceNaira: 15000,
    credits: 150,
    lessonPacks: 37,
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
    id: "school_starter",
    name: "Starter",
    priceNaira: 35000,
    credits: 200,
    lessonPacks: 50,
    features: [
      "Principal dashboard",
      "Add/remove teacher accounts",
      "Basic usage reports",
      "Credit pool management",
    ],
    ctaLabel: "Start with Starter",
  },
  {
    id: "school_growth",
    name: "Growth",
    priceNaira: 75000,
    credits: 450,
    lessonPacks: 112,
    features: [
      "Everything in Starter",
      "Department grouping",
      "Per-teacher credit limits",
      "Analytics dashboard",
    ],
    ctaLabel: "Start with Growth",
    highlighted: true,
  },
  {
    id: "school_full",
    name: "Full School",
    priceNaira: 130000,
    credits: 850,
    lessonPacks: 212,
    features: [
      "Everything in Growth",
      "Onboarding support",
      "Priority phone/WhatsApp support",
      "Curriculum-level reports",
    ],
    ctaLabel: "Start with Full School",
  },
  {
    id: "school_enterprise",
    name: "Enterprise",
    priceNaira: 200000,
    credits: 1200,
    lessonPacks: 300,
    features: [
      "Unlimited teachers",
      "White-label option",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    ctaLabel: "Start with Enterprise",
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
