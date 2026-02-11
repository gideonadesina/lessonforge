"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";

export default function SchoolCodeInput() {
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const redeemCode = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.rpc(
      "redeem_school_license",
      { p_code: code.trim() }
    );

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data?.ok) {
      setMessage(data?.error || "Invalid code");
      return;
    }

    setMessage("✅ School license activated successfully!");
    setTimeout(() => window.location.reload(), 1200);
  };
  <div className="text-red-600 font-bold">SCHOOL CODE TEST</div>


  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm max-w-md">
      <h3 className="font-semibold text-lg mb-2">
        Join School License
      </h3>

      <p className="text-sm text-gray-600 mb-3">
        Enter the code from your headteacher
      </p>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. LF-DEMO-2026"
          className="border rounded-lg px-3 py-2 w-full"
        />

        <button
          onClick={redeemCode}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
        >
          {loading ? "Activating..." : "Activate"}
        </button>
      </div>

      {message && (
        <p className="mt-3 text-sm">{message}</p>
      )}
    </div>
  );
}
