import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import {
  DEFAULT_CURRENCY,
  DEFAULT_SLOT_PRICE,
  computeSubscriptionAmount,
  isMissingTableOrColumnError,
  sanitizeSlotCount,
} from "@/lib/principal/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SlotPayload = { addSlots: number };

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);

    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }
    if (!context.school?.id || !context.isPrincipal) {
      return NextResponse.json({ ok: false, error: "Principal workspace not found." }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as SlotPayload | null;
    const addSlots = sanitizeSlotCount(body?.addSlots ?? 1);
    const admin = createAdminClient();

    const slotRes = await admin
      .from("teacher_slots")
      .select("slot_limit")
      .eq("school_id", context.school.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (slotRes.error && !isMissingTableOrColumnError(slotRes.error)) {
      return NextResponse.json({ ok: false, error: slotRes.error.message }, { status: 500 });
    }

    const current = Number(slotRes.data?.slot_limit ?? 0);
    const nextLimit = Math.max(1, current + addSlots);

    const createSlotRes = await admin.from("teacher_slots").insert({
      school_id: context.school.id,
      slot_limit: nextLimit,
      slot_price: DEFAULT_SLOT_PRICE,
      currency: DEFAULT_CURRENCY,
      status: "active",
    });

    if (createSlotRes.error && !isMissingTableOrColumnError(createSlotRes.error)) {
      return NextResponse.json({ ok: false, error: createSlotRes.error.message }, { status: 500 });
    }

    const amount = computeSubscriptionAmount(addSlots, DEFAULT_SLOT_PRICE);
    const billingRes = await admin.from("subscriptions").insert({
      school_id: context.school.id,
      amount,
      currency: DEFAULT_CURRENCY,
      status: "paid",
      provider: "placeholder",
      reference: `upgrade_${Date.now()}`,
      teacher_slots: nextLimit,
      billing_cycle: "monthly",
      paid_at: new Date().toISOString(),
    });

    if (billingRes.error && !isMissingTableOrColumnError(billingRes.error)) {
      return NextResponse.json({ ok: false, error: billingRes.error.message }, { status: 500 });
    }

    // Sync with school_licenses if available.
    const licenseUpdate = await admin
      .from("school_licenses")
      .update({ seats: nextLimit })
      .eq("school_id", context.school.id);
    if (licenseUpdate.error && !isMissingTableOrColumnError(licenseUpdate.error)) {
      return NextResponse.json({ ok: false, error: licenseUpdate.error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          slotLimit: nextLimit,
          addedSlots: addSlots,
          amount,
          currency: DEFAULT_CURRENCY,
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update slots";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}