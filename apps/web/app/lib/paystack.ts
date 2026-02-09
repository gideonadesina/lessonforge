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
