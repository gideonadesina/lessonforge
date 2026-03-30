import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { TeacherPlanId } from "@/lib/billing/pricing";

export function getTeacherCheckoutPath(planId: TeacherPlanId): string {
  return `/checkout/teacher?plan=${encodeURIComponent(planId)}`;
}

export async function initializeTeacherCheckout(planId: TeacherPlanId) {
  const supabase = createBrowserSupabase();

  // 🔥 Get current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("User not authenticated");
  }

  const res = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`, // 🔥 CRITICAL
    },
    body: JSON.stringify({ plan: planId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to initialize payment");
  }

  // 🚀 Redirect to Paystack
  window.location.href = data.authorization_url;
}