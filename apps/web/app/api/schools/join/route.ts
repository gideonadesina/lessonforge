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

    // find school by code
    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("id, name, code, created_at")
      .eq("code", code)
      .single();

    if (schoolErr || !school) {
      return NextResponse.json({ ok: false, error: "Invalid school code" }, { status: 404 });
    }

    // join school (teacher by default)
    const { error: joinErr } = await supabase.from("school_members").insert({
      school_id: school.id,
      user_id: user.id,
      role: "teacher",
    });

    // if already joined, ignore duplicate error
    // Postgres unique violation: 23505
    if (joinErr && !String(joinErr.code).includes("23505")) {
      return NextResponse.json({ ok: false, error: joinErr.message }, { status: 500 });
    }

    // return membership (best effort)
    const { data: membership } = await supabase
      .from("school_members")
      .select("role, joined_at")
      .eq("school_id", school.id)
      .eq("user_id", user.id)
      .single();

    return NextResponse.json(
      { ok: true, data: { school, membership: membership ?? { role: "teacher" } } },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Join failed" },
      { status: 500 }
    );
  }
}
