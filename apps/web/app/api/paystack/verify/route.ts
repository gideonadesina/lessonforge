import { NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizePrincipalActivationFromPaystackData, getPrincipalPaystackFlow } from "@/lib/principal/payment";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";

type LegacyPaystackData = {
  status?: string | null;
  metadata?: { user_id?: string | null; flow?: string | null } | null;
  customer?: { email?: string | null; customer_code?: string | null } | null;
  subscription?: { subscription_code?: string | null } | null;
  currency?: "NGN" | "USD" | null;
};

async function applyLegacyProfileUpgrade(data: LegacyPaystackData) {
  if (String(data?.status ?? "").toLowerCase() !== "success") return;

  const user_id = data?.metadata?.user_id as string | undefined;
  const email = data?.customer?.email as string | undefined;
  const currency = (data?.currency as "NGN" | "USD") || "NGN";
  const subscription_code = data?.subscription?.subscription_code as string | undefined;
  const customer_code = data?.customer?.customer_code as string | undefined;

  if (!user_id) return;

  const admin = createAdminClient();
  await admin.from("profiles").upsert(
    {
      id: user_id,
      is_pro: true,
      free_credits: 1,
      pro_expires_at: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
      plan: currency,
      paystack_subscription_code: subscription_code ?? null,
      paystack_customer_code: customer_code ?? null,
      paystack_email: email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

export async function GET(req: Request) {
  const token = getBearerTokenFromHeaders(req.headers);
  const authContext = await resolvePrincipalContext(token);
  if (!authContext.ok || !authContext.user) {
    return NextResponse.json({ ok: false, error: authContext.error ?? "Unauthorized" }, { status: authContext.status ?? 401 });
  }

  const { searchParams } = new URL(req.url);
  const reference = String(searchParams.get("reference") ?? "").trim();

  if (!reference) {
    return NextResponse.json({ ok: false, error: "Missing reference" }, { status: 400 });
  }

  try {
    const data = await verifyPaystackTransaction(reference);
    const metadataUserId = String(data?.metadata?.user_id ?? "").trim();
    if (metadataUserId && metadataUserId !== authContext.user.id) {
      return NextResponse.json({ ok: false, error: "Payment reference does not belong to this user." }, { status: 403 });
    }

    const flow = String(data?.metadata?.flow ?? "");

    if (flow === getPrincipalPaystackFlow()) {
      const activation = await finalizePrincipalActivationFromPaystackData(data);
      return NextResponse.json({ ok: true, data: activation }, { status: 200 });
    }

    await applyLegacyProfileUpgrade(data);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Verify failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
