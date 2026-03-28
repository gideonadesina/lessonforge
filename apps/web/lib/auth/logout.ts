"use client";

import { clearPersistedActiveRole } from "@/lib/auth/roles";

export async function signOutAndRedirect(options: {
  signOut: () => Promise<unknown>;
  to?: string;
}) {
  try {
    clearPersistedActiveRole();
    await options.signOut();
  } finally {
    window.location.href = options.to ?? "/login";
  }
}
