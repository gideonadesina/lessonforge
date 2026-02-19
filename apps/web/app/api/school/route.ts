import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function supabaseFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return { supabase: null as any, token: "" };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  return { supabase, token };
}

/**
 * Assumes:
 * - public.schools table: id, name, code, created_at
 * - public.profiles table: id (auth uid), school_id (uuid nullable)
 *
 * POST uses code to find school, then updates profiles.school_id
 */

export async function GET(req: NextRequest) {
  try {
    const { supabase } = supabaseFromAuth(req);
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: u, error: authErr } = await supabase.auth.getUser();
    if (authErr || !u?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // read profile
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, school_id")
      .eq("id", u.user.id)
      .single();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    if (!profile?.school_id) {
      return NextResponse.json({ data: { joined: false } }, { status: 200 });
    }

    // load school
    const { data: school, error: sErr } = await supabase
      .from("schools")
      .select("id, name, code, created_at")
      .eq("id", profile.school_id)
      .single();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    return NextResponse.json(
      { data: { joined: true, school } },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase } = supabaseFromAuth(req);
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: u, error: authErr } = await supabase.auth.getUser();
    if (authErr || !u?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const code = String(body?.code ?? "").trim();

    if (!code) return NextResponse.json({ error: "Enter a school code" }, { status: 400 });

    // Find school by code
    const { data: school, error: sErr } = await supabase
      .from("schools")
      .select("id, name, code, created_at")
      .eq("code", code)
      .single();

    if (sErr || !school) {
      return NextResponse.json({ error: "Invalid school code" }, { status: 404 });
    }

    // Update profile
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ school_id: school.id })
      .eq("id", u.user.id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ data: { joined: true, school } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { supabase } = supabaseFromAuth(req);
    if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: u, error: authErr } = await supabase.auth.getUser();
    if (authErr || !u?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ school_id: null })
      .eq("id", u.user.id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
