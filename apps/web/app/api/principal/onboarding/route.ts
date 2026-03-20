import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { finalizePrincipalActivationFromPaystackData } from "@/lib/principal/payment";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OnboardingPayload = {
  payment?: {
    provider?: "paystack";
    reference?: string | null;
  };
};

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);

    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }

    if (context.isTeacherOnly) {
      return NextResponse.json(
        { ok: false, error: "Teacher accounts cannot create principal workspaces." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as OnboardingPayload | null;
    const provider = body?.payment?.provider;
    const reference = String(body?.payment?.reference ?? "").trim();

    if (provider !== "paystack") {
      return NextResponse.json({ ok: false, error: "Only Paystack payment is supported." }, { status: 400 });
    }

    if (!reference) {
      return NextResponse.json({ ok: false, error: "Payment reference is required." }, { status: 400 });
    }

    const paystackData = await verifyPaystackTransaction(reference);
    const paystackUserId = String(paystackData?.metadata?.user_id ?? "").trim();
    if (paystackUserId && paystackUserId !== context.user.id) {
      return NextResponse.json({ ok: false, error: "Payment reference does not belong to this user." }, { status: 403 });
    }

    const activation = await finalizePrincipalActivationFromPaystackData(paystackData);

    return NextResponse.json(
      {
        ok: true,
        data: {
          schoolId: activation.schoolId,
          schoolName: activation.schoolName,
          schoolCode: activation.schoolCode,
          teacherSlots: activation.teacherSlots,
          amount: activation.amount,
          currency: activation.currency,
          reference: activation.reference,
          alreadyActivated: activation.alreadyActivated,
          redirectTo: "/principal",
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to complete onboarding";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}