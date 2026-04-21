import { NextRequest, NextResponse } from "next/server";
import { appUrl, paystackHeaders } from "@/lib/paystack";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import {
  DEFAULT_BILLING_CYCLE,
  DEFAULT_CURRENCY,
  DEFAULT_SLOT_PRICE,
  computeSubscriptionAmount,
  sanitizeSlotCount,
} from "@/lib/principal/utils";
import { generatePrincipalPaymentReference, getPrincipalPaystackFlow } from "@/lib/principal/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type InitPrincipalPaymentPayload = {
  principalName: string;
  schoolName: string;
  teacherSlots: number;
};

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);
    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }
    if (context.isTeacherOnly) {
      return NextResponse.json({ ok: false, error: "Teacher accounts cannot start principal billing." }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as InitPrincipalPaymentPayload | null;
    const principalName = String(body?.principalName ?? "").trim();
    const schoolName = String(body?.schoolName ?? "").trim();
    const teacherSlots = sanitizeSlotCount(body?.teacherSlots ?? 1);
    const amount = computeSubscriptionAmount(teacherSlots, DEFAULT_SLOT_PRICE);

    if (!principalName || !schoolName) {
      return NextResponse.json(
        { ok: false, error: "Principal name and school name are required." },
        { status: 400 }
      );
    }

    if (!context.user.email) {
      return NextResponse.json({ ok: false, error: "User email is required for payment checkout." }, { status: 400 });
    }

    if (context.school?.id) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            alreadyActivated: true,
            schoolId: context.school.id,
          },
        },
        { status: 200 }
      );
    }

    const reference = generatePrincipalPaymentReference(context.user.id);
    const callbackPath = `/billing/success?flow=${encodeURIComponent(getPrincipalPaystackFlow())}`;
    const callbackUrl = appUrl(callbackPath);

    const initResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: paystackHeaders(),
      body: JSON.stringify({
        email: context.user.email,
        amount: amount * 100,
        currency: DEFAULT_CURRENCY,
        reference,
        callback_url: callbackUrl,
        metadata: {
          flow: getPrincipalPaystackFlow(),
          purpose: "principal_onboarding",
          user_id: context.user.id,
          principal_name: principalName,
          school_name: schoolName,
          teacher_slots: teacherSlots,
          expected_amount_major: amount,
          slot_price: DEFAULT_SLOT_PRICE,
          billing_cycle: DEFAULT_BILLING_CYCLE,
        },
      }),
      cache: "no-store",
    });

    const initJson = await initResponse.json();
    if (!initResponse.ok || !initJson?.status || !initJson?.data?.authorization_url || !initJson?.data?.reference) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to initialize Paystack transaction.",
          details: initJson,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          reference: String(initJson.data.reference),
          authorizationUrl: String(initJson.data.authorization_url),
          accessCode: String(initJson.data.access_code ?? ""),
          teacherSlots,
          slotPrice: DEFAULT_SLOT_PRICE,
          amount,
          currency: DEFAULT_CURRENCY,
          billingCycle: DEFAULT_BILLING_CYCLE,
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to initialize principal payment";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
