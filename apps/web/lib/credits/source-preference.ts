export type ClientCreditSource = "school" | "personal";

export const CREDIT_SOURCE_STORAGE_KEY = "lessonforge.creditSource";

export function readClientCreditSource(): ClientCreditSource | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CREDIT_SOURCE_STORAGE_KEY);
  return value === "school" || value === "personal" ? value : null;
}

export function writeClientCreditSource(source: ClientCreditSource) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREDIT_SOURCE_STORAGE_KEY, source);
}

export function shouldUsePersonalCredits() {
  return readClientCreditSource() === "personal";
}
