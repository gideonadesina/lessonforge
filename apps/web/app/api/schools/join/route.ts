import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePrincipalBillingActive } from "@/lib/principal/billing";
import { isMissingTableOrColumnError, isPrincipalRole } from "@/lib/principal/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SchoolRow = {
  id: string;
  name: string | null;
  code: string | null;
  created_at: string | null;
  max_seats?: number | null;
};

type MembershipRow = {
  role: string | null;
  created_at?: string | null;
  joined_at?: string | null;
};


function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function supabaseWithToken(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    
    const admin = createAdminClient();
    const supabase = supabaseWithToken(token);

    // verify user from token
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    // body
    const body = await req.json().catch(() => null);
    const code = String(body?.code ?? "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ ok: false, error: "School code is required" }, { status: 400 });
    }
     // find school by active code (new model)
    const codeRes = await admin
      .from("school_codes")
      .select("school_id, code")
      .eq("code", code)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (codeRes.error && !isMissingTableOrColumnError(codeRes.error)) {
      return NextResponse.json({ ok: false, error: codeRes.error.message }, { status: 500 });
    }

    const schoolIdFromCode = codeRes.data?.school_id ?? null;

    // fallback to legacy schools.code
    const schoolQuery = admin
  
      .from("schools")
      .select("id, name, code, created_at")
      .eq(schoolIdFromCode ? "id" : "code", schoolIdFromCode || code)
      .maybeSingle();
        const { data: school, error: schoolErr } = await schoolQuery;
      
    if (schoolErr || !school) {
      return NextResponse.json({ ok: false, error: "Invalid school code" }, { status: 404 });
    }
    const typedSchool = school as SchoolRow;
    const billingGuard = await ensurePrincipalBillingActive(admin, typedSchool.id);
    if (!billingGuard.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "This school workspace needs manual renewal before new teachers can join.",
          detail: billingGuard.error,
        },
        { status: billingGuard.status }
      );
    }
      // if already a member of this school, return success immediately
    const existingMembership = await admin
      .from("school_members")
      .select("role, created_at, joined_at")
      .eq("school_id", school.id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (existingMembership.error && !isMissingTableOrColumnError(existingMembership.error)) {
      return NextResponse.json({ ok: false, error: existingMembership.error.message }, { status: 500 });
    }

    if (existingMembership.data) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            school,
            membership: {
              role: (existingMembership.data as MembershipRow).role ?? "teacher",
              joined_at:
                (existingMembership.data as MembershipRow).created_at ??
                (existingMembership.data as MembershipRow).joined_at ??
                null,
            },
          },
        },
        { status: 200 }
      );
    }

    // resolve slot limit from teacher_slots, fallback to school_licenses.seats and schools.max_seats
    let slotLimit: number | null = null;

    const slotRes = await admin
      .from("teacher_slots")
      .select("slot_limit")
      .eq("school_id", typedSchool.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (slotRes.error && !isMissingTableOrColumnError(slotRes.error)) {
      return NextResponse.json({ ok: false, error: slotRes.error.message }, { status: 500 });
    }
    if (!slotRes.error && Number(slotRes.data?.slot_limit) > 0) {
      slotLimit = Number(slotRes.data?.slot_limit);
    }

    if (slotLimit == null) {
      const licenseRes = await admin
        .from("school_licenses")
        .select("seats")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (licenseRes.error && !isMissingTableOrColumnError(licenseRes.error)) {
        return NextResponse.json({ ok: false, error: licenseRes.error.message }, { status: 500 });
      }
      if (!licenseRes.error && Number(licenseRes.data?.seats) > 0) {
        slotLimit = Number(licenseRes.data?.seats);
      }
    }

    if (slotLimit == null) {
      const schoolsMaxSeat = Number(typedSchool?.max_seats ?? 0);
      if (schoolsMaxSeat > 0) {
        slotLimit = schoolsMaxSeat;
      }
    }

    // count used teacher seats
    const membersRes = await admin
      .from("school_members")
      .select("role")
      .eq("school_id", typedSchool.id);

    if (membersRes.error) {
      return NextResponse.json({ ok: false, error: membersRes.error.message }, { status: 500 });
    }

    const usedSeats = ((membersRes.data ?? []) as Array<{ role: string | null }>).filter((m) => {
      const role = String(m.role ?? "").toLowerCase();
      if (!role) return true;
      if (isPrincipalRole(role)) return false;
      if (role === "removed_teacher") return false;
      return true;
    }).length;

    if (slotLimit != null && usedSeats >= slotLimit) {
      return NextResponse.json(
        { ok: false, error: "This school has no available teacher slots. Ask your principal to add more slots." },
        { status: 409 }
      );
    }

    // join school as teacher
    const joinWithStatus = await admin.from("school_members").insert({
      school_id: typedSchool.id,

    // join school (teacher by default)
    
      user_id: user.id,
      role: "teacher",
      status: "active",
    });

 let joinErr = joinWithStatus.error;
    if (joinErr && isMissingTableOrColumnError(joinErr)) {
      const joinFallback = await admin.from("school_members").insert({
        school_id: typedSchool.id,
        user_id: user.id,
        role: "teacher",
      });
      joinErr = joinFallback.error;
    }
    
    if (joinErr && !String(joinErr.code).includes("23505")) {
      return NextResponse.json({ ok: false, error: joinErr.message }, { status: 500 });
    }

    // return membership (best effort)
    const { data: membership } = await admin
      .from("school_members")
      .select("role, joined_at, created_at")
      .eq("school_id", typedSchool.id)
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json(
            {
        ok: true,
        data: {
          school: typedSchool,
          membership: membership
            ? {
                role: (membership as MembershipRow).role ?? "teacher",
                joined_at:
                  (membership as MembershipRow).joined_at ??
                  (membership as MembershipRow).created_at ??
                  null,
              }
            : { role: "teacher", joined_at: null },
        },
      },
      { status: 200 }
    );
    } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Join failed";
    return NextResponse.json(
       { ok: false, error: message },
      { status: 500 }
    );
  }
}
