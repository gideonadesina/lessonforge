"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAppRole, ROLE_STORAGE_KEY } from "@/lib/auth/roles";

export default function LoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
    const role = isAppRole(savedRole) ? savedRole : null;

    if (role) {
      router.replace(`/auth/${role}`);
      return;
    }

    router.replace("/select-role");
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f2ea] text-sm text-slate-600">
      Preparing your sign in experience...
    </div>
  );
}