"use client";

import type { TodaySlot } from "@/lib/planning/types";

type Props = {
  slots: TodaySlot[];
  loading?: boolean;
  error?: string | null;
  onOpenPack: (slotId: string) => Promise<void> | void;
  onMarkDone: (slotId: string) => Promise<void> | void;
};

function slotStyle(status: TodaySlot["status"]) {
  if (status === "done") {
    return {
      dot: "bg-[#639922]",
      border: "border-l-[#C0DD97]",
      card: "bg-slate-100/75",
    };
  }
  if (status === "now") {
    return {
      dot: "bg-[#534AB7]",
      border: "border-l-[#534AB7]",
      card: "bg-[#EEEDFE]",
    };
  }
  if (status === "next") {
    return {
      dot: "bg-[#BA7517]",
      border: "border-l-[#BA7517]",
      card: "bg-[#FAEEDA]",
    };
  }
  return {
    dot: "bg-slate-400",
    border: "border-l-slate-300",
    card: "bg-slate-50",
  };
}

export default function TodaysTimeline({
  slots,
  loading = false,
  error = null,
  onOpenPack,
  onMarkDone,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Today&apos;s timetable</h2>
      <p className="mt-1 text-xs text-slate-600">Your classes in timeline order</p>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : slots.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          No classes scheduled for today.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {slots.map((slot) => {
            const style = slotStyle(slot.status);
            return (
              <div key={slot.slot.id} className="grid grid-cols-[88px_1fr] gap-3">
                <div className="pt-1 text-xs text-slate-600">
                  <div className="font-medium text-slate-900">{slot.start_time}</div>
                  <div>{slot.duration_minutes} mins</div>
                </div>

                <div className="relative">
                  <span
                    className={`absolute -left-[22px] top-2 h-2.5 w-2.5 rounded-full ${style.dot}`}
                    aria-hidden
                  />
                  <div
                    className={`rounded-xl border border-slate-200 border-l-4 ${style.border} ${style.card} p-3`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{slot.class_name}</div>
                        <div className="text-xs text-slate-600">
                          {slot.subject}
                          {slot.topic ? ` · ${slot.topic}` : ""}
                          {slot.week_number ? ` · Week ${slot.week_number}` : ""}
                        </div>
                      </div>

                      {slot.status !== "done" ? (
                        <button
                          type="button"
                          onClick={() => void onMarkDone(slot.slot.id)}
                          className="rounded-lg border border-[#C0DD97] px-2 py-1 text-[11px] font-medium text-[#3B6D11] hover:bg-[#EAF3DE]"
                        >
                          Mark as done
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {slot.status === "done" ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                          >
                            View notes
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                          >
                            Rate lesson
                          </button>
                        </>
                      ) : slot.status === "now" || (slot.status === "next" && slot.lesson_exists) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void onOpenPack(slot.slot.id)}
                            className="rounded-lg bg-[#534AB7] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#3C3489]"
                          >
                            Open lesson pack
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                          >
                            Worksheet
                          </button>
                        </>
                      ) : slot.status === "next" && !slot.lesson_exists ? (
                        <button
                          type="button"
                          className="rounded-lg bg-[#BA7517] px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                        >
                          Generate lesson first
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void onOpenPack(slot.slot.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                        >
                          View pack
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
