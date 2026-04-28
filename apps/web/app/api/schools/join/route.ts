import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
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
  school_id: string;
  user_id: string;
  role: string | null;
  created_at?: string | null;
};
 
type SchoolCodeRow = {
  school_id: string;
};
 
type SlotRow = {
  slot_limit: number | null;
};
 
type LicenseRow = {
  seats: number | null;
};
 
type SchoolMemberSeatRow = {
  user_id: string | null;
  role: string | null;
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
 
async function resolveSchoolByCode(
  admin: ReturnType<typeof createAdminClient>,
  code: string
): Promise<SchoolRow | null> {
  const codeRes = await admin
    .from("school_codes")
    .select("school_id")
    .eq("code", code)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
 
  if (codeRes.error && !isMissingTableOrColumnError(codeRes.error)) {
    throw new Error(codeRes.error.message);
  }
 
  const schoolIdFromCode = (codeRes.data as SchoolCodeRow | null)?.school_id ?? null;
 
  const schoolRes = await admin
    .from("schools")
    .select("id, name, code, created_at, max_seats")
    .eq(schoolIdFromCode ? "id" : "code", schoolIdFromCode ?? code)
    .maybeSingle();
 
  if (!schoolRes.error) {
    return (schoolRes.data as SchoolRow | null) ?? null;
  }
 
  if (isMissingTableOrColumnError(schoolRes.error)) {
    const fallbackSchoolRes = await admin
      .from("schools")
      .select("id, name, code, created_at")
      .eq(schoolIdFromCode ? "id" : "code", schoolIdFromCode ?? code)
      .maybeSingle();
 
    if (fallbackSchoolRes.error) {
      throw new Error(fallbackSchoolRes.error.message);
    }
 
    return (fallbackSchoolRes.data as SchoolRow | null) ?? null;
  }
 
  if (schoolRes.error) {
    throw new Error(schoolRes.error.message);
  }
 
  return null;
}
 
async function resolveSlotLimit(
  admin: ReturnType<typeof createAdminClient>,
  school: SchoolRow
): Promise<number | null> {
  let slotLimit: number | null = null;
 
  const slotRes = await admin
    .from("teacher_slots")
    .select("slot_limit")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
 
  if (slotRes.error && !isMissingTableOrColumnError(slotRes.error)) {
    throw new Error(slotRes.error.message);
  }
 
  const teacherSlotLimit = Number((slotRes.data as SlotRow | null)?.slot_limit ?? 0);
  if (teacherSlotLimit > 0) {
    slotLimit = teacherSlotLimit;
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
      throw new Error(licenseRes.error.message);
    }
 
    const licenseSeats = Number((licenseRes.data as LicenseRow | null)?.seats ?? 0);
    if (licenseSeats > 0) {
      slotLimit = licenseSeats;
    }
  }
 
  if (slotLimit == null) {
    const maxSeats = Number(school.max_seats ?? 0);
    if (maxSeats > 0) {
      slotLimit = maxSeats;
    }
  }
 
  return slotLimit;
}
 
function roleConsumesTeacherSeat(role: string | null | undefined) {
  const normalized = String(role ?? "").toLowerCase();
  if (!normalized) return true;
  if (isPrincipalRole(normalized)) return false;
  if (normalized === "removed_teacher") return false;
  return true;
}
 
async function countUsedTeacherSeats(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string
) {
  const membersRes = await admin
    .from("school_members")
    .select("user_id, role")
    .eq("school_id", schoolId);
 
  if (membersRes.error) {
    throw new Error(membersRes.error.message);
  }
 
  const usersOccupyingSeat = new Set<string>();
 
  for (const row of (membersRes.data ?? []) as SchoolMemberSeatRow[]) {
    if (!roleConsumesTeacherSeat(row.role)) continue;
    const userId = String(row.user_id ?? "").trim();
    if (!userId) continue;
    usersOccupyingSeat.add(userId);
  }
 
  return usersOccupyingSeat.size;
}
 
async function updateTeacherMembership(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  userId: string
) {
  const updateWithStatus = await admin
    .from("school_members")
    .update({ role: "teacher", status: "active" })
    .eq("school_id", schoolId)
    .eq("user_id", userId);
 
  if (!updateWithStatus.error) {
    return;
  }
 
  if (!isMissingTableOrColumnError(updateWithStatus.error)) {
    throw new Error(updateWithStatus.error.message);
  }
 
  const updateFallback = await admin
    .from("school_members")
    .update({ role: "teacher" })
    .eq("school_id", schoolId)
    .eq("user_id", userId);
 
  if (updateFallback.error) {
    throw new Error(updateFallback.error.message);
  }
}
 
async function insertTeacherMembership(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  userId: string
) {
  const insertWithStatus = await admin.from("school_members").insert({
    school_id: schoolId,
    user_id: userId,
    role: "teacher",
    status: "active",
  });
 
  if (!insertWithStatus.error) {
    return;
  }
 
  if (isMissingTableOrColumnError(insertWithStatus.error)) {
    const fallbackInsert = await admin.from("school_members").insert({
      school_id: schoolId,
      user_id: userId,
      role: "teacher",
    });
 
    if (fallbackInsert.error && String(fallbackInsert.error.code ?? "") !== "23505") {
      throw new Error(fallbackInsert.error.message);
    }
    return;
  }
 
  if (String(insertWithStatus.error.code ?? "") === "23505") {
    return;
  }
 
  throw new Error(insertWithStatus.error.message);
}
 
async function normalizeTeacherMembershipRows(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  userId: string
) {
  const currentRowsRes = await admin
    .from("school_members")
    .select("school_id, user_id, role, created_at")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
 
  if (currentRowsRes.error && !isMissingTableOrColumnError(currentRowsRes.error)) {
    throw new Error(currentRowsRes.error.message);
  }
 
  const rows = (currentRowsRes.data ?? []) as MembershipRow[];
 
  if (!rows.length) {
    await insertTeacherMembership(admin, schoolId, userId);
    return;
  }
 
  // Keep exactly one teacher row for this user+school pair.
  if (rows.length > 1) {
    const deleteDuplicates = await admin
      .from("school_members")
      .delete()
      .eq("school_id", schoolId)
      .eq("user_id", userId);
 
    if (deleteDuplicates.error) {
      throw new Error(deleteDuplicates.error.message);
    }
 
    await insertTeacherMembership(admin, schoolId, userId);
    return;
  }
 
  await updateTeacherMembership(admin, schoolId, userId);
}
 
export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
 
    const admin = createAdminClient();
    const supabase = supabaseWithToken(token);
 
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }
 
    const body = await req.json().catch(() => null);
    const code = String(body?.code ?? "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ ok: false, error: "School code is required" }, { status: 400 });
    }
 
    const school = await resolveSchoolByCode(admin, code);
    if (!school) {
      return NextResponse.json({ ok: false, error: "Invalid school code" }, { status: 404 });
    }
 
    const userMembershipsRes = await admin
      .from("school_members")
      .select("school_id, user_id, role, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
 
    if (userMembershipsRes.error && !isMissingTableOrColumnError(userMembershipsRes.error)) {
      return NextResponse.json({ ok: false, error: userMembershipsRes.error.message }, { status: 500 });
    }
 
    const allUserMemberships = (userMembershipsRes.data ?? []) as MembershipRow[];
    const hasPrincipalMembership = allUserMemberships.some((row) => isPrincipalRole(row.role));
    if (hasPrincipalMembership) {
      return NextResponse.json(
        { ok: false, error: "Principal accounts cannot join a school as a teacher." },
        { status: 403 }
      );
    }
 
    const existingSchoolRows = allUserMemberships.filter((row) => row.school_id === school.id);
    const alreadyConsumesSeat = existingSchoolRows.some((row) => roleConsumesTeacherSeat(row.role));
 
    const slotLimit = await resolveSlotLimit(admin, school);
    if (!alreadyConsumesSeat && slotLimit != null) {
      const usedSeats = await countUsedTeacherSeats(admin, school.id);
      if (usedSeats >= slotLimit) {
        return NextResponse.json(
          { ok: false, error: "This school is full. Ask your principal to add more teacher slots." },
          { status: 409 }
        );
      }
    }
 
    await normalizeTeacherMembershipRows(admin, school.id, user.id);

    await admin
      .from("profiles")
      .update({ school_id: school.id, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    const membershipRes = await admin
      .from("school_members")
      .select("school_id, user_id, role, created_at")
      .eq("school_id", school.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
 
    if (membershipRes.error && !isMissingTableOrColumnError(membershipRes.error)) {
      return NextResponse.json({ ok: false, error: membershipRes.error.message }, { status: 500 });
    }
 
    const membership = membershipRes.data as MembershipRow | null;
 
    return NextResponse.json(
      {
        ok: true,
        data: {
          school,
          membership: {
            role: membership?.role ?? "teacher",
            joined_at: membership?.created_at ?? null,
          },
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