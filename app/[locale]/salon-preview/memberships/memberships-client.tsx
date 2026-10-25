"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PrepaidTabs, SalonSidebar } from "../salon-shell";

export type MemberRow = {
  id: string;
  partyId: string;
  name: string;
  phone: string;
  plan: string;
  feeCents: number;
  startedOn: string;
  nextDueOn: string;
  archived: boolean;
  overdue: boolean;
  paidCents: number;
  paymentCount: number;
  lastPaidOn: string | null;
};

export type PlanCard = {
  name: string;
  clients: number;
  minFeeCents: number;
  maxFeeCents: number;
  collectedCents: number;
  overdue: number;
  nextDue: { on: string; name: string } | null;
  popular: boolean;
};

export type MembershipData = {
  businessName: string;
  projectId: string;
  todayStr: string;
  kpi: {
    active: number;
    newThisMonth: number;
    monthlyCents: number;
    collectedThisMonthCents: number;
    overdue: number;
    avgMonths: number | null;
  };
  plans: PlanCard[];
  rows: MemberRow[];
  customers: { id: string; name: string }[];
  planSuggestions: { name: string; feeCents: number }[];
  payments: { paidOn: string; name: string; plan: string; amountCents: number }[];
};

type Tab = "all" | "active" | "overdue" | "cancelled";
type Form = {
  clientQuery: string;
  partyId: string;
  plan: string;
  fee: string;
  startedOn: string;
  error: string | null;
  saving: boolean;
};

const PAGE = 12;
const DAY_MS = 86_400_000;

function rm(cents: number) {
  const v = cents / 100;
  return `RM ${v.toLocaleString("en-MY", {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtDate(s: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${s}T00:00:00Z`),
  );
}
const dayNum = (s: string) => Math.floor(new Date(`${s}T00:00:00Z`).getTime() / DAY_MS);

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const LABEL = "text-[11px] font-medium text-[#71717a] uppercase tracking-wider";
const FIELD =
  "h-9 w-full rounded-md border border-[#e4e4e7] bg-[#fcfcfd] px-3 text-xs text-[#09090b] outline-none focus:border-[#09090b] transition-colors placeholder:text-[#a1a1aa]";

export function MembershipsClient({ canSeeMoney, data }: { canSeeMoney: boolean; data: MembershipData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  // One idempotency key per membership until its collect succeeds, so pressing
  // "Collect" again (double click, a retry after a slow network) collects once.
  const keys = useRef(new Map<string, string>());
  const inflight = useRef(false);

  const counts = useMemo(
    () => ({
      all: data.rows.length,
      active: data.rows.filter((r) => !r.archived).length,
      overdue: data.rows.filter((r) => r.overdue).length,
      cancelled: data.rows.filter((r) => r.archived).length,
    }),
    [data.rows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (tab === "all" ||
          (tab === "active" && !r.archived) ||
          (tab === "overdue" && r.overdue) ||
          (tab === "cancelled" && r.archived)) &&
        (!q || r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q) || r.plan.toLowerCase().includes(q)),
    );
  }, [data.rows, tab, search]);

  /** Runs one write. Returns the database's own message when it failed, null when it worked. */
  const run = async (
    id: string,
    call: () => PromiseLike<{ error: { message: string } | null }>,
    opts?: { quiet?: boolean },
  ): Promise<string | null> => {
    if (inflight.current) return "Still saving the last change.";
    inflight.current = true;
    setBusy(id);
    setError(null);
    const { error: err } = await call();
    inflight.current = false;
    setBusy(null);
    if (err) {
      // The new-membership dialog shows its own message; the page banner would sit behind it.
      if (!opts?.quiet) setError(err.message);
      return err.message;
    }
    router.refresh();
    return null;
  };

  const collect = async (r: MemberRow) => {
    let key = keys.current.get(r.id);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(r.id, key);
    }
    const supabase = createBrowserSupabaseClient();
    const failed = await run(r.id, () =>
      supabase.rpc("collect_membership_fee", { in_membership_id: r.id, in_idempotency_key: key }),
    );
    if (!failed) keys.current.delete(r.id);
  };

  const setArchived = async (r: MemberRow, archived: boolean) => {
    const supabase = createBrowserSupabaseClient();
    await run(r.id, () => supabase.rpc("set_membership_archived", { in_id: r.id, in_archived: archived }));
  };

  const openForm = (prefill?: { plan: string; feeCents: number }) =>
    setForm({
      clientQuery: "",
      partyId: "",
      plan: prefill?.plan ?? "",
      fee: prefill ? String(prefill.feeCents / 100) : "",
      startedOn: data.todayStr,
      error: null,
      saving: false,
    });

  const create = async () => {
    if (!form || inflight.current) return;
    const cents = Math.round(Number(form.fee) * 100);
    if (!form.partyId) return setForm({ ...form, error: "Pick which client this membership is for." });
    if (!form.plan.trim()) return setForm({ ...form, error: "Say what the plan is called." });
    if (!Number.isFinite(cents) || cents <= 0) return setForm({ ...form, error: "Say how much the plan costs a month." });
    setForm({ ...form, error: null, saving: true });
    const supabase = createBrowserSupabaseClient();
    const failed = await run(
      "new",
      () =>
        supabase.rpc("add_membership", {
          in_project_id: data.projectId,
          in_party_id: form.partyId,
          in_plan_name: form.plan.trim(),
          in_monthly_fee_cents: cents,
          in_started_on: form.startedOn || null,
        }),
      { quiet: true },
    );
    setForm((f) => (failed === null ? null : f ? { ...f, saving: false, error: failed } : f));
  };

  const exportLedger = () =>
    downloadCsv(`membership-payments-${data.todayStr}.csv`, [
      ["Paid on", "Client", "Plan", "Amount (RM)"],
      ...data.payments.map((p) => [p.paidOn, p.name, p.plan, (p.amountCents / 100).toFixed(2)]),
    ]);

  const formClients = useMemo(() => {
    if (!form) return [];
    const q = form.clientQuery.trim().toLowerCase();
    return data.customers.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 100);
  }, [form, data.customers]);

  const todayNum = dayNum(data.todayStr);

  return (
    <div
      className="bg-[#fafafa] text-[#09090b] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="packages-and-prepaid" businessName={data.businessName} subtitle="Operations" />
      <div className="pl-64">
        <main data-print-sheet className="w-full min-h-screen bg-[#fafafa]">
          <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col gap-7">
            <div className="-mb-2">
              <PrepaidTabs active="memberships" />
            </div>
            <div className="flex items-center gap-2 text-xs text-[#71717a]">
              <span className="font-medium text-[#09090b]">{data.businessName}</span>
              <span>/</span>
              <span>Memberships</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#e4e4e7] pb-6">
              <div>
                <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#09090b]">Memberships &amp; VIP Passes</h1>
                <p className="text-xs text-[#71717a] mt-1">
                  Manage recurring client subscriptions and collect each month&apos;s fee.
                </p>
              </div>
              {canSeeMoney && (
                <div className="flex items-center gap-2.5 print:hidden">
                  <button
                    type="button"
                    onClick={exportLedger}
                    className="h-9 px-3.5 rounded-md border border-[#e4e4e7] bg-white hover:bg-[#f4f4f5] text-xs font-medium text-[#09090b] transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#71717a]">download</span>
                    <span>Export Ledger</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openForm()}
                    className="h-9 px-3.5 rounded-md bg-[#09090b] hover:bg-[#27272a] text-xs font-medium text-white transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>New Membership</span>
                  </button>
                </div>
              )}
            </div>

            {!canSeeMoney ? (
              <div className="rounded-lg border border-[#e4e4e7] bg-white p-10 text-center text-xs text-[#71717a] shadow-sm">
                Memberships are only visible to the business owner.
              </div>
            ) : (
              <>
                {error && (
                  <div
                    role="alert"
                    data-testid="page-error"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-center justify-between gap-3"
                  >
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="font-medium underline print:hidden">
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Four numbers */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div data-testid="kpi-active" className="p-4 rounded-lg bg-white border border-[#e4e4e7] shadow-sm">
                    <span className={LABEL}>Active Memberships</span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tracking-tight tabular-nums">{data.kpi.active}</span>
                      {data.kpi.newThisMonth > 0 && (
                        <span className="text-[11px] font-medium text-emerald-600">+{data.kpi.newThisMonth} this month</span>
                      )}
                    </div>
                  </div>
                  <div data-testid="kpi-monthly" className="p-4 rounded-lg bg-white border border-[#e4e4e7] shadow-sm">
                    <span className={LABEL}>Monthly Recurring</span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold tracking-tight tabular-nums">{rm(data.kpi.monthlyCents)}</span>
                      <span className="text-xs text-[#71717a]">/ mo</span>
                    </div>
                  </div>
                  <div data-testid="kpi-collected" className="p-4 rounded-lg bg-white border border-[#e4e4e7] shadow-sm">
                    <span className={LABEL}>Collected This Month</span>
                    <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl font-semibold tracking-tight tabular-nums">{rm(data.kpi.collectedThisMonthCents)}</span>
                      {data.kpi.overdue > 0 ? (
                        <span className="text-[11px] text-amber-600 font-medium">{data.kpi.overdue} overdue</span>
                      ) : data.kpi.active > 0 ? (
                        <span className="text-[11px] text-emerald-600 font-medium">None overdue</span>
                      ) : null}
                    </div>
                  </div>
                  <div data-testid="kpi-length" className="p-4 rounded-lg bg-white border border-[#e4e4e7] shadow-sm">
                    <span className={LABEL}>Avg Membership Length</span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold tracking-tight tabular-nums">
                        {data.kpi.avgMonths != null ? data.kpi.avgMonths.toFixed(1) : "—"}
                      </span>
                      {data.kpi.avgMonths != null && <span className="text-xs text-[#71717a]">months</span>}
                    </div>
                  </div>
                </div>

                {/* Plans, grouped from the memberships themselves */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold tracking-tight">Active Membership Plans</h2>
                    <span className="text-xs text-[#71717a]">
                      {data.plans.length} recurring {data.plans.length === 1 ? "plan" : "plans"} active
                    </span>
                  </div>
                  {data.plans.length === 0 ? (
                    <div
                      data-testid="plans-empty"
                      className="rounded-lg border border-dashed border-[#d4d4d8] bg-white p-10 text-center text-xs text-[#71717a]"
                    >
                      No active memberships yet. Add one and its plan appears here.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {data.plans.map((p) => (
                        <div
                          key={p.name}
                          data-testid="plan-card"
                          className={
                            "relative p-5 rounded-lg bg-white flex flex-col justify-between shadow-sm " +
                            (p.popular ? "border-2 border-[#09090b]" : "border border-[#e4e4e7]")
                          }
                        >
                          {p.popular && (
                            <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-[#09090b] text-white text-[10px] font-semibold tracking-wide uppercase">
                              Most Popular
                            </div>
                          )}
                          <div className="flex flex-col pt-1">
                            <div className="flex items-center justify-between gap-3 mb-2.5">
                              <span className="text-xs font-semibold text-[#09090b] truncate">{p.name}</span>
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-[#f4f4f5] text-[#52525b] shrink-0">
                                {p.clients} {p.clients === 1 ? "member" : "members"}
                              </span>
                            </div>
                            <div className="mt-2 flex items-baseline gap-1.5">
                              {p.minFeeCents !== p.maxFeeCents && <span className="text-xs text-[#71717a]">from</span>}
                              <span className="text-2xl font-semibold text-[#09090b] tabular-nums tracking-tight">{rm(p.minFeeCents)}</span>
                              <span className="text-xs text-[#71717a]">/ month</span>
                            </div>
                            <span className="text-[11px] text-[#a1a1aa] mt-0.5">
                              {p.nextDue ? `Next fee due ${fmtDate(p.nextDue.on)} · ${p.nextDue.name}` : "Fees collected by hand"}
                            </span>
                            <div className="mt-4 pt-4 border-t border-[#f4f4f5] flex flex-col gap-2 text-xs text-[#52525b]">
                              <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[15px] text-[#09090b] mt-0.5">check</span>
                                <span>{rm(p.collectedCents)} collected to date</span>
                              </div>
                              <div className="flex items-start gap-2">
                                {p.overdue > 0 ? (
                                  <>
                                    <span className="material-symbols-outlined text-[15px] text-amber-600 mt-0.5">schedule</span>
                                    <span className="text-amber-700">{p.overdue} overdue</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-[15px] text-[#09090b] mt-0.5">check</span>
                                    <span>Everyone is paid up</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-5 pt-4 border-t border-[#f4f4f5] flex items-center justify-between">
                            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active • {p.clients} {p.clients === 1 ? "client" : "clients"}
                            </span>
                            <button
                              type="button"
                              onClick={() => openForm({ plan: p.name, feeCents: p.minFeeCents })}
                              className={
                                "h-8 px-3 rounded text-xs font-medium transition-colors print:hidden " +
                                (p.popular
                                  ? "bg-[#09090b] hover:bg-[#27272a] text-white"
                                  : "border border-[#e4e4e7] hover:bg-[#f4f4f5] text-[#09090b]")
                              }
                            >
                              Add member
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ledger */}
                <div className="rounded-lg border border-[#e4e4e7] bg-white shadow-sm">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f4f4f5]">
                    <div>
                      <h3 className="text-sm font-semibold">Members &amp; Fee Ledger</h3>
                      <p className="text-xs text-[#71717a] mt-0.5">
                        {counts.active} active {counts.active === 1 ? "membership" : "memberships"} · fees are collected by hand each month
                      </p>
                    </div>
                    {data.rows.length > 0 && (
                      <div className="relative print:hidden">
                        <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-[#71717a]">search</span>
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setShown(PAGE);
                          }}
                          aria-label="Search memberships"
                          placeholder="Search client, phone, or plan..."
                          className="h-8 pl-8 pr-3 w-64 rounded-md border border-[#e4e4e7] bg-[#fcfcfd] text-xs text-[#09090b] outline-none focus:border-[#09090b] transition-colors placeholder:text-[#a1a1aa]"
                        />
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-b border-[#f4f4f5] flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-1">
                      {(
                        [
                          ["all", `All (${counts.all})`],
                          ["active", `Active (${counts.active})`],
                          ["overdue", `Overdue (${counts.overdue})`],
                          ["cancelled", `Cancelled (${counts.cancelled})`],
                        ] as [Tab, string][]
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setTab(key);
                            setShown(PAGE);
                          }}
                          className={
                            "px-2.5 py-1 rounded text-xs font-medium transition-colors " +
                            (tab === key ? "bg-[#09090b] text-white" : "text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#09090b]")
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="text-[11px] text-[#71717a]">
                      Showing {Math.min(shown, visible.length)} of {visible.length}
                    </span>
                  </div>

                  {data.rows.length === 0 ? (
                    <div data-testid="ledger-empty" className="p-10 text-center text-xs text-[#71717a]">
                      No memberships yet. Press &quot;New Membership&quot; to put a client on a monthly plan.
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="p-10 text-center text-xs text-[#71717a]">No membership matches that.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider bg-[#fafafa] border-b border-[#f4f4f5]">
                          <tr>
                            <th className="py-3 px-4">Client Name</th>
                            <th className="py-3 px-4">Plan</th>
                            <th className="py-3 px-4">Billing Cycle</th>
                            <th className="py-3 px-4">Last Paid</th>
                            <th className="py-3 px-4 text-right">Total Paid</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right print:hidden">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f4f4f5]">
                          {visible.slice(0, shown).map((r) => {
                            const late = r.overdue ? todayNum - dayNum(r.nextDueOn) : 0;
                            const working = busy === r.id;
                            return (
                              <tr key={r.id} data-testid="member-row" className="hover:bg-[#fcfcfc] transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-[#09090b]">{r.name}</span>
                                    {r.phone && <span className="text-[11px] text-[#71717a]">{r.phone}</span>}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-[#09090b] font-medium">
                                  {r.plan}
                                  <div className="text-[11px] font-normal text-[#71717a] tabular-nums">{rm(r.feeCents)} / month</div>
                                </td>
                                <td className="py-3 px-4 text-[#71717a]">
                                  {r.archived ? (
                                    <span>Started {fmtDate(r.startedOn)}</span>
                                  ) : (
                                    <>
                                      <span>Monthly • next due {fmtDate(r.nextDueOn)}</span>
                                      {r.overdue && (
                                        <div className="text-[11px] text-amber-700">
                                          {late} {late === 1 ? "day" : "days"} overdue
                                        </div>
                                      )}
                                    </>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-[#71717a]">{r.lastPaidOn ? fmtDate(r.lastPaidOn) : "Not yet"}</td>
                                <td className="py-3 px-4 text-right font-semibold text-[#09090b] tabular-nums">{rm(r.paidCents)}</td>
                                <td className="py-3 px-4">
                                  {r.archived ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f4f4f5] text-[#52525b] border border-[#e4e4e7]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#a1a1aa]" />
                                      Cancelled
                                    </span>
                                  ) : r.overdue ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      Payment Due
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      Active
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right print:hidden">
                                  <div className="inline-flex items-center gap-1.5">
                                    {r.archived ? (
                                      <button
                                        type="button"
                                        disabled={working}
                                        onClick={() => setArchived(r, false)}
                                        className="h-7 px-2.5 rounded border border-[#e4e4e7] hover:bg-[#f4f4f5] text-[11px] font-medium text-[#09090b] transition-colors disabled:opacity-50"
                                      >
                                        Reactivate
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          disabled={working}
                                          onClick={() => collect(r)}
                                          aria-label={`Collect ${rm(r.feeCents)} from ${r.name}`}
                                          className={
                                            "h-7 px-2.5 rounded text-[11px] font-medium transition-colors disabled:opacity-50 " +
                                            (r.overdue
                                              ? "bg-[#09090b] hover:bg-[#27272a] text-white"
                                              : "border border-[#e4e4e7] hover:bg-[#f4f4f5] text-[#09090b]")
                                          }
                                        >
                                          {working ? "Collecting…" : `Collect ${rm(r.feeCents)}`}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={working}
                                          onClick={() => setArchived(r, true)}
                                          aria-label={`Cancel ${r.name}'s membership`}
                                          className="h-7 px-2 rounded text-[11px] font-medium text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#09090b] transition-colors disabled:opacity-50"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="p-3 border-t border-[#f4f4f5] flex items-center justify-between text-xs text-[#71717a]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-[#71717a]">info</span>
                      <span>Fees are collected by hand. Automatic debit needs a payment gateway.</span>
                    </div>
                    {visible.length > shown && (
                      <button
                        type="button"
                        onClick={() => setShown((n) => n + PAGE)}
                        className="px-2.5 py-1 rounded border border-[#e4e4e7] bg-white text-xs text-[#09090b] hover:bg-[#f4f4f5] transition-colors font-medium print:hidden"
                      >
                        Show more ({visible.length - shown} left)
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {form && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 print:hidden"
          onClick={() => !form.saving && setForm(null)}
        >
          <div
            role="dialog"
            aria-label="New membership"
            className="w-full max-w-md rounded-lg bg-white border border-[#e4e4e7] shadow-xl p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-sm font-semibold">New Membership</h2>
              <p className="text-xs text-[#71717a] mt-0.5">Put a client on a monthly plan. The first fee is due on the start date.</p>
            </div>

            {/* A div, not a label: two controls (a filter box and the list it
                narrows) share this heading, and one label cannot name both. */}
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>Client</span>
              <input
                type="text"
                value={form.clientQuery}
                onChange={(e) => setForm({ ...form, clientQuery: e.target.value, partyId: "", error: null })}
                placeholder="Type to find a client..."
                aria-label="Find client"
                className={FIELD}
              />
              <select
                aria-label="Client"
                value={form.partyId}
                onChange={(e) => setForm({ ...form, partyId: e.target.value, error: null })}
                className={FIELD}
                size={Math.min(5, Math.max(2, formClients.length))}
              >
                {formClients.length === 0 && <option value="" disabled>No client matches that</option>}
                {formClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Plan name</span>
              <input
                type="text"
                list="plan-names"
                value={form.plan}
                onChange={(e) => {
                  const plan = e.target.value;
                  const known = data.planSuggestions.find((p) => p.name.toLowerCase() === plan.trim().toLowerCase());
                  setForm({ ...form, plan, fee: !form.fee && known ? String(known.feeCents / 100) : form.fee, error: null });
                }}
                placeholder="e.g. VIP Monthly"
                aria-label="Plan name"
                className={FIELD}
              />
              <datalist id="plan-names">
                {data.planSuggestions.map((p) => (
                  <option key={p.name} value={p.name} />
                ))}
              </datalist>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Monthly fee (RM)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.fee}
                  onChange={(e) => setForm({ ...form, fee: e.target.value, error: null })}
                  aria-label="Monthly fee"
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Starts on</span>
                <input
                  type="date"
                  value={form.startedOn}
                  onChange={(e) => setForm({ ...form, startedOn: e.target.value, error: null })}
                  aria-label="Start date"
                  className={FIELD}
                />
              </label>
            </div>

            {form.error && (
              <p role="alert" data-testid="form-error" className="text-xs text-red-700">
                {form.error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={form.saving}
                onClick={() => setForm(null)}
                className="h-9 px-3.5 rounded-md border border-[#e4e4e7] bg-white hover:bg-[#f4f4f5] text-xs font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={form.saving}
                onClick={create}
                className="h-9 px-3.5 rounded-md bg-[#09090b] hover:bg-[#27272a] text-xs font-medium text-white transition-colors disabled:opacity-50"
              >
                {form.saving ? "Saving…" : "Create Membership"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
