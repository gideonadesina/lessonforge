/**
 * Credit deduction logic for generation actions.
 * School credits are used first, then personal credits.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const GENERATION_CREDIT_COSTS = {
  LESSON_PACK: 4,
  LESSON_SLIDES: 2,
  WORKSHEET: 1,
  EXAM_BUILDER: 1,
};

interface CreditCheckResult {
  ok: boolean;
  hasLessonPackCredits: boolean;
  hasSlidesCredits: boolean;
  hasWorksheetCredits: boolean;
  hasExamCredits: boolean;
  usesSchoolCredits: boolean;
  schoolId: string | null;
  personalCreditsRemaining: number;
  schoolCreditsRemaining: number;
  error?: string;
}

interface CreditDeductionResult {
  ok: boolean;
  deductedFrom: "school" | "personal";
  previousPersonalBalance: number;
  newPersonalBalance: number;
  previousSchoolBalance: number;
  newSchoolBalance: number;
  error?: string;
}

/**
 * Check if teacher has sufficient credits for an action.
 * Returns availability for each generation type.
 */
export async function checkTeacherCredits(
  userId: string
): Promise<CreditCheckResult> {
  const admin = createAdminClient();

  try {
    // Get teacher profile with credits
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, credits_balance, school_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return {
        ok: false,
        hasLessonPackCredits: false,
        hasSlidesCredits: false,
        hasWorksheetCredits: false,
        hasExamCredits: false,
        usesSchoolCredits: false,
        schoolId: null,
        personalCreditsRemaining: 0,
        schoolCreditsRemaining: 0,
        error: "User profile not found",
      };
    }

    const personalBalance = Number(profile.credits_balance ?? 0);
    const schoolId = profile.school_id as string | null;
    let schoolBalance = 0;
    let usesSchoolCredits = false;

    // If teacher belongs to a school, check school credits
    if (schoolId) {
      const { data: school } = await admin
        .from("schools")
        .select("shared_credits")
        .eq("id", schoolId)
        .maybeSingle();

      if (school) {
        schoolBalance = Number(school.shared_credits ?? 0);
        usesSchoolCredits = true;
      }
    }

    // Combined credits: school + personal
    const totalAvailable = schoolBalance + personalBalance;

    return {
      ok: true,
      hasLessonPackCredits: totalAvailable >= GENERATION_CREDIT_COSTS.LESSON_PACK,
      hasSlidesCredits: totalAvailable >= GENERATION_CREDIT_COSTS.LESSON_SLIDES,
      hasWorksheetCredits: totalAvailable >= GENERATION_CREDIT_COSTS.WORKSHEET,
      hasExamCredits: totalAvailable >= GENERATION_CREDIT_COSTS.EXAM_BUILDER,
      usesSchoolCredits,
      schoolId,
      personalCreditsRemaining: personalBalance,
      schoolCreditsRemaining: schoolBalance,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Credit check failed";
    return {
      ok: false,
      hasLessonPackCredits: false,
      hasSlidesCredits: false,
      hasWorksheetCredits: false,
      hasExamCredits: false,
      usesSchoolCredits: false,
      schoolId: null,
      personalCreditsRemaining: 0,
      schoolCreditsRemaining: 0,
      error: message,
    };
  }
}

/**
 * Deduct credits for a generation action.
 * School credits are used first, then personal credits.
 * Atomic operation to prevent race conditions.
 */
export async function deductGenerationCredits(
  userId: string,
  creditCost: number
): Promise<CreditDeductionResult> {
  const admin = createAdminClient();

  try {
    // Get current balances
    const { data: profile } = await admin
      .from("profiles")
      .select("id, credits_balance, school_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return {
        ok: false,
        deductedFrom: "personal",
        previousPersonalBalance: 0,
        newPersonalBalance: 0,
        previousSchoolBalance: 0,
        newSchoolBalance: 0,
        error: "User profile not found",
      };
    }

    const personalBalance = Number(profile.credits_balance ?? 0);
    const schoolId = profile.school_id as string | null;
    let schoolBalance = 0;

    if (schoolId) {
      const { data: school } = await admin
        .from("schools")
        .select("shared_credits")
        .eq("id", schoolId)
        .maybeSingle();

      if (school) {
        schoolBalance = Number(school.shared_credits ?? 0);
      }
    }

    // Check if sufficient credits (school + personal)
    const totalAvailable = schoolBalance + personalBalance;
    if (totalAvailable < creditCost) {
      return {
        ok: false,
        deductedFrom: "personal",
        previousPersonalBalance: personalBalance,
        newPersonalBalance: personalBalance,
        previousSchoolBalance: schoolBalance,
        newSchoolBalance: schoolBalance,
        error: "Insufficient credits. Please purchase more credits or join a school with available credits.",
      };
    }

    // Deduct from school first, then personal
    let newSchoolBalance = schoolBalance;
    let newPersonalBalance = personalBalance;
    let deductedFrom: "school" | "personal" = "personal";

    if (schoolId && schoolBalance >= creditCost) {
      // Deduct from school
      newSchoolBalance = schoolBalance - creditCost;
      deductedFrom = "school";

      // Atomic update for school credits
      const { error: schoolError } = await admin
        .from("schools")
        .update({
          shared_credits: newSchoolBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", schoolId)
        .eq("shared_credits", schoolBalance);

      if (schoolError) {
        // Retry logic or fallback to personal credits
        return deductGenerationCredits(userId, creditCost);
      }
    } else {
      // Deduct from personal
      newPersonalBalance = personalBalance - creditCost;
      deductedFrom = "personal";

      // Atomic update for personal credits
      const { error: personalError } = await admin
        .from("profiles")
        .update({
          credits_balance: newPersonalBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .eq("credits_balance", personalBalance);

      if (personalError) {
        // Retry logic
        return deductGenerationCredits(userId, creditCost);
      }
    }

    return {
      ok: true,
      deductedFrom,
      previousPersonalBalance: personalBalance,
      newPersonalBalance,
      previousSchoolBalance: schoolBalance,
      newSchoolBalance,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Credit deduction failed";
    return {
      ok: false,
      deductedFrom: "personal",
      previousPersonalBalance: 0,
      newPersonalBalance: 0,
      previousSchoolBalance: 0,
      newSchoolBalance: 0,
      error: message,
    };
  }
}
