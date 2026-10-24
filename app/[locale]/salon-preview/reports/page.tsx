import { redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import {
  displayBusinessName,
  type BusinessContext,
} from "@/lib/templates/industry-template";
import { MaterialSymbolsLink } from "../salon-shell";
import {
  ReportsClient,
  type ReportData,
  type Driver,
  type StylistRow,
} from "./reports-client";

/**
 * Founder's own Stitch source for "Reports & Rankings -- Profitability &
 * Yield Intelligence" (Task 412), reading real ledger, visits and stylists
 * instead of the source's hand-written October 2024 numbers.
 *
 * ── 2026-10 simplification pass (founder-tasks 任务426, cut order item 3) ──
 *
 * His own words: "不希望自己是做到一个很复杂...太贵了 客户是不想要...以实用
 * 好用为主" -- don't chase big-SaaS feature parity, keep it something anyone
 * can pick up. Judged against 重点34 (would a 2-3 person salon's own
 * handwritten notebook have this field?), three blocks on this page failed:
 *
 * - The VIP Pareto card (5%/20% tiers, visit cadence, preferred stylist,
 *   search/filter, client census export): a small salon owner already knows
 *   who his regulars are. Nobody writes a Pareto ranking in a notebook.
 * - Formula-cost / margin per service: real only when products were logged
 *   against a visit AND those products have a cost price on file -- most
 *   shops never fill that in, so most rows just said "no margin shown" and
 *   added noise for no signal.
 * - Stylist utilisation % (booked hours over clocked hours) and revenue
 *   per hour: a useful number for a 20-chair studio with a floor manager,
 *   not for a shop where the owner already knows who's busy.
 *
 * What's left: this month's gross takings vs. the same days last month, a
 * simple "what sold" ranking, and a simple "who did it" ranking -- the two
 * questions a small salon owner actually asks.
 *
 * Nothing backend was touched or deleted. service_performance, visit_earnings,
 * staff_earnings, hours_worked_of, party_value, party_visits, and the
 * cost-price / treatment_products data model all still exist and still work;
 * this page just stopped reading the ones it no longer renders.
 *
 * Money is owner-only (sees_money): a staff login gets the owner-only
 * notice, same as End of Day Cash.
 */

type Ledger = {
  id: string;
  amount_cents: number;
  entry_on: string;
  adjusts_id: string | null;
  direction: "in" | "out";
};

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await build(from, from + 999);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function longDate(s: string, withYear = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(new Date(`${s}T00:00:00Z`));
}

export default async function SalonReportsPreview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);

  const workspace = await loadWorkspace();
  if (!workspace) redirect(`/${locale}/login`);
  const projectId = workspace.projectId;

  const supabase = await createSessionSupabaseClient();

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessName = displayBusinessName(
    (context as BusinessContext | null) ?? {},
  );

  // ── The window: 1st of this month .. today (Malaysia), and the same span
  // of last month. Plain date arithmetic on YYYY-MM-DD strings.
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const month = todayStr.slice(0, 7);
  const monthStart = `${month}-01`;
  const prevStartD = new Date(Date.UTC(ty, tm - 2, 1));
  const prevMonthLength = new Date(Date.UTC(ty, tm - 1, 0)).getUTCDate();
  const prevStart = ymd(prevStartD);
  const prevEnd = ymd(new Date(Date.UTC(ty, tm - 2, Math.min(td, prevMonthLength))));

  const empty: ReportData = {
    businessName,
    monthLabel: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(
      new Date(`${monthStart}T00:00:00Z`),
    ),
    rangeLabel: `${longDate(monthStart)} – ${longDate(todayStr, true)}`,
    prevRangeLabel: `${longDate(prevStart)} – ${longDate(prevEnd, true)}`,
    grossCents: 0,
    prevGrossCents: 0,
    momPct: null,
    drivers: [],
    stylists: [],
  };

  if (!workspace.isOwner) {
    return (
      <>
        <MaterialSymbolsLink />
        <ReportsClient canSeeMoney={false} data={empty} />
      </>
    );
  }

  const monthLen = td; // days elapsed this month, incl. today
  const [ledgerRows, perfRes, visitRes, earnRes, staffRows] = await Promise.all([
    fetchAll<Ledger>((from, to) =>
      supabase
        .from("ledger_entries")
        .select("id, amount_cents, entry_on, adjusts_id, direction")
        .eq("project_id", projectId)
        .eq("module_key", "payments")
        .gte("entry_on", prevStart)
        .order("entry_on")
        .range(from, to),
    ),
    supabase.rpc("service_performance", { in_project_id: projectId, in_days: monthLen }),
    supabase.rpc("visit_earnings", { in_project_id: projectId, in_month: month }),
    supabase.rpc("staff_earnings", { in_project_id: projectId, in_month: month }),
    supabase
      .from("directory_entries")
      .select("id")
      .eq("project_id", projectId)
      .eq("module_key", "staff")
      .is("archived_at", null),
  ]);

  // ── Gross takings, this month vs. same days last month ──────────────────
  const reversed = new Set(ledgerRows.map((r) => r.adjusts_id).filter((x): x is string => !!x));
  const live = ledgerRows.filter((r) => r.direction === "in" && !r.adjusts_id && !reversed.has(r.id));
  const cur = live.filter((r) => r.entry_on >= monthStart && r.entry_on <= todayStr);
  const prev = live.filter((r) => r.entry_on >= prevStart && r.entry_on <= prevEnd);
  const sum = (rows: Ledger[]) => rows.reduce((s, r) => s + Number(r.amount_cents), 0);
  const grossCents = sum(cur);
  const prevGrossCents = sum(prev);
  const momPct = prevGrossCents > 0 ? ((grossCents - prevGrossCents) / prevGrossCents) * 100 : null;

  // ── What sold: his own service words, biggest takings first ────────────
  type Perf = { service: string; times_done: number; total_cents: number };
  const perf = ((perfRes.data ?? []) as Perf[])
    .map((p) => ({ service: p.service, times: Number(p.times_done), total: Number(p.total_cents) }))
    .sort((a, b) => b.total - a.total || a.service.localeCompare(b.service));
  const topTotal = perf[0]?.total ?? 0;
  const drivers: Driver[] = perf.slice(0, 6).map((p, i) => ({
    rank: i + 1,
    service: p.service || "(no name)",
    times: p.times,
    totalCents: p.total,
    avgCents: p.times > 0 ? Math.round(p.total / p.times) : 0,
    barPct: topTotal > 0 ? (p.total / topTotal) * 100 : 0,
  }));

  // ── Who did it: what each stylist brought in, what they're owed ────────
  type VisitE = { staff_id: string; name: string; visits: number; lines: number; did_cents: number };
  type Earn = { party_id: string; commission_cents: number; kind: string };
  const visitE = (visitRes.data ?? []) as VisitE[];
  const earn = new Map(((earnRes.data ?? []) as Earn[]).filter((e) => e.kind === "staff").map((e) => [e.party_id, e]));
  const roster = new Set(((staffRows.data ?? []) as { id: string }[]).map((s) => s.id));
  const stylists: StylistRow[] = visitE
    .filter((v) => roster.has(v.staff_id))
    .map((v) => ({
      id: v.staff_id,
      name: v.name,
      visits: Number(v.visits),
      takingsCents: Number(v.did_cents),
      commissionCents: earn.get(v.staff_id)?.commission_cents ?? null,
    }))
    .sort((a, b) => b.takingsCents - a.takingsCents);

  const data: ReportData = {
    ...empty,
    grossCents,
    prevGrossCents,
    momPct,
    drivers,
    stylists,
  };

  return (
    <>
      <MaterialSymbolsLink />
      <ReportsClient canSeeMoney data={data} />
    </>
  );
}
