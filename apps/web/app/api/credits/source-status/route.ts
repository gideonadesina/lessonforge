import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authClientFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
}

export async function GET(req: NextRequest) {
  const authClient = authClientFromRequest(req);
  if (!authClient) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("school_id, credits_balance")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: profileError?.message ?? "Profile not found" },
      { status: 500 }
    );
  }

  const profileRow = profile as { school_id?: string | null; credits_balance?: number | null };
  const schoolId = typeof profileRow.school_id === "string" ? profileRow.school_id : null;
  let schoolCredits = 0;

  if (schoolId) {
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("shared_credits")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolError) {
      return NextResponse.json({ error: schoolError.message }, { status: 500 });
    }

    schoolCredits = Math.max(
      0,
      Number((school as { shared_credits?: number | null } | null)?.shared_credits ?? 0)
    );
  }

  return NextResponse.json({
    hasSchool: Boolean(schoolId),
    schoolId,
    schoolCredits,
    personalCredits: Math.max(0, Number(profileRow.credits_balance ?? 0)),
  });
}
