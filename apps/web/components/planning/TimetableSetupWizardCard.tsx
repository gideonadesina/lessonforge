"use client";

type SetupStatus = {
  has_timetable: boolean;
  has_slots: boolean;
  has_preferences: boolean;
  has_linked_slots: boolean;
};

function stepClass(state: "done" | "active" | "pending") {
  if (state === "done") return "border border-[#C0DD97] bg-[#EAF3DE]";
  if (state === "active") return "border border-[#AFA9EC] bg-[#EEEDFE]";
  return "border border-slate-200 bg-slate-50";
}

function circleClass(state: "done" | "active" | "pending") {
  if (state === "done") return "bg-[#639922] text-white border-[#639922]";
  if (state === "active") return "bg-[#534AB7] text-white border-[#534AB7]";
  return "bg-white text-slate-500 border-slate-300";
}

export default function TimetableSetupWizardCard({
  status,
  loading = false,
  error = null,
}: {
  status: SetupStatus;
  loading?: boolean;
  error?: string | null;
}) {
  const steps = [
    {
      title: "Term structure",
      subtitle: "Set weeks in term, current term, and academic year.",
      done: status.has_timetable,
    },
    {
      title: "Daily timetable",
      subtitle: "Add class slots by weekday and start time.",
      done: status.has_slots,
    },
    {
      title: "Notification preferences",
      subtitle: "Choose reminder timing and delivery method.",
      done: status.has_preferences,
    },
    {
      title: "Scheme of work link",
      subtitle: "Connect topics to class timetable slots.",
      done: status.has_linked_slots,
    },
  ];

  const activeIndex = steps.findIndex((step) => !step.done);
  const resolvedActiveIndex = activeIndex === -1 ? -1 : activeIndex;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Timetable setup</h3>
        <p className="mt-1 text-xs text-slate-600">
          Required to enable class reminders
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Checking setup progress...
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
        {steps.map((step, index) => {
          const state: "done" | "active" | "pending" = step.done
            ? "done"
            : resolvedActiveIndex === index
            ? "active"
            : "pending";
          const badge = step.done
            ? "Done"
            : state === "active"
            ? "Active"
            : "Pending";

          return (
            <div
              key={step.title}
              className={`flex items-center justify-between rounded-lg p-3 ${stepClass(
                state
              )}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${circleClass(
                    state
                  )}`}
                >
                  {step.done ? "✓" : index + 1}
                </span>

                <div>
                  <div className="text-sm font-medium text-slate-900">{step.title}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{step.subtitle}</div>
                  {state === "active" || state === "pending" ? (
                    <a
                      href={`/planning/timetable-setup?step=${index + 1}`}
                      className="mt-1 inline-flex text-xs font-medium text-[#534AB7] hover:underline"
                    >
                      Continue →
                    </a>
                  ) : null}
                </div>
              </div>

              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700">
                {badge}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
