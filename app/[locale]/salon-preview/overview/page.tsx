import Link from "next/link";
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
import { ringgit } from "@/lib/portal/live-rows";
import { todayMYT } from "@/lib/portal/record-validity";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/* `Date.now()`/`new Date()` directly inside a component body is a lint error
 * here (react-hooks/purity) -- calling them from an ordinary top-level
 * function instead is the established pattern (see `todayMyt()` in
 * app/[locale]/portal/(app)/attendance/page.tsx). This one only ever
 * constructs from an already-computed date STRING, never the wall clock. */
function dayLabelOf(dateStr: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateStr}T12:00:00+08:00`));
}

/**
 * Founder's own Stitch source for "Salon Overview" (Task 405, 2026-09-23),
 * now reading his real data instead of the sample numbers he designed with.
 *
 * ── 2026-09-24: this design replaces the old one, not just sits beside it ──
 *
 * He corrected a real mistake here: two new backend features (staff tips,
 * customer memberships) got built into the OLD generic portal today, on the
 * assumption this page was still a disconnected pitch demo. It is not --
 * this design is meant to become the live system. Auth, workspace and real
 * queries below are the first page converted; the other ten still need the
 * same pass (see the founder-tasks entry this session wrote for the order).
 *
 * ── WHAT STAYED REAL, WHAT GOT DROPPED, AND WHY (read before "fixing" a gap) ─
 *
 * Real, straight off existing tables -- no new backend needed:
 *   - guest counts, staff count, revenue, receipts, low stock, the two lists.
 * Dropped, not approximated, because the product has no fact to report:
 *   - "In Chair" vs "Waiting Lounge" -- no seated-vs-waiting state exists.
 *   - "Drawer Balanced" -- nobody has counted the till yet today (count_till
 *     exists, but claiming "balanced" without a real count would be a lie
 *     the till itself could contradict an hour later).
 *   - "WA Confirmed" / "On Route" / "Walk-in Request" tags -- no WhatsApp
 *     integration exists yet (task 11/176). Replaced with the one real
 *     signal this product already has: `arrived_at`.
 *   - per-stylist "tier" (Senior/Master/Creative/Associate) -- no such field
 *     on a staff record. Dropped rather than invented.
 *   - per-stylist "Projected" revenue -- an appointment that hasn't happened
 *     has no appointment_lines row yet, so there is no honest number to
 *     project. Shown instead: what's actually been recorded against them
 *     today, labelled as that, not as a forecast.
 *   - the receipt-row print/WhatsApp icon button -- would have been a
 *     button that does nothing, which this codebase does not ship.
 */

type ApptRow = {
  id: string;
  party: string;
  service: string;
  starts_at: string;
  status: string;
  arrived_at: string | null;
  staff_id: string | null;
  module_key: string;
};

export default async function SalonOverviewPreview({
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

  // Malaysia has no daylight saving and is always UTC+8 -- a fixed offset
  // is a conversion, not a guess.
  const todayStr = todayMYT();
  const dayStartUtc = `${todayStr}T00:00:00+08:00`;
  const dayEndUtc = `${todayStr}T23:59:59.999+08:00`;
  const dayLabel = dayLabelOf(todayStr);

  const [
    { data: apptRows },
    { data: staffRows },
    { data: ledgerRows },
    { data: stockRows },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, party, service, starts_at, status, arrived_at, staff_id, module_key",
      )
      .eq("project_id", projectId)
      .eq("kind", "booking")
      .is("archived_at", null)
      .gte("starts_at", dayStartUtc)
      .lte("starts_at", dayEndUtc)
      .order("starts_at", { ascending: true }),
    supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", projectId)
      .eq("module_key", "staff")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("ledger_entries")
      .select("id, doc_no, party, amount_cents, method")
      .eq("project_id", projectId)
      .eq("direction", "in")
      .eq("entry_on", todayStr)
      .is("adjusts_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("stock_on_hand")
      .select("item_id, name, on_hand, reorder_at")
      .eq("project_id", projectId),
  ]);

  const appts = (apptRows ?? []) as ApptRow[];
  const staff = (staffRows ?? []) as { id: string; name: string }[];
  const receipts = (ledgerRows ?? []) as {
    id: string;
    doc_no: string | null;
    party: string;
    amount_cents: number;
    method: string;
  }[];
  const stock = (stockRows ?? []) as {
    item_id: string;
    name: string;
    on_hand: number;
    reorder_at: number | null;
  }[];

  const doneCount = appts.filter((a) => a.status === "done").length;
  const cancelledOrNoShow = appts.filter(
    (a) => a.status === "cancelled" || a.status === "no_show",
  ).length;
  const activeToday = appts.length - cancelledOrNoShow;
  /* "Today's Schedule" is the day's whole queue, not just people who haven't
   * arrived -- someone who arrived but isn't done yet is still part of
   * today's flow (that's what the "Arrived" tag on their row is for). Only
   * done/cancelled/no_show drop off, since doneCount already accounts for
   * finished guests and a cancelled slot isn't happening at all. */
  const upcoming = appts.filter((a) => a.status === "booked");
  const notArrivedCount = upcoming.filter((a) => !a.arrived_at).length;
  const arrivedNotDoneCount = upcoming.length - notArrivedCount;

  const staffWithBookingToday = new Set(
    appts.filter((a) => a.staff_id).map((a) => a.staff_id as string),
  );
  const workloadPct = staff.length
    ? Math.round((staffWithBookingToday.size / staff.length) * 100)
    : 0;

  const revenueTodayCents = receipts.reduce((n, r) => n + r.amount_cents, 0);

  // 「Recorded today」 per staff member -- appointment_lines for TODAY's
  // appointments, grouped by who did the work. Empty for anyone with no
  // lines yet, which is the honest state for a booking that hasn't
  // happened -- not zero, not a guess.
  const apptIdsToday = appts.map((a) => a.id);
  const { data: lineRows } = apptIdsToday.length
    ? await supabase
        .from("appointment_lines")
        .select("staff_id, price_cents")
        .in("appointment_id", apptIdsToday)
    : { data: [] };
  const earnedByStaff = new Map<string, number>();
  for (const l of (lineRows ?? []) as {
    staff_id: string | null;
    price_cents: number | null;
  }[]) {
    if (!l.staff_id || !l.price_cents) continue;
    earnedByStaff.set(
      l.staff_id,
      (earnedByStaff.get(l.staff_id) ?? 0) + l.price_cents,
    );
  }
  const bookingsByStaff = new Map<string, number>();
  for (const a of appts) {
    if (!a.staff_id) continue;
    bookingsByStaff.set(a.staff_id, (bookingsByStaff.get(a.staff_id) ?? 0) + 1);
  }
  const staffRun = staff
    .map((s) => ({
      id: s.id,
      name: s.name,
      bookings: bookingsByStaff.get(s.id) ?? 0,
      earnedCents: earnedByStaff.get(s.id) ?? 0,
    }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 4);

  const lowStock = stock
    .filter((s) => s.reorder_at != null && s.on_hand <= s.reorder_at)
    .sort((a, b) => a.on_hand - (a.reorder_at ?? 0) - (b.on_hand - (b.reorder_at ?? 0)))
    .slice(0, 2);

  const methodTotals = new Map<string, number>();
  for (const r of receipts) {
    const key = r.method.trim() || "Unspecified";
    methodTotals.set(key, (methodTotals.get(key) ?? 0) + r.amount_cents);
  }
  const methodSplit = [...methodTotals.entries()].sort((a, b) => b[1] - a[1]);
  const methodShades = ["#000000", "#5e5e67", "#c8c5cb", "#e8e8ec"];

  const staffNameOf = (id: string | null) =>
    id ? staff.find((s) => s.id === id)?.name ?? null : null;

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="overview" businessName={businessName} subtitle="Operations" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full pt-0 bg-[#f9f9fd] min-h-screen">
            <div className="flex flex-col w-full">
              <div className="p-8 max-w-[1560px] mx-auto w-full space-y-8">
                {/* Top Header Area */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#eeedf1]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em] font-medium">
                      <span>Operations</span>
                      <span>/</span>
                      <span className="text-[#000000] font-medium">{businessName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#000000]">
                        Salon Overview
                      </h1>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="px-3.5 py-2 rounded bg-[#f3f3f7] text-[13.5px] leading-5 font-normal text-[#5e5e67]">
                      {dayLabel}
                    </div>
                  </div>
                </header>

                {/* Top KPI Metric Cards */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Metric 1: Today's Guest Flow */}
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between h-36">
                    <div className="flex items-start justify-between gap-2 text-[#5e5e67]">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase">
                        Today&apos;s Flow (今日客流)
                      </span>
                      <span className="material-symbols-outlined text-[18px] shrink-0">group</span>
                    </div>
                    <div>
                      <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#000000] tabular-nums">
                        {activeToday} {activeToday === 1 ? "Guest" : "Guests"}
                      </div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                        {notArrivedCount} Upcoming · {arrivedNotDoneCount} Arrived · {doneCount} Completed
                      </p>
                    </div>
                  </div>

                  {/* Metric 2: Stylist Workload */}
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between h-36">
                    <div className="flex items-start justify-between gap-2 text-[#5e5e67]">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase">
                        Stylist Workload (技师负荷)
                      </span>
                      <span className="material-symbols-outlined text-[18px] shrink-0">badge</span>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#000000] tabular-nums">
                          {workloadPct}%
                        </span>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                          {staffWithBookingToday.size} of {staff.length} Stylists Booked
                        </span>
                      </div>
                      <div className="w-full bg-[#e8e8ec] h-1.5 rounded-full mt-2.5 overflow-hidden">
                        <div
                          className="bg-[#000000] h-full rounded-full"
                          style={{ width: `${workloadPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Metric 3: Today's Takings */}
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between h-36">
                    <div className="flex items-start justify-between gap-2 text-[#5e5e67]">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase">
                        Today&apos;s Takings (实收开单)
                      </span>
                      <span className="material-symbols-outlined text-[18px] shrink-0">payments</span>
                    </div>
                    <div>
                      <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#000000] tabular-nums">
                        {ringgit(revenueTodayCents) ?? "RM 0"}
                      </div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                        {receipts.length} {receipts.length === 1 ? "Receipt" : "Receipts"} Settled Today
                      </p>
                    </div>
                  </div>

                  {/* Metric 4: Dispensary Low Stock */}
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between h-36">
                    <div className="flex items-start justify-between gap-2 text-[#5e5e67]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${lowStock.length ? "bg-[#ba1a1a]" : "bg-[#c8c5cb]"}`}
                        />
                        <span
                          className={`text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase ${
                            lowStock.length ? "text-[#ba1a1a]" : "text-[#5e5e67]"
                          }`}
                        >
                          Dispensary Reorder
                        </span>
                      </div>
                      <span
                        className={`material-symbols-outlined text-[18px] shrink-0 ${
                          lowStock.length ? "text-[#ba1a1a]" : "text-[#5e5e67]"
                        }`}
                      >
                        inventory_2
                      </span>
                    </div>
                    {lowStock.length ? (
                      <div className="flex items-end justify-between">
                        <div className="pr-2 truncate" title={lowStock[0].name}>
                          <div className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#000000] font-semibold truncate">
                            {lowStock[0].name}
                          </div>
                          <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                            {lowStock[0].on_hand} left
                          </div>
                        </div>
                        <Link
                          href="/en/salon-preview/stock"
                          className="px-2.5 py-1 bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#000000] uppercase tracking-wider transition-colors shrink-0"
                        >
                          Reorder
                        </Link>
                      </div>
                    ) : (
                      <p className="text-[13.5px] text-[#5e5e67]">Nothing below its reorder line today.</p>
                    )}
                  </div>
                </section>

                {/* Main Operations Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left 8 Columns */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* Stylist Roster & Day Target Breakdown */}
                    <div className="p-6 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm space-y-5">
                      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-2">
                        <div className="flex items-center gap-3 flex-wrap gap-y-1.5">
                          <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                            Daily Stylist Run Sheet (今日工位与业绩分配)
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#e8e8ec] text-[#000000] font-medium shrink-0">
                            {staff.length} Active Staff
                          </span>
                        </div>
                        <Link
                          href="/en/salon-preview/stylists"
                          className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] hover:text-[#000000] active:scale-[0.97] transition-all uppercase tracking-wider font-semibold flex items-center gap-1 shrink-0"
                        >
                          View Full Roster <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                      </div>

                      {staffRun.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {staffRun.map((s) => (
                            <div
                              key={s.id}
                              className="p-4 rounded-xl bg-[#f3f3f7] flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium font-semibold text-[#000000]">
                                    {s.name}
                                  </span>
                                </div>
                                <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                                  {s.bookings} {s.bookings === 1 ? "Client Booked" : "Clients Booked"}
                                </div>
                              </div>
                              <div className="mt-3 pt-2.5 border-t border-[#eeedf1] flex items-baseline justify-between">
                                <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                                  Recorded Today
                                </span>
                                <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium font-semibold text-[#000000]">
                                  {s.earnedCents > 0 ? ringgit(s.earnedCents) : "—"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[13.5px] text-[#5e5e67]">No staff on this business yet.</p>
                      )}
                    </div>

                    {/* Upcoming Appointments & Run Sheet Flow */}
                    <div className="p-6 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#000000]">
                            Today&apos;s Schedule &amp; Next Arrivals
                          </h2>
                        </div>
                        <Link
                          href="/en/salon-preview/schedule"
                          className="px-3.5 py-1.5 rounded bg-[#eeedf1] hover:bg-[#e8e8ec] text-[#000000] text-[13.5px] leading-5 font-normal transition-colors"
                        >
                          Open Schedule Grid
                        </Link>
                      </div>

                      {upcoming.length ? (
                        // No forced min-width + horizontal scroll here on purpose: at
                        // 900-1280px that combination hid the "Open" link off-screen
                        // with no visible scrollbar to say so. Each row now wraps and
                        // truncates on its own instead of needing the whole table to
                        // be wider than its column.
                        <div className="divide-y divide-[#eeedf1]">
                          {upcoming.slice(0, 6).map((a) => (
                            <div key={a.id} className="py-3.5 flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-4 min-w-0">
                                <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium font-semibold text-[#000000] w-16 shrink-0">
                                  {new Intl.DateTimeFormat("en-MY", {
                                    timeZone: "Asia/Kuala_Lumpur",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  }).format(new Date(a.starts_at))}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium font-semibold text-[#000000] truncate">
                                      {a.party || "Walk-in guest"}
                                    </span>
                                  </div>
                                  <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5 truncate">
                                    {a.service || "Service not noted"}
                                    {staffNameOf(a.staff_id) ? ` · Stylist ${staffNameOf(a.staff_id)}` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span
                                  className={
                                    "px-2 py-0.5 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium " +
                                    (a.arrived_at ? "bg-[#e8e8ec] text-[#000000]" : "bg-[#e8e8ec] text-[#5e5e67]")
                                  }
                                >
                                  {a.arrived_at ? "Arrived" : "Booked"}
                                </span>
                                <Link
                                  href={`/${locale}/portal/${a.module_key}/${a.id}`}
                                  className="px-3 py-1 bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] text-[#000000] rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium transition-colors"
                                >
                                  Open
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[13.5px] text-[#5e5e67]">Nothing else booked for today.</p>
                      )}
                    </div>
                  </div>

                  {/* Right 4 Columns */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Front Desk Settlement & Quick POS */}
                    <div className="p-6 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#000000]">
                            Shift Register Stream
                          </h2>
                        </div>
                      </div>

                      {/* Payment Split Multi-bar -- real, grouped by whatever
                          `method` text the business actually types in. */}
                      {methodSplit.length ? (
                        <div className="space-y-2">
                          <div className="w-full h-2 rounded-full overflow-hidden flex bg-[#e8e8ec]">
                            {methodSplit.map(([method, cents], i) => (
                              <div
                                key={method}
                                className="h-full"
                                style={{
                                  width: `${(cents / revenueTodayCents) * 100}%`,
                                  backgroundColor: methodShades[i % methodShades.length],
                                }}
                                title={`${method} ${ringgit(cents)}`}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                            {methodSplit.map(([method, cents], i) => (
                              <div key={method} className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: methodShades[i % methodShades.length] }}
                                />
                                <span>
                                  {method} ({ringgit(cents)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[13.5px] text-[#5e5e67]">No receipts settled yet today.</p>
                      )}

                      {/* Recent Settled Tickets Stream */}
                      {receipts.length ? (
                        <div className="pt-2 border-t border-[#eeedf1] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                              Recent Settled Receipts
                            </span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                              Today ({receipts.length})
                            </span>
                          </div>

                          <div className="space-y-2">
                            {receipts.slice(0, 2).map((r) => (
                              <div
                                key={r.id}
                                className="p-3 rounded bg-[#f3f3f7] flex items-center justify-between"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13.5px] leading-5 font-normal font-semibold text-[#000000]">
                                      {r.doc_no ?? "—"}
                                    </span>
                                  </div>
                                  <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                                    {r.party || "Walk-in guest"}
                                  </div>
                                </div>
                                <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium font-semibold text-[#000000]">
                                  {ringgit(r.amount_cents)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <Link
                        href="/en/salon-preview/register"
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-[#000000] text-[#ffffff] hover:bg-[#5f5e61] active:scale-[0.98] text-[13.5px] leading-5 font-normal transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                        <span>Open Fast POS Checkout</span>
                      </Link>
                    </div>

                    {/* Practical Inventory Reorder Action Alert */}
                    <div className="p-6 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${lowStock.length ? "bg-[#ba1a1a] animate-pulse" : "bg-[#c8c5cb]"}`}
                          />
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#000000]">
                            Dispensary &amp; Stock Alert
                          </h3>
                        </div>
                        <Link
                          href="/en/salon-preview/stock"
                          className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] hover:text-[#000000] active:scale-[0.97] uppercase tracking-wider font-semibold transition-all shrink-0"
                        >
                          Manage Stock
                        </Link>
                      </div>

                      {lowStock.length ? (
                        <>
                          <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                            {lowStock.length} {lowStock.length === 1 ? "item is" : "items are"} below its reorder line.
                          </p>
                          <div className="space-y-2.5 pt-1">
                            {lowStock.map((item) => (
                              <div
                                key={item.item_id}
                                className="p-3.5 rounded bg-[#f3f3f7] flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0" title={item.name}>
                                  <div className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium font-semibold text-[#000000] truncate">
                                    {item.name}
                                  </div>
                                  <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                                    {item.on_hand} left
                                  </div>
                                </div>
                                <Link
                                  href="/en/salon-preview/stock"
                                  className="px-3 py-1.5 bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#000000] uppercase tracking-wider transition-colors shrink-0"
                                >
                                  Reorder
                                </Link>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-[13.5px] text-[#5e5e67]">Nothing needs reordering today.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
