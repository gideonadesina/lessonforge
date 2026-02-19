import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase(token);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // get school created by this admin
    const { data: school } = await supabase
      .from("schools")
      .select("*")
      .eq("created_by", user.id)
      .single();

    if (!school) {
      return NextResponse.json({ error: "Not school admin" }, { status: 403 });
    }

    // get members
    const { data: members } = await supabase
      .from("school_memberships")
      .select("user_id, role, created_at")
      .eq("school_id", school.id);

    return NextResponse.json({
      school,
      members: members ?? [],
    });

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed" },
      { status: 500 }
    );
  }
}
