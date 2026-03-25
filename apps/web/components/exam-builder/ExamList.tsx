"use client";

type ExamListItem = {
  id: string;
  exam_title: string;
  subject: string;
  class_or_grade: string;
  exam_type: string;
  exam_alignment: string;
  objective_question_count: number;
  theory_question_count: number;
  duration_mins: number;
  total_marks: number;
  created_at: string;
};

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ExamList({
  loading,
  items,
  selectedId,
  onOpen,
  onReuse,
  onDelete,
  onRefresh,
}: {
  loading: boolean;
  items: ExamListItem[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onReuse: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Saved Exams</h2>
          <p className="text-sm text-slate-600">Open, reuse, print, or remove previously generated exams.</p>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Loading exams...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No exams yet. Generate your first formal exam paper above.
          </div>
        ) : (
          items.map((item) => {
            const active = selectedId === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 ${
                  active ? "border-violet-300 bg-violet-50/40" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.exam_title}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {item.subject} | {item.class_or_grade} | {item.exam_type} | {item.exam_alignment}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.objective_question_count} objective + {item.theory_question_count} theory |{" "}
                      {item.duration_mins} mins | {item.total_marks} marks
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{timeAgo(item.created_at)}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onOpen(item.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => onReuse(item.id)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Reuse
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
