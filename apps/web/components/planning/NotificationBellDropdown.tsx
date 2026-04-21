"use client";

import type { Notification } from "@/lib/planning/types";
import { NotificationType } from "@/lib/planning/types";

function dotColor(type: NotificationType) {
  if (type === NotificationType.URGENT) return "bg-[#E24B4A]";
  if (type === NotificationType.PREP_WARNING) return "bg-[#BA7517]";
  if (type === NotificationType.COMPLETED) return "bg-[#639922]";
  if (type === NotificationType.INFO) return "bg-[#534AB7]";
  return "bg-slate-400";
}

export default function NotificationBellDropdown({
  notifications,
  onDismiss,
  onMarkAllRead,
}: {
  notifications: Notification[];
  onDismiss: (id: string) => Promise<void> | void;
  onMarkAllRead: () => Promise<void> | void;
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-[#1A2847] dark:bg-[#0B1530]">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-[#1A2847]">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Notifications
        </p>
        <button
          type="button"
          onClick={() => void onMarkAllRead()}
          className="text-xs font-medium text-[#534AB7] hover:underline"
        >
          Mark all read
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto p-2">
        {notifications.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-[#1A2847] dark:bg-[#0F172A] dark:text-slate-300">
            All clear — no reminders right now
          </div>
        ) : (
          <div className="space-y-1.5">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-[#1A2847] dark:bg-[#0F172A]"
              >
                <span
                  className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotColor(
                    notification.notification_type
                  )}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-900 dark:text-slate-100">
                    {notification.message}
                  </p>
                  {notification.sub_message ? (
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {notification.sub_message}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void onDismiss(notification.id)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
