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
import { waLink } from "@/lib/portal/wa-link";
import { MaterialSymbolsLink } from "../salon-shell";
import {
  ReportsClient,
  type ReportData,
  type Bucket,
  type Driver,
  type StylistRow,
  type VipRow,
} from "./reports-client";

/**
 * Founder's own Stitch source for "Reports & Rankings -- Profitability &
 * Yield Intelligence" (Task 412), reading real ledger, visits, stylists and
 * clients instead of the source's hand-written October 2024 numbers --
 * twelfth page converted.
 *
 * ── The window ───────────────────────────────────────────────────────────
 *
 * Month to date, in Malaysia time (1st of this month .. today), compared
 * with the same number of days of last month. His source labelled itself
 * both "Q4 MTD" and "Last 30 Days" -- two different windows on one page.
 * Month to date is the one that lines up with the two RPCs that only take a
 * calendar month (staff_earnings, visit_earnings), so every number on this
 * page speaks about the same days.
 *
 * ── Real ─────────────────────────────────────────────────────────────────
 *
 * Gross takings: ledger_entries, direction in, module payments, reversed
 * entries and reversal rows excluded (same rule party_value / party_debts
 * use). The three-way split is by what the money was for, read from what is
 * actually recorded: category "membership" (collect_membership_fee),
 * a ledger entry a service package was sold against (service_packages.entry_id),
 * and everything else.
 *
 * Revenue drivers: service_performance (his own service words, as typed,
 * done visits only). Stylist rows: visit_earnings (what each stylist did,
 * per line), staff_earnings (commission), appointment start/end for booked
 * hours, hours_worked_of for clocked hours. VIP list: party_value (paid
 * lifetime, reversals excluded) + party_visits (visits / cadence).
 *
 * ── Dropped or made honest, not faked ────────────────────────────────────
 *
 * - "Net Studio Margin 72.8%" and the per-bucket 84% / 46% / 91% margins:
 *   there is no cost for a till sale or a membership anywhere in this
 *   schema, so a margin on those three buckets would be invented.
 * - Retail COGS: the Register records one ledger entry per sale, not the
 *   items, so nothing links a sale to a catalog item's cost.
 * - Formula cost / net margin per service is real ONLY where products were
 *   logged against that service's visit lines (add_visit_product) AND those
 *   products have a cost price (catalog_items.cost_cents, nullable). Where
 *   either is missing the row says so instead of showing a made-up margin.
 * - The service category pills (Technical / Backbar / Styling), the 75%
 *   utilisation target, "Capacity Slack" / "Balanced" verdicts, the 8%
 *   consumable target, PLATINUM / GOLD tiers (invented thresholds), "In
 *   Salon (Station 02)" (no station concept), and the Send Reminder /
 *   Current Ticket buttons (no such actions).
 * - Utilisation is shown only when the stylist has clocked hours, as booked
 *   hours over clocked hours. Nothing here knows a stylist's available
 *   hours otherwise, so no percentage is invented.
 * - Tiers become a rank: "Top 5%" / "Top 20%", computed from the list.
 *
 * Money is owner-only (sees_money): a staff login gets the owner-only
 * notice, same as End of Day Cash.
 */

type Ledger = {
  id: string;
  amount_cents: number;
  category: string;
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
  const monthStartUtc = `${monthStart}T00:00:00+08:00`;
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
    buckets: [],
    consumables: null,
    drivers: [],
    stylists: [],
    studioRevPerHourCents: null,
    vips: [],
    vipClientCount: 0,
    vipTotalClients: 0,
    vipShare: null,
    vipTopCents: 0,
    vipCutoffCents: null,
    census: [],
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
  const [
    ledgerRows,
    pkgRes,
    perfRes,
    productRes,
    visitRes,
    earnRes,
    clockRes,
    apptRows,
    valueRes,
    visitsRes,
    dirRows,
    staffRows,
  ] = await Promise.all([
    fetchAll<Ledger>((from, to) =>
      supabase
        .from("ledger_entries")
        .select("id, amount_cents, category, entry_on, adjusts_id, direction")
        .eq("project_id", projectId)
        .eq("module_key", "payments")
        .gte("entry_on", prevStart)
        .order("entry_on")
        .range(from, to),
    ),
    supabase.from("service_packages").select("entry_id").eq("project_id", projectId).not("entry_id", "is", null),
    supabase.rpc("service_performance", { in_project_id: projectId, in_days: monthLen }),
    supabase
      .from("treatment_products")
      .select(
        "qty, item_id, catalog_items(cost_cents), appointment_lines!inner(service, appointments!inner(status, starts_at, archived_at))",
      )
      .eq("project_id", projectId)
      .not("line_id", "is", null)
      .eq("appointment_lines.appointments.status", "done")
      .gte("appointment_lines.appointments.starts_at", monthStartUtc)
      .is("appointment_lines.appointments.archived_at", null),
    supabase.rpc("visit_earnings", { in_project_id: projectId, in_month: month }),
    supabase.rpc("staff_earnings", { in_project_id: projectId, in_month: month }),
    supabase.rpc("hours_worked_of", { in_project_id: projectId, in_days: monthLen }),
    fetchAll<{ party_id: string | null; staff_id: string | null; starts_at: string; ends_at: string }>((from, to) =>
      supabase
        .from("appointments")
        .select("party_id, staff_id, starts_at, ends_at")
        .eq("project_id", projectId)
        .eq("status", "done")
        .is("archived_at", null)
        .not("staff_id", "is", null)
        .order("starts_at")
        .range(from, to),
    ),
    supabase.rpc("party_value", { in_project_id: projectId }),
    supabase.rpc("party_visits", { in_project_id: projectId }),
    fetchAll<{ id: string; phone: string; whatsapp: string }>((from, to) =>
      supabase
        .from("directory_entries")
        .select("id, phone, whatsapp")
        .eq("project_id", projectId)
        .eq("module_key", "customers")
        .range(from, to),
    ),
    supabase
      .from("directory_entries")
      .select("id, name, status")
      .eq("project_id", projectId)
      .eq("module_key", "staff")
      .is("archived_at", null),
  ]);

  // ── Gross takings, split by what the money was for ─────────────────────
  const reversed = new Set(ledgerRows.map((r) => r.adjusts_id).filter((x): x is string => !!x));
  const live = ledgerRows.filter((r) => r.direction === "in" && !r.adjusts_id && !reversed.has(r.id));
  const packageEntryIds = new Set(
    ((pkgRes.data ?? []) as { entry_id: string | null }[]).map((p) => p.entry_id).filter((x): x is string => !!x),
  );
  const cur = live.filter((r) => r.entry_on >= monthStart && r.entry_on <= todayStr);
  const prev = live.filter((r) => r.entry_on >= prevStart && r.entry_on <= prevEnd);
  const sum = (rows: Ledger[]) => rows.reduce((s, r) => s + Number(r.amount_cents), 0);
  const grossCents = sum(cur);
  const prevGrossCents = sum(prev);
  const momPct = prevGrossCents > 0 ? ((grossCents - prevGrossCents) / prevGrossCents) * 100 : null;

  const kindOf = (r: Ledger): Bucket["key"] =>
    packageEntryIds.has(r.id) ? "prepaid" : r.category === "membership" ? "membership" : "core";
  const bucketCents = { core: 0, membership: 0, prepaid: 0 };
  for (const r of cur) bucketCents[kindOf(r)] += Number(r.amount_cents);
  const buckets: Bucket[] = (
    [
      { key: "core", label: "Services & counter sales" },
      { key: "membership", label: "Memberships" },
      { key: "prepaid", label: "Prepaid packages" },
    ] as const
  ).map((b) => ({
    key: b.key,
    label: b.label,
    cents: bucketCents[b.key],
    pct: grossCents > 0 ? (bucketCents[b.key] / grossCents) * 100 : 0,
  }));

  // ── What was used behind the chair, at the cost price he entered ───────
  type ProductRow = {
    qty: number;
    catalog_items: { cost_cents: number | null } | null;
    appointment_lines: { service: string } | null;
  };
  const productRows = (productRes.data ?? []) as unknown as ProductRow[];
  const costByService = new Map<string, { cents: number; missing: number; used: number }>();
  let consumableCents = 0;
  let consumableMissing = 0;
  for (const p of productRows) {
    const svc = p.appointment_lines?.service ?? "";
    const acc = costByService.get(svc) ?? { cents: 0, missing: 0, used: 0 };
    const unitCost = p.catalog_items?.cost_cents;
    acc.used += 1;
    if (unitCost == null) {
      acc.missing += 1;
      consumableMissing += 1;
    } else {
      const c = Math.round(Number(p.qty) * Number(unitCost));
      acc.cents += c;
      consumableCents += c;
    }
    costByService.set(svc, acc);
  }
  const consumables =
    productRows.length > 0
      ? {
          cents: consumableCents,
          missingCount: consumableMissing,
          absorptionPct: consumableCents > 0 && grossCents > 0 ? (consumableCents / grossCents) * 100 : null,
        }
      : null;

  // ── Revenue drivers: his own service words, biggest takings first ──────
  type Perf = { service: string; times_done: number; total_cents: number };
  const perf = ((perfRes.data ?? []) as Perf[])
    .map((p) => ({ service: p.service, times: Number(p.times_done), total: Number(p.total_cents) }))
    .sort((a, b) => b.total - a.total || a.service.localeCompare(b.service));
  const topTotal = perf[0]?.total ?? 0;
  const drivers: Driver[] = perf.slice(0, 6).map((p, i) => {
    const c = costByService.get(p.service);
    const costKnown = !!c && c.used > 0 && c.missing === 0;
    const perSessionCost = costKnown ? Math.round(c.cents / p.times) : null;
    const avg = p.times > 0 ? Math.round(p.total / p.times) : 0;
    return {
      rank: i + 1,
      service: p.service || "(no name)",
      times: p.times,
      totalCents: p.total,
      avgCents: avg,
      barPct: topTotal > 0 ? (p.total / topTotal) * 100 : 0,
      costNote: !c || c.used === 0 ? "none-logged" : c.missing > 0 ? "cost-missing" : "known",
      formulaCostCents: perSessionCost,
      marginPct:
        perSessionCost != null && avg > 0 ? ((avg - perSessionCost) / avg) * 100 : null,
      profitPerUnitCents: perSessionCost != null ? avg - perSessionCost : null,
    };
  });

  // ── Stylists: what they did, what they are owed, hours booked ──────────
  type VisitE = { staff_id: string; name: string; visits: number; lines: number; did_cents: number };
  type Earn = { party_id: string; commission_cents: number; kind: string };
  type Clock = { staff_id: string; hours: number };
  const visitE = (visitRes.data ?? []) as VisitE[];
  const earn = new Map(((earnRes.data ?? []) as Earn[]).filter((e) => e.kind === "staff").map((e) => [e.party_id, e]));
  const clocked = new Map(((clockRes.data ?? []) as Clock[]).map((c) => [c.staff_id, Number(c.hours)]));
  const roster = new Map(
    ((staffRows.data ?? []) as { id: string; name: string; status: string }[]).map((s) => [s.id, s]),
  );
  const bookedHours = new Map<string, number>();
  for (const a of apptRows) {
    if (!a.staff_id || a.starts_at < monthStartUtc) continue;
    const hrs = (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 3_600_000;
    if (hrs > 0) bookedHours.set(a.staff_id, (bookedHours.get(a.staff_id) ?? 0) + hrs);
  }
  const stylistRows: StylistRow[] = visitE
    .filter((v) => roster.has(v.staff_id))
    .map((v) => {
      const booked = bookedHours.get(v.staff_id) ?? 0;
      const clock = clocked.get(v.staff_id) ?? 0;
      return {
        id: v.staff_id,
        name: v.name,
        role: roster.get(v.staff_id)?.status ?? "",
        visits: Number(v.visits),
        takingsCents: Number(v.did_cents),
        commissionCents: earn.get(v.staff_id)?.commission_cents ?? null,
        bookedHours: booked,
        clockedHours: clock > 0 ? clock : null,
        utilPct: clock > 0 && booked > 0 ? Math.min(100, (booked / clock) * 100) : null,
        revPerHourCents: booked > 0 ? Math.round(Number(v.did_cents) / booked) : null,
        topProducer: false,
      };
    })
    .sort((a, b) => b.takingsCents - a.takingsCents);
  const withRate = stylistRows.filter((s) => s.revPerHourCents != null);
  if (withRate.length >= 2) {
    const best = withRate.reduce((a, b) => (b.revPerHourCents! > a.revPerHourCents! ? b : a));
    best.topProducer = true;
  }
  const totalTakings = stylistRows.reduce((s, r) => s + r.takingsCents, 0);
  const totalBooked = stylistRows.reduce((s, r) => s + r.bookedHours, 0);
  const studioRevPerHourCents = totalBooked > 0 ? Math.round(totalTakings / totalBooked) : null;

  // ── VIPs: who has actually paid the most, all time ─────────────────────
  type Value = { party_id: string; name: string; times_paid: number; total_cents: number };
  type Visit = { party_id: string; visits: number; last_on: string | null; days_since: number | null; usual_gap_days: number | null };
  const value = (valueRes.data ?? []) as Value[]; // already ordered by spend desc
  const visitsBy = new Map(((visitsRes.data ?? []) as Visit[]).map((v) => [v.party_id, v]));
  const dirBy = new Map(dirRows.map((d) => [d.id, d]));
  const n = value.length;
  const vipCount = n === 0 ? 0 : Math.max(1, Math.ceil(n * 0.2));
  const platinumCount = n === 0 ? 0 : Math.max(1, Math.ceil(n * 0.05));
  const topSlice = value.slice(0, vipCount);
  const vipTopCents = topSlice.reduce((s, v) => s + Number(v.total_cents), 0);
  const allCents = value.reduce((s, v) => s + Number(v.total_cents), 0);

  // Most frequent stylist for each VIP (all done visits, all time).
  const vipIds = new Set(topSlice.map((v) => v.party_id));
  const stylistTally = new Map<string, Map<string, number>>();
  for (const a of apptRows) {
    if (!a.party_id || !a.staff_id || !vipIds.has(a.party_id)) continue;
    const t = stylistTally.get(a.party_id) ?? new Map<string, number>();
    t.set(a.staff_id, (t.get(a.staff_id) ?? 0) + 1);
    stylistTally.set(a.party_id, t);
  }
  const staffName = (id: string) => roster.get(id)?.name ?? null;

  const vips: VipRow[] = topSlice.slice(0, 60).map((v, i) => {
    const vis = visitsBy.get(v.party_id);
    const d = dirBy.get(v.party_id);
    const tally = stylistTally.get(v.party_id);
    let prefId: string | null = null;
    let prefN = 0;
    if (tally) for (const [sid, c] of tally) if (c > prefN) { prefId = sid; prefN = c; }
    const days = vis?.days_since ?? null;
    const gap = vis?.usual_gap_days ?? null;
    let cadence: VipRow["cadence"];
    if (days == null) cadence = { text: "No visit on record", tone: "neutral" };
    else if (gap != null && gap > 0 && days > gap)
      cadence = { text: `${days} days ago · ${days - gap} past their usual ${gap}-day cycle`, tone: "late" };
    else if (gap != null && gap > 0) cadence = { text: `${days === 0 ? "Today" : `${days} days ago`} · on their ${gap}-day cycle`, tone: "ok" };
    else cadence = { text: days === 0 ? "Today" : `${days} days ago`, tone: "neutral" };
    return {
      id: v.party_id,
      rank: i + 1,
      tier: i + 1 <= platinumCount ? "Top 5%" : "Top 20%",
      name: v.name,
      phone: d?.phone || d?.whatsapp || "",
      whatsappUrl: waLink(d?.whatsapp || d?.phone, ""),
      visits: vis?.visits ?? 0,
      timesPaid: Number(v.times_paid),
      lifetimeCents: Number(v.total_cents),
      preferredStylist: prefId ? staffName(prefId) : null,
      cadence,
    };
  });

  const census = value.map((v) => {
    const vis = visitsBy.get(v.party_id);
    const d = dirBy.get(v.party_id);
    return {
      name: v.name,
      phone: d?.phone || d?.whatsapp || "",
      visits: vis?.visits ?? 0,
      timesPaid: Number(v.times_paid),
      lifetimeCents: Number(v.total_cents),
      lastOn: vis?.last_on ?? "",
    };
  });

  const data: ReportData = {
    ...empty,
    grossCents,
    prevGrossCents,
    momPct,
    buckets,
    consumables,
    drivers,
    stylists: stylistRows,
    studioRevPerHourCents,
    vips,
    vipClientCount: vipCount,
    vipTotalClients: n,
    vipShare: allCents > 0 ? (vipTopCents / allCents) * 100 : null,
    vipTopCents,
    vipCutoffCents: topSlice.length > 0 ? Number(topSlice[topSlice.length - 1].total_cents) : null,
    census,
  };

  return (
    <>
      <MaterialSymbolsLink />
      <ReportsClient canSeeMoney data={data} />
    </>
  );
}
