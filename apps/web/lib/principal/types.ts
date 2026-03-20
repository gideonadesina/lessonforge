export type PrincipalRole = "principal" | "admin" | "owner" | "school_admin" | "headteacher";

export type TeacherStatus = "active" | "pending" | "disabled" | "removed";

export type TeacherAction = "disable" | "remove" | "activate";

export type PrincipalOverview = {
  totalTeachers: number;
  activeTeachers: number;
  totalLessonsGenerated: number;
  weeklyActivityCount: number;
};

export type TeacherListItem = {
  userId: string;
  name: string;
  email: string | null;
  role: string | null;
  status: TeacherStatus;
  lessonsGenerated: number;
  worksheetsCreated: number;
  lastActiveAt: string | null;
  joinedAt: string | null;
};

export type PlanningOverview = {
  schemeProgressPercent: number;
  completedSchemeMilestones: number;
  totalSchemeMilestones: number;
  upcomingAcademicEvents: Array<{
    id: string;
    title: string;
    startsAt: string;
    category: "exam" | "meeting" | "deadline" | "holiday" | "other";
  }>;
};

export type SubscriptionSnapshot = {
  planName: string;
  slotLimit: number;
  slotPrice: number;
  amountPerCycle: number;
  currency: "NGN" | "USD";
  billingCycle: "monthly" | "yearly";
  status: "active" | "past_due" | "canceled" | "trialing";
  nextBillingDate: string | null;
};

export type BillingHistoryItem = {
  id: string;
  amount: number;
  currency: "NGN" | "USD";
  status: "paid" | "pending" | "failed" | "refunded";
  provider: "placeholder" | "paystack" | "stripe";
  reference: string | null;
  paidAt: string | null;
};

export type PrincipalDashboardPayload = {
  school: {
    id: string;
    name: string;
    principalName: string | null;
    code: string;
    createdAt: string | null;
  };
  overview: PrincipalOverview;
  teachers: TeacherListItem[];
  planning: PlanningOverview;
  subscription: SubscriptionSnapshot;
  billingHistory: BillingHistoryItem[];
};