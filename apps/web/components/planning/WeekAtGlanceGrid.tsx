"use client";

import type { AcademicEventType, TodaySlot } from "@/lib/planning/types";

type DayLabel = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

type EventItem = {
  id: string;
  title: string;
  event_type: AcademicEventType | string;
  event_date: string;
};

const DAYS: DayLabel[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const SUBJECT_COLORS: Record<string, { bg: string; text: string }> = {
  physics: { bg: "bg-[#E6F1FB]", text: "text-[#185FA5]" },
  chemistry: { bg: "bg-[#EAF3DE]", text: "text-[#3B6D11]" },
  maths: { bg: "bg-[#FAEEDA]", text: "text-[#854F0B]" },
  mathematics: { bg: "bg-[#FAEEDA]", text: "text-[#854F0B]" },
  biology: { bg: "bg-[#FBEAF0]", text: "text-[#993556]" },
  english: { bg: "bg-[#FAECE7]", text: "text-[#993C1D]" },
};

function eventDotColor(eventType: string) {
  if (eventType === "holiday") return "bg-[#BA7517]";
  if (eventType === "exam") return "bg-[#E24B4A]";
  if (eventType === "assessment") return "bg-[#639922]";
  if (eventType === "meeting") return "bg-[#534AB7]";
  if (eventType === "deadline") return "bg-[#534AB7]";
  if (eventType === "resumption") return "bg-[#639922]";
  return "bg-slate-500";
}

function subjectStyle(subject: string) {
  const key = subject.trim().toLowerCase();
  const style = SUBJECT_COLORS[key];
  if (style) return style;
  return { bg: "bg-slate-100", text: "text-slate-700" };
}

export default function WeekAtGlanceGrid({
  slotsByDay,
  eventsByDay,
  loading,
  error,
}: {
  slotsByDay: Record<string, TodaySlot[]>;
  eventsByDay: Record<string, EventItem[]>;
  loading: boolean;
  error: string | null;
}) {
  const nowDay = new Date().getUTCDay();
  const todayLabel: DayLabel =
    nowDay === 1
      ? "Mon"
      : nowDay === 2
      ? "Tue"
      : nowDay === 3
      ? "Wed"
      : nowDay === 4
      ? "Thu"
      : "Fri";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">This week at a glance</h3>

      {loading ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          {DAYS.map((day) => (
            <div key={day} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
            {DAYS.map((day) => {
              const daySlots = slotsByDay[day] ?? [];
              const dayEvents = eventsByDay[day] ?? [];
              const active = day === todayLabel;

              return (
                <div
                  key={day}
                  className={[
                    "rounded-lg border p-2",
                    active
                      ? "border-[#534AB7] bg-[#EEEDFE] ring-1 ring-[#534AB7]"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase text-slate-700">
                      {day}
                    </span>
                    {dayEvents.length > 0 ? (
                      <span
                        className={[
                          "inline-block h-2.5 w-2.5 rounded-full",
                          eventDotColor(String(dayEvents[0]?.event_type ?? "other")),
                        ].join(" ")}
                        aria-label="Calendar event"
                      />
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    {daySlots.length === 0 ? (
                      <div className="text-[11px] text-slate-500">No classes</div>
                    ) : (
                      daySlots.map((slot) => {
                        const style = subjectStyle(slot.subject);
                        return (
                          <div
                            key={slot.slot.id}
                            className={[
                              "rounded-md px-2 py-1 text-[11px]",
                              style.bg,
                              style.text,
                            ].join(" ")}
                          >
                            <div className="font-medium">{slot.class_name}</div>
                            <div>{slot.start_time.slice(0, 5)}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            {[
              ["Physics", "bg-[#E6F1FB] text-[#185FA5]"],
              ["Chemistry", "bg-[#EAF3DE] text-[#3B6D11]"],
              ["Maths", "bg-[#FAEEDA] text-[#854F0B]"],
              ["Biology", "bg-[#FBEAF0] text-[#993556]"],
              ["English", "bg-[#FAECE7] text-[#993C1D]"],
            ].map(([label, cls]) => (
              <span key={label} className={`rounded-md px-2 py-1 ${cls}`}>
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
