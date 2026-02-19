"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";


export default function AccountPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      setFullName(prof?.full_name ?? "");
      setAvatarUrl(prof?.avatar_url ?? "");
    })();
  }, [supabase]);

  async function saveProfile() {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", userId);

    setLoading(false);
    setMsg(error ? error.message : "✅ Saved!");
  }

async function uploadAvatar(file: File) {
  setLoading(true);
  setMsg(null);

  try {
    const { data: u } = await supabase.auth.getUser();
    const user = u.user;
    if (!user) throw new Error("Please log in again.");

    const path = `${user.id}/avatar.png`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/png",
        cacheControl: "0",
      });

    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl + `?t=${Date.now()}`; // force refresh

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);

    if (profErr) throw profErr;

    setAvatarUrl(url);
    setMsg("✅ Photo updated!");
  } catch (err: any) {
    if (err?.name === "AbortError") {
      setMsg("Upload canceled by dev refresh. Try again.");
      return;
    }
    console.error("Upload error:", err);
    setMsg(err?.message ?? "Upload failed");
  } finally {
    setLoading(false);
  }
}
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Account preferences</h1>
      <p className="text-sm text-slate-600 mt-1">
        Manage your teacher profile and photo.
      </p>

      {msg && (
        <div className="mt-5 rounded-2xl border bg-white p-4 text-sm">{msg}</div>
      )}

      <div id="avatar" className="mt-8 rounded-2xl border bg-white p-6">
        <div className="font-semibold text-slate-900">Profile photo</div>
        <p className="text-sm text-slate-600 mt-1">
          Upload a clear headshot (PNG/JPG).
        </p>

        <div className="mt-4 flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-slate-900 text-white grid place-items-center font-bold">
              {(fullName || email || "U").slice(0, 1).toUpperCase()}
            </div>
          )}

          <label className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 cursor-pointer hover:bg-slate-50">
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              disabled={loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />
            {loading ? "Uploading..." : "Upload new photo"}
          </label>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-6">
        <div className="font-semibold text-slate-900">Profile</div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Full name
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3"
            placeholder="e.g. Gideon Adesina"
            disabled={loading}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email (read-only)
          </label>
          <input
            value={email}
            readOnly
            className="w-full rounded-2xl border px-4 py-3 bg-slate-50"
          />
        </div>

        <button
          onClick={saveProfile}
          disabled={loading}
          className="mt-5 rounded-2xl bg-slate-900 text-white px-5 py-3 font-semibold hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
