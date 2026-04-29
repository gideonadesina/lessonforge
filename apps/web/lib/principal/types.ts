export type PrincipalRole = "principal" | "admin" | "owner" | "school_admin" | "headteacher";

export type TeacherStatus = "active" | "pending" | "disabled" | "removed";

export type TeacherAction = "disable" | "remove" | "activate";

export type PrincipalOverview = {
  totalTeachers: number;
  activeTeachers: number;
  totalLessonsGenerated: number;
  totalSlidesGenerated: number;
  totalWorksheetsGenerated: number;
  totalExamsGenerated: number;
  totalCreditsUsed: number;
  weeklyActivityCount: number;
};

export type PrincipalActivityType = "lesson_pack" | "slides" | "worksheet" | "exam";

export type PrincipalGeneratedItem = {
  id: string;
  userId: string;
  type: PrincipalActivityType;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  createdAt: string | null;
  creditsUsed: number;
};

export type TeacherListItem = {
  userId: string;
  name: string;
  email: string | null;
  role: string | null;
  status: TeacherStatus;
  lessonsGenerated: number;
  slidesGenerated: number;
  worksheetsCreated: number;
  examsGenerated: number;
  creditsUsed: number;
  lastActiveAt: string | null;
  joinedAt: string | null;
  generatedItems: PrincipalGeneratedItem[];
};

export type PrincipalActivityFeedItem = PrincipalGeneratedItem & {
  teacherName: string;
  teacherEmail: string | null;
};

export type PrincipalOperationalInsights = {
  mostActiveTeacherThisWeek: {
    userId: string;
    name: string;
    creditsUsed: number;
    generatedCount: number;
  } | null;
  mostGeneratedSubjectThisWeek: {
    subject: string;
    count: number;
  } | null;
  possibleCreditWaste: Array<{
    userId: string;
    teacherName: string;
    topic: string;
    count: number;
  }>;
  lowActivityTeachers: Array<{
    userId: string;
    name: string;
    email: string | null;
    joinedAt: string | null;
  }>;
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
  renewalMode: "manual";
  status: "active" | "past_due" | "canceled" | "trialing";
  nextBillingDate: string | null;
  entitlementEndsAt: string | null;
  daysUntilExpiry: number | null;
  renewalRequired: boolean;
  reminderLevel: "none" | "upcoming" | "due" | "expired";
  reminderMessage: string | null;
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
  recentActivity: PrincipalActivityFeedItem[];
  insights: PrincipalOperationalInsights;
  planning: PlanningOverview;
  subscription: SubscriptionSnapshot;
  billingHistory: BillingHistoryItem[];
};
