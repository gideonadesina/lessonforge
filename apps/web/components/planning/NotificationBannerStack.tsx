"use client";

import type { Notification } from "@/lib/planning/types";
import { NotificationType } from "@/lib/planning/types";

type NotificationBannerStackProps = {
  notifications: Notification[];
  loading?: boolean;
  error?: string | null;
  onDismiss: (id: string) => Promise<void> | void;
  onAction: (notification: Notification) => void;
};

const PRIORITY: NotificationType[] = [
  NotificationType.URGENT,
  NotificationType.PREP_WARNING,
  NotificationType.INFO,
  NotificationType.NEUTRAL,
  NotificationType.COMPLETED,
];

function sortByPriority(items: Notification[]) {
  return [...items]
    .sort((a, b) => {
      const ai = PRIORITY.indexOf(a.notification_type);
      const bi = PRIORITY.indexOf(b.notification_type);
      if (ai !== bi) return ai - bi;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 5);
}

function typeLabel(type: NotificationType) {
  if (type === NotificationType.PREP_WARNING) return "Prep warning";
  if (type === NotificationType.COMPLETED) return "Completed";
  if (type === NotificationType.INFO) return "Info";
  if (type === NotificationType.NEUTRAL) return "Reminder";
  return "Urgent";
}

function palette(type: NotificationType) {
  if (type === NotificationType.URGENT) {
    return {
      row: "border-[#F09595] bg-[#FCEBEB]",
      icon: "bg-[#E24B4A]",
      primaryButton: "bg-[#E24B4A] text-white hover:opacity-90",
      tag: "text-[#8F2323]",
    };
  }

  if (type === NotificationType.PREP_WARNING) {
    return {
      row: "border-[#EF9F27] bg-[#FAEEDA]",
      icon: "bg-[#BA7517]",
      primaryButton: "bg-[#534AB7] text-white hover:opacity-90",
      tag: "text-[#8A560D]",
    };
  }

  if (type === NotificationType.COMPLETED) {
    return {
      row: "border-[#C0DD97] bg-[#EAF3DE]",
      icon: "bg-[#639922]",
      primaryButton:
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      tag: "text-[#466C17]",
    };
  }

  if (type === NotificationType.INFO) {
    return {
      row: "border-[#AFA9EC] bg-[#EEEDFE]",
      icon: "bg-[#534AB7]",
      primaryButton:
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      tag: "text-[#3C3489]",
    };
  }

  return {
    row: "border-slate-200 bg-slate-50",
    icon: "bg-slate-500",
    primaryButton:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    tag: "text-slate-600",
  };
}

function actionLabel(notification: Notification) {
  if (notification.notification_type === NotificationType.URGENT) {
    return "Open lesson pack";
  }
  if (notification.notification_type === NotificationType.PREP_WARNING) {
    return "Generate lesson";
  }
  if (notification.notification_type === NotificationType.COMPLETED) {
    return "View summary";
  }
  return notification.action_label ?? "View";
}

function dismissLabel(notification: Notification) {
  if (notification.notification_type === NotificationType.PREP_WARNING) {
    return "Snooze";
  }
  if (notification.notification_type === NotificationType.COMPLETED) {
    return "";
  }
  return "Dismiss";
}

export default function NotificationBannerStack({
  notifications,
  loading = false,
  error = null,
  onDismiss,
  onAction,
}: NotificationBannerStackProps) {
  if (loading) return null;
  if (error || notifications.length === 0) return null;

  const visible = sortByPriority(notifications);
  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.map((notification) => {
        const style = palette(notification.notification_type);
        const secondary = dismissLabel(notification);

        return (
          <div
            key={notification.id}
            className={`flex items-center gap-3 rounded-xl border p-3 ${style.row}`}
          >
            <div
              className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg ${style.icon}`}
            >
              <span className="text-xs font-semibold text-white">!</span>
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={`text-[9px] uppercase tracking-wide ${style.tag} font-semibold`}
              >
                {typeLabel(notification.notification_type)}
              </p>
              <p className="truncate text-xs font-medium text-slate-900">
                {notification.message}
              </p>
              {notification.sub_message ? (
                <p className="truncate text-[11px] text-slate-600">
                  {notification.sub_message}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {secondary ? (
                <button
                  type="button"
                  onClick={() => void onDismiss(notification.id)}
                  className="rounded-lg border border-transparent px-2 py-1 text-xs text-slate-600 hover:bg-white/70"
                >
                  {secondary}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onAction(notification)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${style.primaryButton}`}
              >
                {actionLabel(notification)}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
