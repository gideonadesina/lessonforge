"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditSource = "school" | "personal";

export type CreditAvailabilityResult =
  | { ok: true; source: CreditSource; schoolId: string | null; creditsRemaining: number }
  | { ok: false; error: string; errorCode: "profile_not_found" | "credit_check_failed" };

  export async function consumePersonalCreditsDirectly(
  supabase: SupabaseClient,
  userId: string,
  cost: number
): Promise<ConsumeGenerationCreditResult> {
  const availability = await readCreditAvailability(supabase, userId);
  if (!availability.ok) {
    return {
      ok: false,
      source: null,
      errorCode: "deduction_failed",
      error: availability.error,
    };
  }

  if (availability.source === "school" && availability.creditsRemaining >= cost) {
    return consumeGenerationCredits(supabase, userId, cost);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();

    const currentBalance = Math.max(
      0,
      Number((profile as any)?.credits_balance ?? 0)
    );

    if (currentBalance < cost) {
      return {
        ok: false,
        source: "personal",
        errorCode: "out_of_credits",
        error: "Not enough personal credits.",
      };
    }

    const nextBalance = currentBalance - cost;
    const { data: updated } = await supabase
      .from("profiles")
      .update({
        credits_balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("credits_balance", currentBalance)
      .select("id")
      .maybeSingle();

    if (updated) {
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
    error: "Credit deduction failed. Please retry.",
  };
}

export type ConsumeGenerationCreditResult =
  | { ok: true; source: CreditSource; schoolId: string | null; creditsRemaining: number }
  | {
      ok: false;
      error: string;
      errorCode: "out_of_credits" | "school_out_of_credits" | "deduction_failed" | "needs_personal_confirmation";
      source: CreditSource | null;
      personalCreditsAvailable?: number;
    };

type ProfileCreditsRow = {
  school_id?: string | null;
  credits_balance?: number | null;
} | null;

type SchoolMemberCreditsRow = {
  school_id?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type OwnedSchoolCreditsRow = {
  id?: string | null;
} | null;

type SchoolCreditsRow = {
  shared_credits?: number | null;
  credits_used?: number | null;
} | null;

function isInactiveSchoolMember(row: SchoolMemberCreditsRow) {
  const role = String(row.role ?? "").toLowerCase();
  const status = String(row.status ?? "").toLowerCase();
  return (
    role === "removed_teacher" ||
    role === "disabled_teacher" ||
    status === "removed" ||
    status === "disabled"
  );
}

async function readEffectiveSchoolId(
  supabase: SupabaseClient,
  userId: string,
  profileSchoolId: string | null
) {
  if (profileSchoolId) return profileSchoolId;

  const { data: memberships, error: membershipError } = await supabase
    .from("school_members")
    .select("school_id, role, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (membershipError) {
    return { error: membershipError.message, schoolId: null };
  }

  const activeMembership = ((memberships ?? []) as SchoolMemberCreditsRow[]).find(
    (row) => typeof row.school_id === "string" && !isInactiveSchoolMember(row)
  );

  if (activeMembership?.school_id) {
    return activeMembership.school_id;
  }

  const { data: ownedSchool, error: ownedSchoolError } = await supabase
    .from("schools")
    .select("id")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ownedSchoolError) {
    return { error: ownedSchoolError.message, schoolId: null };
  }

  const ownedSchoolRow = (ownedSchool ?? null) as OwnedSchoolCreditsRow;
  return typeof ownedSchoolRow?.id === "string" ? ownedSchoolRow.id : null;
}

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

  const profileSchoolId = typeof profileRow.school_id === "string" ? profileRow.school_id : null;
  const effectiveSchoolId = await readEffectiveSchoolId(supabase, userId, profileSchoolId);
  if (typeof effectiveSchoolId === "object" && effectiveSchoolId?.error) {
    return { ok: false, error: `Credit check failed: ${effectiveSchoolId.error}`, errorCode: "credit_check_failed" };
  }

  const schoolId = typeof effectiveSchoolId === "string" ? effectiveSchoolId : null;
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
      // School credits exhausted — check personal credits
      const { data: profileData } = await supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", userId)
        .maybeSingle();

      const personalBalance = Math.max(
        0,
        Number((profileData as any)?.credits_balance ?? 0)
      );

      if (personalBalance < cost) {
        return {
          ok: false,
          source: "school",
          errorCode: "school_out_of_credits",
          error: "Your school has used all its credits and you have no personal credits.",
        };
      }

      // Personal credits available — return confirmation request
      return {
        ok: false,
        source: "school",
        errorCode: "needs_personal_confirmation",
        error: "Your school has run out of credits. Use personal credits?",
        personalCreditsAvailable: personalBalance,
      };
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: school, error: schoolReadError } = await supabase
        .from("schools")
        .select("shared_credits, credits_used")
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

      const schoolRow = school as SchoolCreditsRow | null;
      const currentSchoolCredits = Math.max(0, Number(schoolRow?.shared_credits ?? 0));
      const currentCreditsUsed = Math.max(0, Number(schoolRow?.credits_used ?? 0));
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
          credits_used: currentCreditsUsed + cost,
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
