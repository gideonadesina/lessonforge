export function paystackHeaders() {
  const key = process.env.PAYSTACK_SECRET_KEY!;
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function appUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}${path}`;
}

export async function verifyPaystackTransaction(reference: string) {
  const safeReference = String(reference ?? "").trim();
  if (!safeReference) {
    throw new Error("Missing transaction reference.");
  }

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(safeReference)}`, {
    headers: paystackHeaders(),
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json?.status || !json?.data) {
    throw new Error(json?.message || "Paystack verification failed.");
  }

  return json.data;
}
