"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readStoredRole } from "@/lib/auth/roles";

export default function LoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const role = readStoredRole();

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