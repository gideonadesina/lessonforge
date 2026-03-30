import type { TeacherPlanId } from "@/lib/billing/pricing";

export function getTeacherCheckoutPath(planId: TeacherPlanId): string {
  return `/checkout/teacher?plan=${encodeURIComponent(planId)}`;
}

export async function initializeTeacherCheckout(planId: TeacherPlanId): Promise<{
  redirectTo: string;
}> {
  // TODO: Replace placeholder redirect with backend checkout init call
  // (e.g., POST /api/paystack/initialize or a dedicated /api/checkout/init endpoint).
  return { redirectTo: getTeacherCheckoutPath(planId) };
}
