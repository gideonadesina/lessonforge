import { NextResponse } from "next/server";
import { ADMIN_USER_ID, getAdminSessionUserId } from "@/lib/admin/metrics";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TopUpRequest = {
  targetType?: "user" | "school";
  targetId?: string;
  amount?: number;
};

export async function POST(request: Request) {
  const userId = await getAdminSessionUserId();
  if (!userId || userId !== ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const input = (await request.json().catch(() => null)) as TopUpRequest | null;
  const targetType = input?.targetType;
  const targetId = String(input?.targetId ?? "").trim();
  const amount = Number(input?.amount ?? 0);

  if ((targetType !== "user" && targetType !== "school") || !targetId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Choose a user or school and enter a positive credit amount." }, { status: 400 });
  }

  const creditsToAdd = Math.floor(amount);
  const supabase = createAdminClient();

  if (targetType === "user") {
    const { data: profile, error: readError } = await supabase
      .from("profiles")
      .select("id, full_name, email, credits_balance")
      .eq("id", targetId)
      .maybeSingle();

    if (readError || !profile) {
      return NextResponse.json({ error: readError?.message ?? "User not found." }, { status: 404 });
    }

    const previousBalance = Math.max(0, Number((profile as any).credits_balance ?? 0));
    const newBalance = previousBalance + creditsToAdd;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits_balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", targetId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      targetType,
      name: (profile as any).full_name || (profile as any).email || "User",
      creditsAdded: creditsToAdd,
      previousBalance,
      newBalance,
    });
  }

  const { data: school, error: readError } = await supabase
    .from("schools")
    .select("id, name, shared_credits")
    .eq("id", targetId)
    .maybeSingle();

  if (readError || !school) {
    return NextResponse.json({ error: readError?.message ?? "School not found." }, { status: 404 });
  }

  const previousBalance = Math.max(0, Number((school as any).shared_credits ?? 0));
  const newBalance = previousBalance + creditsToAdd;
  const { error: updateError } = await supabase
    .from("schools")
    .update({ shared_credits: newBalance })
    .eq("id", targetId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    targetType,
    name: (school as any).name || "School",
    creditsAdded: creditsToAdd,
    previousBalance,
    newBalance,
  });
}
