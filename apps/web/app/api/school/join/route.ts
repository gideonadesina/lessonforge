import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { schoolCode } = (await req.json()) as { schoolCode: unknown };
    const code = String(schoolCode ?? "").trim().toUpperCase();

    if (!code) {
      return NextResponse.json(
        { error: "School code is required" },
        { status: 400 }
      );
    }

    if (code.length < 4 || code.length > 20) {
      return NextResponse.json(
        { error: "Invalid school code format" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Find school by code
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name, shared_credits, teacher_limit")
      .eq("code", code)
      .maybeSingle();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: "School code not found. Please check and try again." },
        { status: 404 }
      );
    }

    // Check if teacher already joined this school
    const { data: existing } = await admin
      .from("school_members")
      .select("id")
      .eq("school_id", school.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          alreadyMember: true,
          schoolId: school.id,
          schoolName: school.name,
          message: "You are already a member of this school",
        }
      );
    }

    // Add teacher as school member
    const { error: insertError } = await admin.from("school_members").insert({
      school_id: school.id,
      user_id: user.id,
      role: "teacher",
    });

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to join school: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Update teacher profile to indicate school membership
    await admin
      .from("profiles")
      .update({
        school_id: school.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({
      ok: true,
      alreadyMember: false,
      schoolId: school.id,
      schoolName: school.name,
      sharedCredits: school.shared_credits,
      teacherLimit: school.teacher_limit,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to join school";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
