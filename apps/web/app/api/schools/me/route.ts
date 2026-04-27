import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function supabaseWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("Missing Supabase env vars");

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function isPrincipalRole(role: string | null | undefined) {
  return ["principal", "admin", "owner", "school_admin", "headteacher"].includes(
    String(role ?? "").toLowerCase()
  );
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Unauthorized (no token)" }, { status: 401 });
    }

    const supabase = supabaseWithToken(token);

    // 1) Verify auth user
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized (invalid token)" }, { status: 401 });
    }

    // 2) Find membership. Prefer a principal membership over a latest teacher row.
    const { data: memberships, error: memErr } = await supabase
      .from("school_members")
      .select("school_id, role, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (memErr) {
      return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 });
    }

    const membershipRows = memberships ?? [];
    const member =
      membershipRows.find((row) => isPrincipalRole(row.role)) ?? membershipRows[0] ?? null;

    const { data: ownedSchool } = await supabase
      .from("schools")
      .select("id, name, code, created_at, shared_credits, credits_used")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const effectiveSchoolId = member?.school_id ?? ownedSchool?.id ?? null;
    const effectiveRole = member?.role ?? (ownedSchool?.id ? "principal" : null);
    const joinedAt = member?.created_at ?? ownedSchool?.created_at ?? null;

    // Not in any school
    if (!effectiveSchoolId) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            user: { id: user.id, email: user.email ?? null },
            membership: null,
            school: null,
            license: null,
          },
        },
        { status: 200 }
      );
    }

    // 3) Load school
    const schoolResult = ownedSchool?.id === effectiveSchoolId
      ? { data: ownedSchool, error: null }
      : await supabase
          .from("schools")
          .select("id, name, code, created_at, shared_credits, credits_used")
          .eq("id", effectiveSchoolId)
          .single();

    const { data: school, error: schoolErr } = schoolResult;

    // If school not accessible (deleted or RLS), still return membership
    if (schoolErr || !school) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            user: { id: user.id, email: user.email ?? null },
            membership: {
              school_id: effectiveSchoolId,
              role: effectiveRole ?? "teacher",
              joined_at: joinedAt,
            },
            school: null,
            license: null,
          },
        },
        { status: 200 }
      );
    }

    // 4) Load license (from your school_licenses schema)
    const { data: licRow, error: licErr } = await supabase
      .from("school_licenses")
      .select("id, school_id, status, seats, current_period_end, created_at")
      .eq("school_id", school.id)
      .maybeSingle();

    // 5) Seats used = count of members (most reliable)
    const { count: usedCount, error: countErr } = await supabase
      .from("school_members")
      .select("user_id", { count: "exact", head: true })
      .eq("school_id", school.id);

    // If count fails due to RLS, fall back to null
    const seatsUsed = countErr ? null : usedCount ?? null;

    // Map DB license -> UI license shape expected by school/page.tsx
    const license = licErr || !licRow
      ? null
      : {
          id: licRow.id,
          school_id: licRow.school_id,
          seats_total: licRow.seats ?? null,
          seats_used: seatsUsed,
          status: licRow.status ?? null,
          expires_at: licRow.current_period_end ?? null,
          created_at: licRow.created_at ?? null,
        };

    return NextResponse.json(
      {
        ok: true,
        data: {
          user: { id: user.id, email: user.email ?? null },
          membership: {
            school_id: effectiveSchoolId,
            role: effectiveRole ?? "teacher",
            joined_at: joinedAt,
          },
          school: {
            id: school.id,
            name: school.name ?? null,
            code: (school as any).code ?? null,
            created_at: (school as any).created_at ?? null,
            shared_credits: Math.max(0, Number((school as any).shared_credits ?? 0)),
            credits_used: Math.max(0, Number((school as any).credits_used ?? 0)),
            credits_remaining: Math.max(0, Number((school as any).shared_credits ?? 0)),
          },
          license,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed" }, { status: 500 });
  }
}
