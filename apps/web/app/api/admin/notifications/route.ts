import { NextResponse } from "next/server";
import { ADMIN_USER_ID, getAdminSessionUserId } from "@/lib/admin/metrics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications, type NotificationKind } from "@/lib/notifications/server";

export const dynamic = "force-dynamic";

type RecipientMode = "all" | "teachers" | "principals" | "school" | "user";

type Payload = {
  title?: string;
  message?: string;
  type?: NotificationKind;
  recipientMode?: RecipientMode;
  schoolId?: string;
  userId?: string;
  releaseNote?: boolean;
};

function normalizeRole(role: unknown) {
  return String(role ?? "").toLowerCase();
}

function isTeacher(profile: Record<string, unknown>, schoolMemberRole?: string | null) {
  const role = normalizeRole(profile.app_role ?? schoolMemberRole);
  return role.includes("teacher");
}

function isPrincipal(profile: Record<string, unknown>, schoolMemberRole?: string | null) {
  const role = normalizeRole(profile.app_role ?? schoolMemberRole);
  return ["principal", "admin", "owner", "school_admin", "headteacher"].some((item) => role.includes(item));
}

export async function POST(request: Request) {
  const adminUserId = await getAdminSessionUserId();
  if (!adminUserId || adminUserId !== ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const input = (await request.json().catch(() => null)) as Payload | null;
  const title = String(input?.title ?? "").trim();
  const message = String(input?.message ?? "").trim();
  const type = input?.type ?? (input?.releaseNote ? "info" : "info");
  const recipientMode = input?.recipientMode ?? "all";

  if (!title || !message) {
    return NextResponse.json({ error: "Title and message are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: profiles, error: profilesError }, { data: members }] = await Promise.all([
    admin.from("profiles").select("id, app_role, school_id"),
    admin.from("school_members").select("user_id, school_id, role, status"),
  ]);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const memberByUser = new Map<string, { school_id?: string | null; role?: string | null; status?: string | null }>();
  for (const member of (members ?? []) as Array<{ user_id?: string | null; school_id?: string | null; role?: string | null; status?: string | null }>) {
    if (!member.user_id) continue;
    if (String(member.status ?? "").toLowerCase() === "disabled") continue;
    if (!memberByUser.has(member.user_id)) memberByUser.set(member.user_id, member);
  }

  const profileRows = ((profiles ?? []) as Array<Record<string, unknown>>).filter((profile) => typeof profile.id === "string");
  let recipientIds: string[] = [];

  if (recipientMode === "all") {
    recipientIds = profileRows.map((profile) => profile.id as string);
  } else if (recipientMode === "teachers") {
    recipientIds = profileRows
      .filter((profile) => isTeacher(profile, memberByUser.get(profile.id as string)?.role))
      .map((profile) => profile.id as string);
  } else if (recipientMode === "principals") {
    recipientIds = profileRows
      .filter((profile) => isPrincipal(profile, memberByUser.get(profile.id as string)?.role))
      .map((profile) => profile.id as string);
  } else if (recipientMode === "school") {
    const schoolId = String(input?.schoolId ?? "").trim();
    if (!schoolId) return NextResponse.json({ error: "School is required." }, { status: 400 });
    recipientIds = profileRows
      .filter((profile) => profile.school_id === schoolId || memberByUser.get(profile.id as string)?.school_id === schoolId)
      .map((profile) => profile.id as string);
  } else if (recipientMode === "user") {
    const userId = String(input?.userId ?? "").trim();
    if (!userId) return NextResponse.json({ error: "User is required." }, { status: 400 });
    recipientIds = [userId];
  }

  recipientIds = [...new Set(recipientIds)].filter(Boolean);
  if (!recipientIds.length) {
    return NextResponse.json({ error: "No matching recipients found." }, { status: 400 });
  }

  const result = await createNotifications(
    recipientIds.map((userId) => ({
      userId,
      title: input?.releaseNote ? `Release Notes: ${title}` : title,
      message,
      type,
      actionUrl: input?.releaseNote ? "/updates" : null,
      actionLabel: input?.releaseNote ? "View updates" : null,
    }))
  );

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: result.count });
}
