"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Notification, TermProgress, TodaySlot } from "@/lib/planning/types";
import { NotificationType } from "@/lib/planning/types";
import { getWeekNumber } from "@/lib/planning/utils";
import NotificationBannerStack from "@/components/planning/NotificationBannerStack";
import TodaysTimeline from "@/components/planning/TodaysTimeline";
import WeekAtGlanceGrid from "@/components/planning/WeekAtGlanceGrid";
import TermProgressPanel from "@/components/planning/TermProgressPanel";
import TimetableSetupWizardCard from "@/components/planning/TimetableSetupWizardCard";
import ForgeGuideTipCard from "@/components/planning/ForgeGuideTipCard";

type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};

type WeekResponse = {
  slots_by_day: Record<string, TodaySlot[]>;
  events_by_day: Record<
    string,
    Array<{ id: string; title: string; event_type: string; event_date: string }>
  >;
};

type SetupStatus = {
  has_timetable: boolean;
  has_slots: boolean;
  has_preferences: boolean;
  has_linked_slots: boolean;
};

type PlanningDashboardClientProps = {
  initialDateLabel: string;
  initialTermLabel: string;
};

type FetchState<T> = {
  loading: boolean;
  error: string | null;
  data: T;
};

function todayUtcDateIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentDayLabelUtc(): "Mon" | "Tue" | "Wed" | "Thu" | "Fri" {
  const day = new Date().getUTCDay();
  if (day === 1) return "Mon";
  if (day === 2) return "Tue";
  if (day === 3) return "Wed";
  if (day === 4) return "Thu";
  return "Fri";
}

function sortNotificationsByPriority(items: Notification[]) {
  const order: Record<NotificationType, number> = {
    URGENT: 0,
    PREP_WARNING: 1,
    INFO: 2,
    NEUTRAL: 3,
    COMPLETED: 4,
  };
  return [...items].sort((a, b) => {
    const byType =
      (order[a.notification_type] ?? 99) - (order[b.notification_type] ?? 99);
    if (byType !== 0) return byType;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

async function getAccessToken() {
  const { createBrowserSupabase } = await import("@/lib/supabase/browser");
  const supabase = createBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

async function authedFetch(url: string, init?: RequestInit) {
  const token = await getAccessToken();
  if (!token) throw new Error("Unauthorized");
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export default function PlanningDashboardClient({
  initialDateLabel,
  initialTermLabel,
}: PlanningDashboardClientProps) {
  const [notifications, setNotifications] = useState<FetchState<NotificationsResponse>>({
    loading: true,
    error: null,
    data: { notifications: [], unreadCount: 0 },
  });
  const [todaySlots, setTodaySlots] = useState<FetchState<TodaySlot[]>>({
    loading: true,
    error: null,
    data: [],
  });
  const [weekData, setWeekData] = useState<FetchState<WeekResponse>>({
    loading: true,
    error: null,
    data: { slots_by_day: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] }, events_by_day: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] } },
  });
  const [progress, setProgress] = useState<FetchState<TermProgress>>({
    loading: true,
    error: null,
    data: { week_number: getWeekNumber(new Date()), subjects: [] },
  });
  const [setup, setSetup] = useState<FetchState<SetupStatus>>({
    loading: true,
    error: null,
    data: {
      has_timetable: false,
      has_slots: false,
      has_preferences: false,
      has_linked_slots: false,
    },
  });
  const [tipInput, setTipInput] = useState<{
    topic: string;
    class_name: string;
    subject: string;
  } | null>(null);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await authedFetch("/api/notifications");
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to fetch notifications");
      }
      const payload = json.data as NotificationsResponse;
      setNotifications({
        loading: false,
        error: null,
        data: {
          notifications: sortNotificationsByPriority(payload.notifications).slice(0, 5),
          unreadCount: payload.unreadCount ?? 0,
        },
      });
    } catch (error: unknown) {
      setNotifications((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch notifications",
      }));
    }
  }, []);

  const refreshToday = useCallback(async () => {
    try {
      const res = await authedFetch("/api/planning/today");
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to fetch today slots");
      }
      const slots = (json.data ?? []) as TodaySlot[];
      setTodaySlots({ loading: false, error: null, data: slots });

      const firstUpcoming =
        slots.find((slot) => slot.status === "now" || slot.status === "next") ??
        slots.find((slot) => slot.status === "later");

      if (firstUpcoming?.topic) {
        setTipInput({
          topic: firstUpcoming.topic,
          class_name: firstUpcoming.class_name,
          subject: firstUpcoming.subject,
        });
      } else {
        setTipInput(null);
      }
    } catch (error: unknown) {
      setTodaySlots({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch today slots",
        data: [],
      });
      setTipInput(null);
    }
  }, []);

  const refreshWeek = useCallback(async () => {
    try {
      const res = await authedFetch("/api/planning/week");
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to fetch week data");
      }
      setWeekData({ loading: false, error: null, data: json.data as WeekResponse });
    } catch (error: unknown) {
      setWeekData((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch week data",
      }));
    }
  }, []);

  const refreshProgress = useCallback(async () => {
    try {
      const res = await authedFetch("/api/planning/term-progress");
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to fetch term progress");
      }
      setProgress({ loading: false, error: null, data: json.data as TermProgress });
    } catch (error: unknown) {
      setProgress((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch term progress",
      }));
    }
  }, []);

  const refreshSetup = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Unauthorized");
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        }
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const [timetableRes, prefRes] = await Promise.all([
        supabase
          .from("teacher_timetable")
          .select("id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("notification_preferences")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);

      const timetableId = timetableRes.data?.id ?? null;
      let hasSlots = false;
      let hasLinked = false;
      if (timetableId) {
        const { data: slots } = await supabase
          .from("timetable_slots")
          .select("id, scheme_entry_id")
          .eq("timetable_id", timetableId);
        hasSlots = (slots ?? []).length > 0;
        hasLinked = (slots ?? []).some((slot) => Boolean(slot.scheme_entry_id));
      }

      setSetup({
        loading: false,
        error: null,
        data: {
          has_timetable: Boolean(timetableId),
          has_slots: hasSlots,
          has_preferences: Boolean(prefRes.data?.id),
          has_linked_slots: hasLinked,
        },
      });
    } catch (error: unknown) {
      setSetup((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch setup status",
      }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshNotifications(),
      refreshToday(),
      refreshWeek(),
      refreshProgress(),
      refreshSetup(),
    ]);
  }, [refreshNotifications, refreshProgress, refreshSetup, refreshToday, refreshWeek]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void Promise.all([refreshNotifications(), refreshToday(), refreshWeek(), refreshProgress()]);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refreshNotifications, refreshProgress, refreshToday, refreshWeek]);

  const handleDismissNotification = useCallback(async (id: string) => {
    await authedFetch(`/api/notifications/${id}/dismiss`, { method: "POST" });
    setNotifications((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        notifications: prev.data.notifications.filter((item) => item.id !== id),
      },
    }));
  }, []);

  const handleOpenPack = useCallback(async (slotId: string) => {
    await authedFetch(`/api/planning/slots/${slotId}/open-pack`, { method: "POST" });
    window.location.href = "/library";
  }, []);

  const handleMarkDone = useCallback(
    async (slotId: string) => {
      await authedFetch(`/api/planning/slots/${slotId}/mark-done`, { method: "POST" });
      await Promise.all([refreshToday(), refreshProgress(), refreshNotifications()]);
    },
    [refreshNotifications, refreshProgress, refreshToday]
  );

  const subtitle = useMemo(() => {
    const week = progress.data.week_number || getWeekNumber(new Date());
    return `${initialDateLabel} · Week ${week} · ${initialTermLabel}`;
  }, [initialDateLabel, initialTermLabel, progress.data.week_number]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/planning/scheme-of-work"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Scheme of work
            </Link>
            <Link
              href="/planning/academic-calendar"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Academic calendar
            </Link>
            <Link
              href="/planning/scheme-of-work#add"
              className="rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3C3489]"
            >
              + Add entry
            </Link>
          </div>
        </div>
      </section>

      <NotificationBannerStack
        notifications={notifications.data.notifications}
        onDismiss={handleDismissNotification}
        onAction={(notification) => {
          const type = notification.notification_type;
          if (type === NotificationType.URGENT && notification.timetable_slot_id) {
            void handleOpenPack(notification.timetable_slot_id);
            return;
          }
          if (type === NotificationType.PREP_WARNING) {
            window.location.href = "/generate";
            return;
          }
          if (notification.action_url) {
            window.location.href = notification.action_url;
          }
        }}
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <TodaysTimeline
          slots={todaySlots.data}
          onOpenPack={(slot) => {
            void handleOpenPack(slot.slot.id);
          }}
          onMarkDone={(slot) => {
            void handleMarkDone(slot.slot.id);
          }}
        />

        <div className="space-y-4">
          <WeekAtGlanceGrid
            slotsByDay={weekData.data.slots_by_day}
            eventsByDay={weekData.data.events_by_day}
            todayLabel={currentDayLabelUtc()}
          />
          <TermProgressPanel
            progress={progress.data}
            loading={progress.loading}
          />
        </div>
      </section>

      <TimetableSetupWizardCard
        status={{
          timetableExists: setup.data.has_timetable,
          slotCount:
            Object.values(weekData.data.slots_by_day).reduce(
              (sum, daySlots) => sum + daySlots.length,
              0
            ) ?? 0,
          hasPreferences: setup.data.has_preferences,
          linkedSlotCount: setup.data.has_linked_slots ? 1 : 0,
        }}
      />

      <ForgeGuideTipCard tipInput={tipInput} />
    </div>
  );
}
