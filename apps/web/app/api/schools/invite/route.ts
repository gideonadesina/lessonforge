import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase(token: string) {
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
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = supabase(token);

    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: school } = await db
      .from("schools")
      .select("*")
      .eq("created_by", user.id)
      .single();

    if (!school)
      return NextResponse.json({ error: "Not admin" }, { status: 403 });

    // generate new invite code
    const newCode =
      "LF-" +
      Math.random().toString(36).substring(2, 6).toUpperCase() +
      "-" +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    const { error } = await db
      .from("schools")
      .update({ code: newCode })
      .eq("id", school.id);

    if (error) throw error;

    return NextResponse.json({ code: newCode });

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
