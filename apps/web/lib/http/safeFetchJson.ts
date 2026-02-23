export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; rawText: string }> {
  const res = await fetch(input, init);
  const text = await res.text();

  // If server returned HTML or empty body, prevent JSON crash
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return { ok: res.ok, status: res.status, data, rawText: text };
}