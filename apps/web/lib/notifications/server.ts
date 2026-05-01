import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationKind = "info" | "warning" | "success" | "reminder";

export function legacyNotificationType(type: NotificationKind) {
  if (type === "warning") return "PREP_WARNING";
  if (type === "success") return "COMPLETED";
  if (type === "reminder") return "NEUTRAL";
  return "INFO";
}

function notificationDateOrToday(value?: string | null) {
  return value || new Date().toISOString().slice(0, 10);
}

export async function createNotification({
  userId,
  title,
  message,
  type = "info",
  actionUrl = null,
  actionLabel = null,
  timetableSlotId = null,
  notificationDate = null,
  subMessage = null,
}: {
  userId: string;
  title: string;
  message: string;
  type?: NotificationKind;
  actionUrl?: string | null;
  actionLabel?: string | null;
  timetableSlotId?: string | null;
  notificationDate?: string | null;
  subMessage?: string | null;
}) {
  const admin = createAdminClient();
  return admin.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    read: false,
    notification_type: legacyNotificationType(type),
    sub_message: subMessage,
    action_label: actionLabel,
    action_url: actionUrl,
    timetable_slot_id: timetableSlotId,
    notification_date: notificationDateOrToday(notificationDate),
  });
}

export async function createNotifications(rows: Array<Parameters<typeof createNotification>[0]>) {
  if (!rows.length) return { error: null, count: 0 };
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert(
    rows.map((row) => ({
      user_id: row.userId,
      title: row.title,
      message: row.message,
      type: row.type ?? "info",
      read: false,
      notification_type: legacyNotificationType(row.type ?? "info"),
      sub_message: row.subMessage ?? null,
      action_label: row.actionLabel ?? null,
      action_url: row.actionUrl ?? null,
      timetable_slot_id: row.timetableSlotId ?? null,
      notification_date: notificationDateOrToday(row.notificationDate),
    }))
  );
  return { error, count: error ? 0 : rows.length };
}
