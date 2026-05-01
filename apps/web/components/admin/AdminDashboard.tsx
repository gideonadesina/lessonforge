"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  LifeBuoy,
  LineChart,
  RefreshCw,
  Search,
  Send,
  Users,
  Zap,
} from "lucide-react";
import type { AdminDashboardData, AdminPaymentRow, AdminSchoolRow, AdminUserRow } from "@/lib/admin/metrics";
import type { CampaignSnapshot } from "@/lib/feedback-campaign";

type SortKey = keyof AdminUserRow;

function fmt(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not available yet";
  if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  return String(value);
}

function money(value: number, currency = "NGN") {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

function DateText({ value }: { value: string | null | undefined }) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    if (!value) {
      setFormatted("Not available yet");
      return;
    }

    const parsed = new Date(value);
    setFormatted(
      Number.isNaN(parsed.getTime())
        ? "Not available yet"
        : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    );
  }, [value]);

  return <>{formatted}</>;
}

function DateTimeText({ value }: { value: string | null | undefined }) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    if (!value) {
      setFormatted("Not available yet");
      return;
    }

    const parsed = new Date(value);
    setFormatted(
      Number.isNaN(parsed.getTime())
        ? "Not available yet"
        : parsed.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
    );
  }, [value]);

  return <>{formatted}</>;
}

function toneClasses(tone?: string) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (tone === "yellow") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
  if (tone === "red") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300";
  return "border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)]";
}

function statusPill(status: string) {
  const className =
    status === "Active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "Idle"
      ? "bg-amber-100 text-amber-700"
      : status === "Churned"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function creditPill(balance: unknown) {
  const value = Number(balance);
  const tone = !Number.isFinite(value)
    ? "bg-slate-100 text-slate-600"
    : value === 0
    ? "bg-rose-100 text-rose-700"
    : value <= 5
    ? "bg-amber-100 text-amber-700"
    : "bg-emerald-100 text-emerald-700";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{fmt(balance)}</span>;
}

function MiniBars({
  rows,
  valueKey,
  moneyMode = false,
}: {
  rows: Array<{ label: string; revenue?: number; total?: number }>;
  valueKey: "revenue" | "total";
  moneyMode?: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] ?? 0)));
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const value = Number(row[valueKey] ?? 0);
        return (
          <div key={row.label} className="grid grid-cols-[56px_1fr_90px] items-center gap-3 text-xs">
            <span className="text-[var(--text-secondary)]">{row.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--card-alt)]">
              <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </div>
            <span className="text-right font-semibold text-[var(--text-primary)]">
              {moneyMode ? money(value) : new Intl.NumberFormat("en-US").format(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <h2 className="text-lg font-black text-[var(--text-primary)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("signupDate");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? users.filter((user) =>
          [user.name, user.email, user.role, user.schoolName, user.status]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : users;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "number" ? av : Date.parse(String(av ?? ""));
      const bn = typeof bv === "number" ? bv : Date.parse(String(bv ?? ""));
      const result =
        Number.isFinite(an) && Number.isFinite(bn)
          ? an - bn
          : String(av ?? "").localeCompare(String(bv ?? ""));
      return direction === "asc" ? result : -result;
    });
  }, [direction, query, sortKey, users]);

  function setSort(next: SortKey) {
    if (sortKey === next) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(next);
    setDirection("desc");
  }

  const headers: Array<[SortKey, string]> = [
    ["name", "Name"],
    ["email", "Email"],
    ["role", "Role"],
    ["schoolName", "School"],
    ["schoolCode", "Code"],
    ["creditType", "Credit type"],
    ["currentCreditBalance", "Credits"],
    ["totalGenerations", "Generations"],
    ["paidOrFree", "Paid"],
    ["totalAmountPaid", "Amount"],
    ["signupDate", "Signup"],
    ["lastActiveDate", "Last active"],
    ["status", "Status"],
  ];

  return (
    <div className="space-y-3">
      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card-alt)] py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-400"
        />
      </label>
      <div className="overflow-x-auto">
        <table className="min-w-[1500px] w-full text-left text-sm">
          <thead className="text-xs uppercase text-[var(--text-tertiary)]">
            <tr>
              {headers.map(([key, label]) => (
                <th key={key} className="whitespace-nowrap px-3 py-2">
                  <button type="button" onClick={() => setSort(key)} className="inline-flex items-center gap-1 font-bold">
                    {label}
                    {sortKey === key ? direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((user) => (
              <tr key={user.id} className="align-top">
                <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{user.name}</td>
                <td className="px-3 py-3 text-[var(--text-secondary)]">{user.email}</td>
                <td className="px-3 py-3">{user.role}</td>
                <td className="px-3 py-3">{user.schoolName}</td>
                <td className="px-3 py-3">{user.schoolCode}</td>
                <td className="px-3 py-3">{user.creditType}</td>
                <td className="px-3 py-3">{creditPill(user.currentCreditBalance)}</td>
                <td className="px-3 py-3">{user.totalGenerations}</td>
                <td className="px-3 py-3">{user.paidOrFree}</td>
                <td className="px-3 py-3">{money(user.totalAmountPaid)}</td>
                <td className="px-3 py-3"><DateText value={user.signupDate} /></td>
                <td className="px-3 py-3"><DateText value={user.lastActiveDate} /></td>
                <td className="px-3 py-3">{statusPill(user.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsTable({ payments }: { payments: AdminPaymentRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full text-left text-sm">
        <thead className="text-xs uppercase text-[var(--text-tertiary)]">
          <tr>
            {["User", "Email", "Plan", "Amount", "Date", "Reference", "Source"].map((item) => (
              <th key={item} className="px-3 py-2">{item}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {payments.slice(0, 50).map((payment) => (
            <tr key={`${payment.source}-${payment.reference}`}>
              <td className="px-3 py-3 font-semibold">{payment.userName}</td>
              <td className="px-3 py-3 text-[var(--text-secondary)]">{payment.email}</td>
              <td className="px-3 py-3">{payment.plan}</td>
              <td className="px-3 py-3">{money(payment.amount, payment.currency)}</td>
              <td className="px-3 py-3"><DateText value={payment.date} /></td>
              <td className="px-3 py-3 font-mono text-xs">{payment.reference}</td>
              <td className="px-3 py-3">{payment.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedbackCampaignSection({
  snapshot,
  onSnapshot,
}: {
  snapshot: CampaignSnapshot;
  onSnapshot: (snapshot: CampaignSnapshot) => void;
}) {
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState<string | null>(snapshot.message);

  async function refreshCampaign() {
    const response = await fetch("/api/admin/feedback-campaign", { cache: "no-store" });
    if (!response.ok) return;
    const next = (await response.json()) as CampaignSnapshot;
    onSnapshot(next);
    setMessage(next.message);
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshCampaign();
    }, 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendNow() {
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/feedback-campaign", {
        method: "POST",
        cache: "no-store",
      });
      const json = (await response.json()) as {
        ok?: boolean;
        message?: string;
        snapshot?: CampaignSnapshot;
      };
      if (json.snapshot) onSnapshot(json.snapshot);
      setMessage(json.message ?? (response.ok ? "Campaign run completed." : "Campaign run failed."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign run failed.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendTest() {
    setSendingTest(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/feedback-campaign", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "test" }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        message?: string;
        snapshot?: CampaignSnapshot;
      };
      if (json.snapshot) onSnapshot(json.snapshot);
      setMessage(json.message ?? (response.ok ? "Test email sent." : "Test email failed."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test email failed.");
    } finally {
      setSendingTest(false);
    }
  }

  function exportCsv() {
    window.location.href = "/api/admin/feedback-campaign/export";
  }

  const rows = snapshot.logs;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-4 lg:flex-1">
          <SmallStat icon={Send} label="Total Sent" value={snapshot.stats.totalSent} />
          <SmallStat icon={LineChart} label="Total Opened" value={snapshot.stats.totalOpened} />
          <SmallStat icon={CheckCircle2} label="Total Replied" value={snapshot.stats.totalReplied} tone="green" />
          <SmallStat icon={AlertTriangle} label="Total Not Replied" value={snapshot.stats.totalNotReplied} tone="yellow" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSendNow}
            disabled={sending || sendingTest || !snapshot.tableReady}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--card-alt)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending" : "Send Campaign Now"}
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sending || sendingTest}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--card-alt)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sendingTest ? "Sending Test" : "Send Test Email"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!snapshot.tableReady}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--card-alt)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm text-[var(--text-secondary)]">
        Next Scheduled Send: <span className="font-semibold text-[var(--text-primary)]"><DateTimeText value={snapshot.nextScheduledSend} /></span>
      </div>

      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead className="text-xs uppercase text-[var(--text-tertiary)]">
            <tr>
              {["Name", "Email", "First Email Sent", "Follow-up Sent", "Opened", "Clicked", "Replied"].map((item) => (
                <th key={item} className="px-3 py-2">{item}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <tr key={row.email}>
                <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{row.teacher_name}</td>
                <td className="px-3 py-3 text-[var(--text-secondary)]">{row.email}</td>
                <td className="px-3 py-3"><DateTimeText value={row.first_email_sent_at} /></td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.follow_up_sent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {row.follow_up_sent ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.opened ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {row.opened ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.clicked ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {row.clicked ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.replied ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {row.replied ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-3 py-4 text-sm text-[var(--text-secondary)]" colSpan={7}>
                  No campaign logs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function firstName(name: string) {
  return name.split(/\s+/)[0] || "there";
}

function CreditTopUpSection({
  users,
  schools,
  onDone,
}: {
  users: AdminUserRow[];
  schools: AdminSchoolRow[];
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ type: "user" | "school"; id: string; label: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const userRows = users
      .filter((user) => [user.name, user.email, user.schoolName].join(" ").toLowerCase().includes(q))
      .slice(0, 6)
      .map((user) => ({ type: "user" as const, id: user.id, label: `${user.name} - ${user.email}`, meta: `Current: ${fmt(user.currentCreditBalance)} credits` }));
    const schoolRows = schools
      .filter((school) => [school.schoolName, school.principalEmail, school.schoolCode].join(" ").toLowerCase().includes(q))
      .slice(0, 6)
      .map((school) => ({ type: "school" as const, id: school.id, label: `${school.schoolName} - ${school.principalEmail}`, meta: `Current: ${fmt(school.schoolCreditBalance)} shared credits` }));
    return [...userRows, ...schoolRows].slice(0, 10);
  }, [query, schools, users]);

  async function topUp() {
    if (!selected) {
      setMessage("Choose a teacher or school first.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/credits/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: selected.type, targetId: selected.id, amount: Number(amount) }),
      });
      const json = (await response.json()) as { error?: string; name?: string; creditsAdded?: number; newBalance?: number };
      if (!response.ok) throw new Error(json.error ?? "Credit top-up failed.");
      setMessage(`Added ${json.creditsAdded} credits to ${json.name}. New balance: ${json.newBalance}.`);
      setAmount("");
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Credit top-up failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
            placeholder="Search teacher or school by name or email"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card-alt)] py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-400"
          />
        </label>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="numeric"
          placeholder="Credits"
          className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
        />
        <button
          type="button"
          onClick={topUp}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CreditCard className="h-4 w-4" />
          {saving ? "Adding" : "Add Credits"}
        </button>
      </div>
      {query && !selected ? (
        <div className="grid gap-2 md:grid-cols-2">
          {matches.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => {
                setSelected({ type: item.type, id: item.id, label: item.label });
                setQuery(item.label);
              }}
              className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-left text-sm hover:border-violet-300"
            >
              <span className="font-bold text-[var(--text-primary)]">{item.type === "school" ? "School" : "User"}</span>
              <span className="ml-2 text-[var(--text-secondary)]">{item.label}</span>
              <span className="block text-xs text-[var(--text-tertiary)]">{item.meta}</span>
            </button>
          ))}
        </div>
      ) : null}
      {selected ? <p className="text-sm font-semibold text-emerald-700">Selected: {selected.label}</p> : null}
      {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
    </div>
  );
}

function NoGenerationAlertSection({ users }: { users: AdminUserRow[] }) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});

  async function send(user: AdminUserRow) {
    setSendingId(user.id);
    try {
      const response = await fetch("/api/admin/no-generation-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = (await response.json()) as { error?: string; message?: string };
      setSent((current) => ({ ...current, [user.id]: response.ok ? json.message ?? "Sent." : json.error ?? "Send failed." }));
    } catch (error) {
      setSent((current) => ({ ...current, [user.id]: error instanceof Error ? error.message : "Send failed." }));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {users.slice(0, 40).map((user) => (
        <div key={user.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{user.email} - signed up <DateText value={user.signupDate} /></p>
            {sent[user.id] ? <p className="mt-1 text-xs font-semibold text-emerald-700">{sent[user.id]}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => send(user)}
            disabled={sendingId === user.id}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-bold hover:bg-[var(--card)] disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sendingId === user.id ? "Sending" : `Email ${firstName(user.name)}`}
          </button>
        </div>
      ))}
      {!users.length ? <p className="text-sm text-[var(--text-secondary)]">No users currently match this alert.</p> : null}
    </div>
  );
}

function CreditHealthSection({ schools }: { schools: AdminSchoolRow[] }) {
  return (
    <div className="space-y-2">
      {schools.map((school) => (
        <div key={school.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <span className="font-bold">{school.schoolName}</span>
            <span>{fmt(school.schoolCreditBalance)} of {fmt(school.creditAllowance)} credits left ({fmt(school.percentRemaining)}%)</span>
          </div>
          <p className="text-xs">Principal: {school.principalName} - {school.principalEmail}</p>
        </div>
      ))}
      {!schools.length ? <p className="text-sm text-[var(--text-secondary)]">No schools are below 20% of allowance.</p> : null}
    </div>
  );
}

function ActivityHeatmap({ rows }: { rows: AdminDashboardData["activityHeatmap"] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[780px] grid-cols-[44px_repeat(24,1fr)] gap-1 text-xs">
        <div />
        {Array.from({ length: 24 }, (_, hour) => <div key={hour} className="text-center text-[var(--text-tertiary)]">{hour}</div>)}
        {days.map((day) => (
          <div key={day} className="contents">
            <div className="py-1 font-bold text-[var(--text-secondary)]">{day}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = rows.find((row) => row.day === day && row.hour === hour)?.count ?? 0;
              const opacity = count ? 0.2 + (count / max) * 0.8 : 0.06;
              return <div key={`${day}-${hour}`} title={`${day} ${hour}:00 - ${count}`} className="h-6 rounded bg-violet-700" style={{ opacity }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function RetentionSection({ retention }: { retention: AdminDashboardData["retention"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SmallStat icon={Users} label="Day 1 return" value={`${retention.day1}/${retention.eligibleDay1}`} />
      <SmallStat icon={Users} label="Day 3 return" value={`${retention.day3}/${retention.eligibleDay3}`} />
      <SmallStat icon={Users} label="Day 7 return" value={`${retention.day7}/${retention.eligibleDay7}`} />
    </div>
  );
}

function RevenueFunnelSection({ steps }: { steps: AdminDashboardData["revenueFunnel"] }) {
  const max = Math.max(1, ...steps.map((step) => step.count));
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.label} className="grid gap-2 text-sm md:grid-cols-[180px_1fr_150px] md:items-center">
          <div className="font-bold">{step.label}</div>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--card-alt)]">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(3, (step.count / max) * 100)}%` }} />
          </div>
          <div className="text-[var(--text-secondary)]">{fmt(step.count)} {step.dropoffFromPrevious !== null ? `- dropoff ${fmt(step.dropoffFromPrevious)}` : ""}</div>
          {step.note ? <p className="md:col-span-3 text-xs text-[var(--text-tertiary)]">{step.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

function AdminNotificationComposer({
  users,
  schools,
  releaseMode = false,
}: {
  users: AdminUserRow[];
  schools: AdminSchoolRow[];
  releaseMode?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success" | "reminder">("info");
  const [recipientMode, setRecipientMode] = useState<"all" | "teachers" | "principals" | "school" | "user">("all");
  const [schoolId, setSchoolId] = useState("");
  const [userId, setUserId] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          type,
          recipientMode: releaseMode ? "all" : recipientMode,
          schoolId,
          userId,
          releaseNote: releaseMode,
        }),
      });
      const json = (await response.json()) as { error?: string; sent?: number };
      if (!response.ok) throw new Error(json.error ?? "Notification send failed.");
      setStatus(`Sent to ${json.sent ?? 0} user${json.sent === 1 ? "" : "s"}.`);
      setTitle("");
      setMessage("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Notification send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={releaseMode ? "Release note title" : "Notification title"}
          className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
        />
        {!releaseMode ? (
          <select
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
            className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="success">Success</option>
            <option value="reminder">Reminder</option>
          </select>
        ) : null}
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={releaseMode ? "Write release notes..." : "Write notification message..."}
        rows={4}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
      />
      {!releaseMode ? (
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={recipientMode}
            onChange={(event) => setRecipientMode(event.target.value as typeof recipientMode)}
            className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
          >
            <option value="all">All users</option>
            <option value="teachers">All teachers</option>
            <option value="principals">All principals</option>
            <option value="school">Specific school</option>
            <option value="user">Individual user</option>
          </select>
          <select
            value={schoolId}
            onChange={(event) => setSchoolId(event.target.value)}
            disabled={recipientMode !== "school"}
            className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:opacity-50"
          >
            <option value="">Choose school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.schoolName}</option>
            ))}
          </select>
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={recipientMode !== "user"}
            className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:opacity-50"
          >
            <option value="">Choose user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending" : releaseMode ? "Publish Release Notes" : "Send Notification"}
        </button>
        {status ? <p className="text-sm font-semibold text-[var(--text-secondary)]">{status}</p> : null}
      </div>
    </div>
  );
}

export default function AdminDashboard({ data: initialData }: { data: AdminDashboardData }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function refreshData() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error(`Refresh failed (${response.status})`);
      const nextData = (await response.json()) as AdminDashboardData;
      setData(nextData);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text-primary)] md:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-violet-700">Founder Admin</p>
            <h1 className="text-3xl font-black">LessonForge God-Eye Dashboard</h1>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <button
              type="button"
              onClick={refreshData}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--card-alt)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
            <p className="text-sm text-[var(--text-secondary)]">Last updated: <DateTimeText value={data.lastUpdated} /></p>
            {refreshError ? <p className="text-xs font-semibold text-rose-600">{refreshError}</p> : null}
          </div>
        </header>

        <div className={`rounded-2xl border p-4 ${toneClasses(data.intelligence.tone)}`}>
          <div className="flex items-start gap-3">
            {data.intelligence.tone === "green" ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}
            <p className="font-semibold">{data.intelligence.message}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.stats.map((stat) => (
            <div key={stat.label} className={`rounded-2xl border p-4 shadow-sm ${toneClasses(stat.tone)}`}>
              <p className="text-xs font-bold uppercase tracking-wide opacity-75">{stat.label}</p>
              <p className="mt-2 text-2xl font-black">
                {stat.label.toLowerCase().includes("revenue") && typeof stat.value === "number" ? money(stat.value) : fmt(stat.value)}
              </p>
              {stat.note ? <p className="mt-1 text-xs opacity-70">{stat.note}</p> : null}
            </div>
          ))}
        </div>

        <Section title="Manual Credit Top-up">
          <CreditTopUpSection users={data.users} schools={data.schools} onDone={refreshData} />
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Notifications">
            <AdminNotificationComposer users={data.users} schools={data.schools} />
          </Section>

          <Section title="Release Notes">
            <AdminNotificationComposer users={data.users} schools={data.schools} releaseMode />
          </Section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="No Generation Alerts">
            <NoGenerationAlertSection users={data.noGenerationAlerts} />
          </Section>

          <Section title="Credits Health">
            <CreditHealthSection schools={data.credits.lowSchoolHealth} />
          </Section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="User Activity Heatmap">
            <ActivityHeatmap rows={data.activityHeatmap} />
          </Section>

          <Section title="Retention Tracker">
            <RetentionSection retention={data.retention} />
          </Section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Generation Quality Signal">
            <div className="grid gap-4 md:grid-cols-2">
              <SimpleList
                title="Generated once and never returned"
                rows={data.generation.quality.generatedOnceNeverReturned.map((user) => `${user.name} - ${user.email}`)}
              />
              <SimpleList
                title="Regular generators"
                rows={data.generation.quality.regularGenerators.map((user) => `${user.name} - ${user.totalGenerations} generations`)}
              />
            </div>
          </Section>

          <Section title="Referral Tracker">
            <div className="space-y-2">
              {data.referrals.slice(0, 25).map((row) => (
                <div key={`${row.referredUserEmail}-${row.referredByCode}`} className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm">
                  <p className="font-semibold">{row.referredUserName} - {row.referredUserEmail}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Via {row.referredByCode} from {row.referrerName} - {row.referrerEmail}</p>
                </div>
              ))}
              {!data.referrals.length ? <p className="text-sm text-[var(--text-secondary)]">No referral signups yet.</p> : null}
            </div>
          </Section>
        </div>

        <Section title="Revenue Conversion Funnel">
          <RevenueFunnelSection steps={data.revenueFunnel} />
        </Section>

        <Section title="Users">
          <UsersTable users={data.users} />
        </Section>

        <Section title="Feedback Campaign">
          <FeedbackCampaignSection
            snapshot={data.feedbackCampaign}
            onSnapshot={(feedbackCampaign) =>
              setData((current) => ({ ...current, feedbackCampaign }))
            }
          />
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Financial Overview">
            <div className="grid gap-3 sm:grid-cols-3">
              <SmallStat icon={CreditCard} label="Paid users" value={data.users.filter((u) => u.paidOrFree === "Paid").length} />
              <SmallStat icon={Users} label="Free users" value={data.users.filter((u) => u.paidOrFree === "Free").length} />
              <SmallStat icon={LineChart} label="Payments" value={data.payments.length} />
            </div>
            <div className="mt-5">
              <MiniBars rows={data.revenueTrend} valueKey="revenue" moneyMode />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SimpleList
                title="Revenue per school"
                rows={
                  data.revenueBySchool.length
                    ? data.revenueBySchool.map((item) => `${item.name} — ${money(item.revenue)}`)
                    : ["Not available yet"]
                }
              />
              <SimpleList
                title="Revenue per teacher"
                rows={
                  data.revenueByTeacher.length
                    ? data.revenueByTeacher.map((item) => `${item.name} — ${money(item.revenue)}`)
                    : ["Not available yet"]
                }
              />
            </div>
            <div className="mt-5">
              <PaymentsTable payments={data.payments} />
            </div>
          </Section>

          <Section title="Generation Analytics">
            <div className="grid gap-3 sm:grid-cols-4">
              <SmallStat icon={Zap} label="Lessons" value={data.generation.lessons} />
              <SmallStat icon={Zap} label="Slides" value={data.generation.slides} />
              <SmallStat icon={Zap} label="Worksheets" value={data.generation.worksheets} />
              <SmallStat icon={Zap} label="Total" value={data.generation.total} />
            </div>
            <div className="mt-5">
              <MiniBars rows={data.generation.trend} valueKey="total" />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SimpleList title="Top teachers" rows={data.generation.topTeachers.map((t) => `${t.name} — ${t.total}`)} />
              <SimpleList
                title="Most generated topics"
                rows={data.generation.topTopics?.map((t) => `${t.topic} — ${t.count}`) ?? ["Topic analytics not available yet."]}
              />
            </div>
          </Section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Credits Intelligence">
            <div className="grid gap-3 sm:grid-cols-3">
              <SmallStat icon={CreditCard} label="School credit users" value={data.credits.schoolCreditUsers} />
              <SmallStat icon={CreditCard} label="Personal credit users" value={data.credits.personalCreditUsers} />
              <SmallStat icon={CheckCircle2} label="With credits" value={data.credits.usersWithCredits} />
              <SmallStat icon={AlertTriangle} label="0 credits" value={data.credits.zeroCreditUsers} tone="red" />
              <SmallStat icon={AlertTriangle} label="Low credits" value={data.credits.lowCreditUsers} tone="yellow" />
              <SmallStat icon={AlertTriangle} label="Ran out, not recharged" value={data.credits.ranOutNotRecharged} tone="red" />
            </div>
          </Section>

          <Section title="New Users Feed">
            <div className="space-y-2">
              {data.newUsers.slice(0, 12).map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {user.email} · {user.role} · <DateText value={user.signupDate} />
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${user.totalGenerations > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {user.totalGenerations > 0 ? "Generated" : "No generation"}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Support Inbox">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <LifeBuoy className="mt-0.5 h-5 w-5" />
            <p className="text-sm font-semibold">{data.support.message}</p>
          </div>
        </Section>

        <Section title="School Overview">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-tertiary)]">
                <tr>
                  {["School", "Code", "Principal", "Email", "Teachers", "Credits", "Generations", "Plan", "Created"].map((item) => (
                    <th key={item} className="px-3 py-2">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.schools.map((school) => (
                  <tr key={`${school.schoolName}-${school.schoolCode}`}>
                    <td className="px-3 py-3 font-semibold">{school.schoolName}</td>
                    <td className="px-3 py-3">{school.schoolCode}</td>
                    <td className="px-3 py-3">{school.principalName}</td>
                    <td className="px-3 py-3">{school.principalEmail}</td>
                    <td className="px-3 py-3">{fmt(school.teacherCount)}</td>
                    <td className="px-3 py-3">{creditPill(school.schoolCreditBalance)}</td>
                    <td className="px-3 py-3">{fmt(school.totalGenerations)}</td>
                    <td className="px-3 py-3">{school.planPurchased}</td>
                    <td className="px-3 py-3"><DateText value={school.createdAt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Progress Intelligence">
          <div className="grid gap-3 md:grid-cols-3">
            <SmallStat icon={LineChart} label="User growth WoW" value={data.progress.userGrowthRate} />
            <SmallStat icon={LineChart} label="Revenue growth WoW" value={data.progress.revenueGrowthRate} />
            <SmallStat icon={Building2} label="Trend" value={data.progress.trend} />
            <SmallStat icon={Building2} label="Best school" value={data.progress.bestPerformingSchool} />
            <SmallStat icon={Users} label="Most active teacher" value={data.progress.mostActiveTeacher} />
            <SmallStat icon={AlertTriangle} label="Biggest churn risk" value={data.progress.biggestChurnRisk} tone="red" />
          </div>
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300">
            {data.progress.recommendation}
          </div>
          <div className="mt-4">
            <SimpleList
              title="Churn risk"
              rows={
                data.progress.churnRisks.length
                  ? data.progress.churnRisks.map((user) => (
                      <span key={`${user.email}-${user.lastGenerationDate}`}>
                        {user.name} · {user.email} · last generation <DateText value={user.lastGenerationDate} />
                      </span>
                    ))
                  : ["No zero-credit users with generation inactivity over 14 days."]
              }
            />
          </div>
          <div className="mt-4 text-xs text-[var(--text-secondary)]">
            Unavailable or approximate: {data.unavailable.join("; ")}.
          </div>
          <div className="mt-3 text-xs text-[var(--text-secondary)]">
            Data sources: {data.sourceTables.map((item) => `${item.section}: ${item.tables.join(", ")}`).join("; ")}.
          </div>
        </Section>
      </div>
    </div>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: unknown;
  tone?: "red" | "yellow" | "green";
}) {
  return (
    <div className={`rounded-xl border p-3 ${toneClasses(tone)}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-75">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-lg font-black">{fmt(value)}</p>
    </div>
  );
}

function SimpleList({ title, rows }: { title: string; rows: React.ReactNode[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] p-3">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
        {rows.length ? rows.slice(0, 10).map((row, index) => <p key={typeof row === "string" ? row : index}>{row}</p>) : <p>Not available yet</p>}
      </div>
    </div>
  );
}
