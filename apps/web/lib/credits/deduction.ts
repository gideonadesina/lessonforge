/**
 * Credit deduction logic for generation actions.
 * School and personal credits are always strictly separated.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const GENERATION_CREDIT_COSTS = {
  LESSON_PACK: 4,
  SLIDES: 2,
  WORKSHEET: 1,
  EXAM_BUILDER: 1,
};

interface CreditCheckResult {
  ok: boolean;
  hasLessonPackCredits: boolean;
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
  errorCode?: "out_of_credits" | "school_out_of_credits" | "deduction_failed";
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

    // If teacher belongs to a school, only school credits are valid.
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

    const availableCredits = schoolId ? schoolBalance : personalBalance;

    return {
      ok: true,
      hasLessonPackCredits: availableCredits >= GENERATION_CREDIT_COSTS.LESSON_PACK,
      hasWorksheetCredits: availableCredits >= GENERATION_CREDIT_COSTS.WORKSHEET,
      hasExamCredits: availableCredits >= GENERATION_CREDIT_COSTS.EXAM_BUILDER,
      usesSchoolCredits: Boolean(schoolId) && usesSchoolCredits,
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

    // Deduct strictly from school credits for school users (never personal fallback).
    if (schoolId) {
      if (schoolBalance < creditCost) {
        return {
          ok: false,
          deductedFrom: "school",
          previousPersonalBalance: personalBalance,
          newPersonalBalance: personalBalance,
          previousSchoolBalance: schoolBalance,
          newSchoolBalance: schoolBalance,
          errorCode: "school_out_of_credits",
          error: "School has insufficient credits.",
        };
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data: currentSchool, error: currentSchoolError } = await admin
          .from("schools")
          .select("shared_credits")
          .eq("id", schoolId)
          .maybeSingle();

        if (currentSchoolError || !currentSchool) {
          return {
            ok: false,
            deductedFrom: "school",
            previousPersonalBalance: personalBalance,
            newPersonalBalance: personalBalance,
            previousSchoolBalance: schoolBalance,
            newSchoolBalance: schoolBalance,
            errorCode: "deduction_failed",
            error: currentSchoolError?.message ?? "School record not found.",
          };
        }

        const currentSchoolBalance = Number(currentSchool.shared_credits ?? 0);
        if (currentSchoolBalance < creditCost) {
          return {
            ok: false,
            deductedFrom: "school",
            previousPersonalBalance: personalBalance,
            newPersonalBalance: personalBalance,
            previousSchoolBalance: currentSchoolBalance,
            newSchoolBalance: currentSchoolBalance,
            errorCode: "school_out_of_credits",
            error: "School has insufficient credits.",
          };
        }

        const nextSchoolBalance = currentSchoolBalance - creditCost;
        const { data: updatedSchool, error: schoolError } = await admin
          .from("schools")
          .update({
            shared_credits: nextSchoolBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", schoolId)
          .eq("shared_credits", currentSchoolBalance)
          .select("id")
          .maybeSingle();

        if (schoolError) {
          return {
            ok: false,
            deductedFrom: "school",
            previousPersonalBalance: personalBalance,
            newPersonalBalance: personalBalance,
            previousSchoolBalance: currentSchoolBalance,
            newSchoolBalance: currentSchoolBalance,
            errorCode: "deduction_failed",
            error: schoolError.message,
          };
        }

        if (updatedSchool) {
          return {
            ok: true,
            deductedFrom: "school",
            previousPersonalBalance: personalBalance,
            newPersonalBalance: personalBalance,
            previousSchoolBalance: currentSchoolBalance,
            newSchoolBalance: nextSchoolBalance,
          };
        }
      }

      return {
        ok: false,
        deductedFrom: "school",
        previousPersonalBalance: personalBalance,
        newPersonalBalance: personalBalance,
        previousSchoolBalance: schoolBalance,
        newSchoolBalance: schoolBalance,
        errorCode: "deduction_failed",
        error: "School credit balance changed. Please retry.",
      };
    }

    // No school: deduct only from personal credits.
    if (personalBalance < creditCost) {
      return {
        ok: false,
        deductedFrom: "personal",
        previousPersonalBalance: personalBalance,
        newPersonalBalance: personalBalance,
        previousSchoolBalance: schoolBalance,
        newSchoolBalance: schoolBalance,
        errorCode: "out_of_credits",
        error: "Insufficient personal credits.",
      };
    }

    let newSchoolBalance = schoolBalance;
    let newPersonalBalance = personalBalance;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: currentProfile, error: currentProfileError } = await admin
        .from("profiles")
        .select("credits_balance")
        .eq("id", userId)
        .maybeSingle();

      if (currentProfileError || !currentProfile) {
        return {
          ok: false,
          deductedFrom: "personal",
          previousPersonalBalance: personalBalance,
          newPersonalBalance: personalBalance,
          previousSchoolBalance: schoolBalance,
          newSchoolBalance: schoolBalance,
          errorCode: "deduction_failed",
          error: currentProfileError?.message ?? "User profile not found",
        };
      }

      const currentPersonalBalance = Number(currentProfile.credits_balance ?? 0);
      if (currentPersonalBalance < creditCost) {
        return {
          ok: false,
          deductedFrom: "personal",
          previousPersonalBalance: currentPersonalBalance,
          newPersonalBalance: currentPersonalBalance,
          previousSchoolBalance: schoolBalance,
          newSchoolBalance: schoolBalance,
          errorCode: "out_of_credits",
          error: "Insufficient personal credits.",
        };
      }

      newPersonalBalance = currentPersonalBalance - creditCost;
      const { data: updatedProfile, error: personalError } = await admin
        .from("profiles")
        .update({
          credits_balance: newPersonalBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .eq("credits_balance", currentPersonalBalance)
        .select("id")
        .maybeSingle();

      if (personalError) {
        return {
          ok: false,
          deductedFrom: "personal",
          previousPersonalBalance: currentPersonalBalance,
          newPersonalBalance: currentPersonalBalance,
          previousSchoolBalance: schoolBalance,
          newSchoolBalance: schoolBalance,
          errorCode: "deduction_failed",
          error: personalError.message,
        };
      }

      if (updatedProfile) {
        return {
          ok: true,
          deductedFrom: "personal",
          previousPersonalBalance: currentPersonalBalance,
          newPersonalBalance,
          previousSchoolBalance: schoolBalance,
          newSchoolBalance,
        };
      }
    }

    return {
      ok: false,
      deductedFrom: "personal",
      previousPersonalBalance: personalBalance,
      newPersonalBalance: personalBalance,
      previousSchoolBalance: schoolBalance,
      newSchoolBalance: schoolBalance,
      errorCode: "deduction_failed",
      error: "Personal credit balance changed. Please retry.",
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
      errorCode: "deduction_failed",
      error: message,
    };
  }
}
