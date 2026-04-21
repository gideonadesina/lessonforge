import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserClient } from "@/lib/planning/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateOnlyUtc(input: Date) {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, "0");
  const day = String(input.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUserClient(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error ?? "Unauthorized" },
      { status: auth.status ?? 401 }
    );
  }

  const params = await context.params;
  const timetableSlotId = String(params.id ?? "").trim();
  if (!timetableSlotId) {
    return NextResponse.json(
      { ok: false, error: "Slot id is required." },
      { status: 400 }
    );
  }

  const { data: slot, error: slotError } = await auth.supabase!
    .from("timetable_slots")
    .select("id, scheme_entry_id, timetable_id")
    .eq("id", timetableSlotId)
    .maybeSingle();

  if (slotError) {
    return NextResponse.json(
      { ok: false, error: slotError.message },
      { status: 500 }
    );
  }

  if (!slot?.id) {
    return NextResponse.json(
      { ok: false, error: "Timetable slot not found." },
      { status: 404 }
    );
  }

  const { data: timetableOwner, error: ownerError } = await auth.supabase
    .from("teacher_timetable")
    .select("user_id")
    .eq("id", slot.timetable_id)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json(
      { ok: false, error: ownerError.message },
      { status: 500 }
    );
  }

  if (!timetableOwner || timetableOwner.user_id !== auth.user.id) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const now = new Date();
  const viewDate = dateOnlyUtc(now);
  const viewedAt = now.toISOString();

  const upsertPayload = {
    user_id: auth.user.id,
    timetable_slot_id: timetableSlotId,
    scheme_entry_id: slot.scheme_entry_id ?? null,
    view_date: viewDate,
    viewed_at: viewedAt,
  };

  const { error: upsertError } = await auth.supabase.from("lesson_pack_views").upsert(upsertPayload, {
    onConflict: "user_id,timetable_slot_id,view_date",
    ignoreDuplicates: false,
  });

  if (upsertError) {
    return NextResponse.json(
      { ok: false, error: upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      timetable_slot_id: timetableSlotId,
      scheme_entry_id: slot.scheme_entry_id ?? null,
      view_date: viewDate,
    },
  });
}
