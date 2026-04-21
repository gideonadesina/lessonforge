import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserClient } from "@/lib/planning/notifications";
import type {
  NotificationPreferencesInput,
  TeacherTimetableInput,
  TimetableSlotInput,
} from "@/lib/planning/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SetupPayload = {
  timetable: TeacherTimetableInput;
  slots: TimetableSlotInput[];
  preferences: NotificationPreferencesInput;
};

function normalizeTeachingDays(days: string[]) {
  const allowed = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  return Array.from(
    new Set(days.map((d) => d.trim()).filter((d) => allowed.has(d)))
  );
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUserClient(req);
    if (!auth.ok || !auth.supabase || !auth.user) {
      return NextResponse.json(
        { ok: false, error: auth.error ?? "Unauthorized" },
        { status: auth.status ?? 401 }
      );
    }

    const db = auth.supabase as any;

    const body = (await req.json().catch(() => null)) as SetupPayload | null;
    if (!body?.timetable || !Array.isArray(body?.slots) || !body?.preferences) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload." },
        { status: 400 }
      );
    }

    const { timetable, slots, preferences } = body;
    if (!timetable.term?.trim() || !timetable.academic_year?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Term and academic year are required." },
        { status: 400 }
      );
    }

    const weeksInTerm = Number(timetable.weeks_in_term);
    if (!Number.isFinite(weeksInTerm) || weeksInTerm <= 0) {
      return NextResponse.json(
        { ok: false, error: "Weeks in term must be greater than 0." },
        { status: 400 }
      );
    }

    const teachingDays = normalizeTeachingDays(timetable.teaching_days ?? []);
    const timetablePayload = {
      user_id: auth.user.id,
      term: timetable.term.trim(),
      academic_year: timetable.academic_year.trim(),
      weeks_in_term: weeksInTerm,
      teaching_days: teachingDays,
    };

    const { data: upsertedTimetable, error: timetableError } = await db
      .from("teacher_timetable")
      .upsert(timetablePayload, {
        onConflict: "user_id,term,academic_year",
        ignoreDuplicates: false,
      })
      .select("id, user_id, term, academic_year")
      .single();

    if (timetableError || !upsertedTimetable?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: timetableError?.message ?? "Failed to save timetable.",
        },
        { status: 500 }
      );
    }

    const timetableId = upsertedTimetable.id;

    const { error: deleteSlotsError } = await db
      .from("timetable_slots")
      .delete()
      .eq("timetable_id", timetableId);

    if (deleteSlotsError) {
      return NextResponse.json(
        { ok: false, error: deleteSlotsError.message },
        { status: 500 }
      );
    }

    if (slots.length > 0) {
      const insertSlotsPayload = slots.map((slot) => ({
        timetable_id: timetableId,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        duration_minutes: slot.duration_minutes,
        class_name: slot.class_name.trim(),
        subject: slot.subject.trim(),
        room: slot.room?.trim() || null,
        scheme_entry_id: slot.scheme_entry_id ?? null,
      }));

      const { error: insertSlotsError } = await db
        .from("timetable_slots")
        .insert(insertSlotsPayload);

      if (insertSlotsError) {
        return NextResponse.json(
          { ok: false, error: insertSlotsError.message },
          { status: 500 }
        );
      }
    }

    const reminderMinutes = Number(preferences.reminder_minutes);
    if (!Number.isFinite(reminderMinutes) || reminderMinutes <= 0) {
      return NextResponse.json(
        { ok: false, error: "Reminder minutes must be greater than 0." },
        { status: 400 }
      );
    }

    const deliveryMethod = preferences.delivery_method;
    if (!["in_app", "email", "both"].includes(deliveryMethod)) {
      return NextResponse.json(
        { ok: false, error: "Invalid delivery method." },
        { status: 400 }
      );
    }

    const { error: prefError } = await db
      .from("notification_preferences")
      .upsert(
        {
          user_id: auth.user.id,
          reminder_minutes: reminderMinutes,
          delivery_method: deliveryMethod,
          enabled: Boolean(preferences.enabled),
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        }
      );

    if (prefError) {
      return NextResponse.json(
        { ok: false, error: prefError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          timetable_id: timetableId,
          slots_count: slots.length,
          preferences_saved: true,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save timetable setup.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}