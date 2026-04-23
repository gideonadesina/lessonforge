"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditSource = "school" | "personal";

export type CreditAvailabilityResult =
  | { ok: true; source: CreditSource; schoolId: string | null; creditsRemaining: number }
  | { ok: false; error: string; errorCode: "profile_not_found" | "credit_check_failed" };

export type ConsumeGenerationCreditResult =
  | { ok: true; source: CreditSource; schoolId: string | null; creditsRemaining: number }
  | {
      ok: false;
      error: string;
      errorCode: "out_of_credits" | "school_out_of_credits" | "deduction_failed";
      source: CreditSource | null;
    };

type ProfileCreditsRow = {
  school_id?: string | null;
  credits_balance?: number | null;
} | null;

type SchoolCreditsRow = {
  shared_credits?: number | null;
} | null;

async function readCreditAvailability(
  supabase: SupabaseClient,
  userId: string
): Promise<CreditAvailabilityResult> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id, credits_balance")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: `Credit check failed: ${profileError.message}`, errorCode: "credit_check_failed" };
  }

  const profileRow = (profile ?? null) as ProfileCreditsRow;
  if (!profileRow) {
    return { ok: false, error: "User profile not found", errorCode: "profile_not_found" };
  }

  const schoolId = typeof profileRow.school_id === "string" ? profileRow.school_id : null;
  if (schoolId) {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("shared_credits")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolError) {
      return { ok: false, error: `Credit check failed: ${schoolError.message}`, errorCode: "credit_check_failed" };
    }

    const schoolRow = (school ?? null) as SchoolCreditsRow;
    const schoolCredits = Math.max(0, Number(schoolRow?.shared_credits ?? 0));
    return { ok: true, source: "school", schoolId, creditsRemaining: schoolCredits };
  }

  const personalCredits = Math.max(0, Number(profileRow.credits_balance ?? 0));
  return { ok: true, source: "personal", schoolId: null, creditsRemaining: personalCredits };
}

export async function getGenerationCreditAvailability(
  supabase: SupabaseClient,
  userId: string
): Promise<CreditAvailabilityResult> {
  return readCreditAvailability(supabase, userId);
}

export async function consumeGenerationCredits(
  supabase: SupabaseClient,
  userId: string,
  cost: number
): Promise<ConsumeGenerationCreditResult> {
  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: true, source: "personal", schoolId: null, creditsRemaining: 0 };
  }

  const availability = await readCreditAvailability(supabase, userId);
  if (!availability.ok) {
    return {
      ok: false,
      source: null,
      errorCode: "deduction_failed",
      error: availability.error,
    };
  }

  if (availability.source === "school") {
    if (availability.creditsRemaining < cost) {
      return {
        ok: false,
        source: "school",
        errorCode: "school_out_of_credits",
        error: "Your school has used all its credits.",
      };
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: school, error: schoolReadError } = await supabase
        .from("schools")
        .select("shared_credits")
        .eq("id", availability.schoolId)
        .maybeSingle();

      if (schoolReadError || !school) {
        return {
          ok: false,
          source: "school",
          errorCode: "deduction_failed",
          error: `Credit deduction failed: ${schoolReadError?.message ?? "School not found"}`,
        };
      }

      const currentSchoolCredits = Math.max(0, Number((school as SchoolCreditsRow).shared_credits ?? 0));
      if (currentSchoolCredits < cost) {
        return {
          ok: false,
          source: "school",
          errorCode: "school_out_of_credits",
          error: "Your school has used all its credits.",
        };
      }

      const nextSchoolCredits = currentSchoolCredits - cost;
      const { data: updatedSchool, error: schoolUpdateError } = await supabase
        .from("schools")
        .update({
          shared_credits: nextSchoolCredits,
          updated_at: new Date().toISOString(),
        })
        .eq("id", availability.schoolId)
        .eq("shared_credits", currentSchoolCredits)
        .select("id")
        .maybeSingle();

      if (schoolUpdateError) {
        return {
          ok: false,
          source: "school",
          errorCode: "deduction_failed",
          error: `Credit deduction failed: ${schoolUpdateError.message}`,
        };
      }

      if (updatedSchool) {
        return {
          ok: true,
          source: "school",
          schoolId: availability.schoolId,
          creditsRemaining: nextSchoolCredits,
        };
      }
    }

    return {
      ok: false,
      source: "school",
      errorCode: "deduction_failed",
      error: "Credit deduction failed: school credits changed. Please retry.",
    };
  }

  if (availability.creditsRemaining < cost) {
    return {
      ok: false,
      source: "personal",
      errorCode: "out_of_credits",
      error: "You have used all your credits.",
    };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: profile, error: profileReadError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();

    if (profileReadError || !profile) {
      return {
        ok: false,
        source: "personal",
        errorCode: "deduction_failed",
        error: `Credit deduction failed: ${profileReadError?.message ?? "User profile not found"}`,
      };
    }

    const currentBalance = Math.max(0, Number((profile as ProfileCreditsRow)?.credits_balance ?? 0));
    if (currentBalance < cost) {
      return {
        ok: false,
        source: "personal",
        errorCode: "out_of_credits",
        error: "You have used all your credits.",
      };
    }

    const nextBalance = currentBalance - cost;
    const { data: updatedProfile, error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        credits_balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("credits_balance", currentBalance)
      .select("id")
      .maybeSingle();

    if (profileUpdateError) {
      return {
        ok: false,
        source: "personal",
        errorCode: "deduction_failed",
        error: `Credit deduction failed: ${profileUpdateError.message}`,
      };
    }

    if (updatedProfile) {
      return {
        ok: true,
        source: "personal",
        schoolId: null,
        creditsRemaining: nextBalance,
      };
    }
  }

  return {
    ok: false,
    source: "personal",
    errorCode: "deduction_failed",
    error: "Credit deduction failed: balance changed. Please retry.",
  };
}

export async function consumeGenerationCredit(
  supabase: SupabaseClient,
  userId: string
): Promise<ConsumeGenerationCreditResult> {
  return consumeGenerationCredits(supabase, userId, 1);
}

// Backward-compatible aliases for routes that use descriptive names.
export const consumeCreditSafely = consumeGenerationCredit;
export const consumeGenerationCreditWithFallback = consumeGenerationCredit;