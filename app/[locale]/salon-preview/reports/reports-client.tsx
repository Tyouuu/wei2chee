"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SalonSidebar } from "../salon-shell";

export type Bucket = { key: "core" | "membership" | "prepaid"; label: string; cents: number; pct: number };

export type Driver = {
  rank: number;
  service: string;
  times: number;
  totalCents: number;
  avgCents: number;
  /** This service's takings as a share of the biggest one -- the bar. */
  barPct: number;
  /** "known" = every product used has a cost price; the other two say why there is no margin. */
  costNote: "known" | "cost-missing" | "none-logged";
  formulaCostCents: number | null;
  marginPct: number | null;
  profitPerUnitCents: number | null;
};

export type StylistRow = {
  id: string;
  name: string;
  role: string;
  visits: number;
  takingsCents: number;
  commissionCents: number | null;
  bookedHours: number;
  clockedHours: number | null;
  utilPct: number | null;
  revPerHourCents: number | null;
  topProducer: boolean;
};

export type VipRow = {
  id: string;
  rank: number;
  tier: "Top 5%" | "Top 20%";
  name: string;
  phone: string;
  whatsappUrl: string | null;
  visits: number;
  timesPaid: number;
  lifetimeCents: number;
  preferredStylist: string | null;
  cadence: { text: string; tone: "ok" | "late" | "neutral" };
};

export type ReportData = {
  businessName: string;
  monthLabel: string;
  rangeLabel: string;
  prevRangeLabel: string;
  grossCents: number;
  prevGrossCents: number;
  momPct: number | null;
  buckets: Bucket[];
  consumables: { cents: number; missingCount: number; absorptionPct: number | null } | null;
  drivers: Driver[];
  stylists: StylistRow[];
  studioRevPerHourCents: number | null;
  vips: VipRow[];
  vipClientCount: number;
  vipTotalClients: number;
  vipShare: number | null;
  vipTopCents: number;
  vipCutoffCents: number | null;
  census: { name: string; phone: string; visits: number; timesPaid: number; lifetimeCents: number; lastOn: string }[];
};

const VIP_PAGE = 12;

function ringgit(cents: number) {
  return `RM ${(cents / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct1(n: number) {
  return `${n.toFixed(1)}%`;
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
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

const BUCKET_STYLE: Record<Bucket["key"], { dot: string; note: string }> = {
  // Three clearly separate steps (black / mid grey / light grey). The source
  // used #5e5e67 and #77767b for two of them, which read as the same grey in
  // a 12px bar -- caught by looking at the screenshot, not by a number.
  core: { dot: "bg-[#000000]", note: "Till sales and service payments" },
  membership: { dot: "bg-[#77767b]", note: "Member fees collected" },
  prepaid: { dot: "bg-[#c8c5cb]", note: "Packages sold" },
};

const SECTION_LABEL = "text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]";
const CARD = "bg-[#ffffff] rounded-xl border border-[#c8c5cb]/40 shadow-sm";

export function ReportsClient({ canSeeMoney, data }: { canSeeMoney: boolean; data: ReportData }) {
  const [vipSearch, setVipSearch] = useState("");
  const [tierOnly, setTierOnly] = useState<"all" | "Top 5%">("all");
  const [vipShown, setVipShown] = useState(VIP_PAGE);

  const filteredVips = useMemo(() => {
    const q = vipSearch.trim().toLowerCase();
    return data.vips.filter(
      (v) =>
        (tierOnly === "all" || v.tier === tierOnly) &&
        (!q || v.name.toLowerCase().includes(q) || v.phone.toLowerCase().includes(q)),
    );
  }, [data.vips, vipSearch, tierOnly]);

  const exportStatement = () => {
    const rows: (string | number)[][] = [
      ["Reports & Rankings", data.businessName],
      ["Period", data.rangeLabel],
      [],
      ["Gross takings (RM)", (data.grossCents / 100).toFixed(2)],
      ["Same days last month (RM)", (data.prevGrossCents / 100).toFixed(2)],
      [],
      ["Where the money came from", "RM", "Share %"],
      ...data.buckets.map((b) => [b.label, (b.cents / 100).toFixed(2), b.pct.toFixed(1)]),
      [],
      ["Service", "Times done", "Takings (RM)", "Average (RM)"],
      ...data.drivers.map((d) => [d.service, d.times, (d.totalCents / 100).toFixed(2), (d.avgCents / 100).toFixed(2)]),
      [],
      ["Stylist", "Visits", "Takings (RM)", "Booked hours", "Commission (RM)"],
      ...data.stylists.map((s) => [
        s.name,
        s.visits,
        (s.takingsCents / 100).toFixed(2),
        s.bookedHours.toFixed(1),
        s.commissionCents != null ? (s.commissionCents / 100).toFixed(2) : "",
      ]),
    ];
    downloadCsv(`statement-${data.rangeLabel.replace(/[^0-9A-Za-z]+/g, "-")}.csv`, rows);
  };

  const exportCensus = () => {
    downloadCsv(`client-census-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Name", "Phone", "Visits", "Payments", "Lifetime spend (RM)", "Last visit"],
      ...data.census.map((c) => [c.name, c.phone, c.visits, c.timesPaid, (c.lifetimeCents / 100).toFixed(2), c.lastOn]),
    ]);
  };

  const hasGross = data.grossCents > 0;

  return (
    <div
      className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="reports-and-rankings" businessName={data.businessName} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main data-print-sheet className="w-full px-7 py-7 bg-[#f9f9fd]">
          <div className="flex flex-col w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-5 mb-5 border-b border-[#c8c5cb]/30">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-1 text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                  <span>Operations</span>
                  <span className="text-[#c8c5cb]">/</span>
                  <span>Management</span>
                  <span className="text-[#c8c5cb]">/</span>
                  <span className="text-[#1a1c1f] font-medium">Reports &amp; Rankings</span>
                </div>
                <div className="flex items-baseline gap-3 mt-0.5 flex-wrap">
                  <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] m-0">
                    Profitability &amp; Yield Intelligence
                  </h1>
                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                    Month to date · {data.monthLabel} · {data.businessName}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 print:hidden">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff] border border-[#c8c5cb]/40 text-[#1a1c1f] text-[13.5px] leading-5 font-medium shadow-sm">
                  <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">calendar_today</span>
                  <span>{data.rangeLabel}</span>
                </div>
                {canSeeMoney && (
                  <>
                    <button
                      type="button"
                      onClick={exportStatement}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff] hover:bg-[#f3f3f7] border border-[#c8c5cb]/50 text-[#1a1c1f] text-[13.5px] leading-5 font-medium transition-colors shadow-sm active:scale-[0.99]"
                    >
                      <span className="material-symbols-outlined text-[16px]">file_download</span>
                      <span>Export Statement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#000000] hover:bg-[#1b1b1e] text-[#ffffff] text-[13.5px] leading-5 font-medium transition-colors shadow-sm active:scale-[0.99]"
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                      <span>Print Audit</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {!canSeeMoney ? (
              <div className={CARD + " p-10 text-center text-[13.5px] text-[#77767b]"}>
                Reports &amp; Rankings is only visible to the business owner.
              </div>
            ) : (
              <>
                {/* Profit quality barometer */}
                <div className={CARD + " p-5 mb-7"}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#c8c5cb]/20">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={SECTION_LABEL}>Profit Quality Barometer</span>
                        {data.momPct != null ? (
                          <span
                            data-testid="mom-pill"
                            className={
                              "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border " +
                              (data.momPct >= 0
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200/60"
                                : "bg-[#ffdad6] text-[#93000a] border-[#93000a]/20")
                            }
                          >
                            {data.momPct >= 0 ? "+" : ""}
                            {data.momPct.toFixed(1)}% vs same days last month
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#eeedf1] text-[#47464b]">
                            Nothing to compare with last month yet
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                        <span
                          data-testid="gross-takings"
                          className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#1a1c1f] tabular-nums"
                        >
                          {ringgit(data.grossCents)}
                        </span>
                        <span className="text-[13.5px] leading-5 font-medium text-[#5e5e67]">
                          Gross takings, month to date
                          {data.consumables && data.consumables.cents > 0 && (
                            <>
                              {" "}
                              · <strong className="text-[#1a1c1f] font-semibold tabular-nums">{ringgit(data.consumables.cents)}</strong>{" "}
                              of consumables used
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] flex-wrap">
                      {data.buckets.map((b) => (
                        <div key={b.key} className="flex items-center gap-1.5">
                          <span className={"w-2.5 h-2.5 rounded-full " + BUCKET_STYLE[b.key].dot} />
                          <span>
                            {b.label} · {pct1(b.pct)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full h-3 rounded-full bg-[#e8e8ec] overflow-hidden flex gap-0.5 p-0.5">
                      {data.buckets
                        .filter((b) => b.pct > 0)
                        .map((b, i, arr) => (
                          <div
                            key={b.key}
                            className={
                              BUCKET_STYLE[b.key].dot +
                              " h-full" +
                              (i === 0 ? " rounded-l-full" : "") +
                              (i === arr.length - 1 ? " rounded-r-full" : "")
                            }
                            style={{ width: `${b.pct}%` }}
                            title={`${b.label}: ${ringgit(b.cents)}`}
                          />
                        ))}
                    </div>
                    {!hasGross && (
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-2">
                        No payments recorded this month yet, so there is nothing to split.
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-1">
                      {data.buckets.map((b) => (
                        <div key={b.key} className="p-3 rounded-lg bg-[#f3f3f7]/40 border border-[#c8c5cb]/30 flex flex-col justify-between">
                          <div className="flex items-center justify-between gap-2">
                            <span className={SECTION_LABEL}>{b.label}</span>
                            <span className="text-[11px] font-medium text-[#1a1c1f] bg-[#eeedf1] px-1.5 rounded">
                              {pct1(b.pct)} of takings
                            </span>
                          </div>
                          <div className="mt-2 text-[16px] leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                            {ringgit(b.cents)}
                          </div>
                          <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                            {b.key === "core" && data.consumables
                              ? data.consumables.cents > 0
                                ? `Consumables used behind the chair: ${ringgit(data.consumables.cents)}`
                                : "Consumables used, but no cost price on file yet"
                              : BUCKET_STYLE[b.key].note}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Drivers + floor efficiency */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mb-7">
                  <div className={"xl:col-span-7 " + CARD + " p-5 flex flex-col justify-between"}>
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-[#c8c5cb]/20 mb-3">
                        <div>
                          <h2 className="text-[16px] leading-none tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                            Profit Margin Spectrum &amp; Revenue Drivers
                          </h2>
                          <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                            Formulation cost vs guest charge · Ranked by gross takings
                          </p>
                        </div>
                        <span className={SECTION_LABEL}>Ranked Volume</span>
                      </div>
                      {data.drivers.length === 0 ? (
                        <div data-testid="drivers-empty" className="py-8 text-center text-[13.5px] text-[#77767b]">
                          No finished visits with a service recorded this month yet.
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          {data.drivers.map((d) => (
                            <div
                              key={d.service}
                              data-testid="driver-row"
                              className="p-3 rounded-lg border border-[#c8c5cb]/30 bg-[#f3f3f7]/20 hover:bg-[#f3f3f7]/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={
                                      "w-5 h-5 shrink-0 rounded text-[11px] font-bold flex items-center justify-center " +
                                      (d.rank === 1 ? "bg-[#000000] text-[#ffffff]" : "bg-[#e8e8ec] text-[#1a1c1f]")
                                    }
                                  >
                                    {d.rank}
                                  </span>
                                  <span className="text-[14.5px] leading-[22px] font-semibold text-[#1a1c1f] truncate">{d.service}</span>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[14.5px] leading-[22px] font-bold text-[#1a1c1f] tabular-nums">{ringgit(d.totalCents)}</div>
                                  <div className="text-[11px] text-[#5e5e67]">
                                    {d.times} {d.times === 1 ? "service" : "services"} · {ringgit(d.avgCents)} avg
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-[11px] text-[#5e5e67] mb-1">
                                {d.costNote === "known" && d.formulaCostCents != null ? (
                                  <>
                                    <span>
                                      Formula cost: <strong className="text-[#1a1c1f] font-medium">{ringgit(d.formulaCostCents)}</strong> / session
                                    </span>
                                    {d.marginPct != null && d.profitPerUnitCents != null && (
                                      <span className="text-emerald-800 font-semibold">
                                        Net margin {pct1(d.marginPct)} ({ringgit(d.profitPerUnitCents)} profit/unit)
                                      </span>
                                    )}
                                  </>
                                ) : d.costNote === "cost-missing" ? (
                                  <span>Products were used, but some have no cost price yet, so no margin is shown.</span>
                                ) : (
                                  <span>No products logged against this service, so no margin is shown.</span>
                                )}
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[#e8e8ec] overflow-hidden">
                                <div className="bg-[#000000] h-full rounded-full" style={{ width: `${d.barPct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#c8c5cb]/20 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                      {data.consumables?.absorptionPct != null ? (
                        <span>
                          Consumables used: <strong>{pct1(data.consumables.absorptionPct)}</strong> of gross takings
                          {data.consumables.missingCount > 0 &&
                            ` (${data.consumables.missingCount} ${data.consumables.missingCount === 1 ? "product used has" : "products used have"} no cost price)`}
                        </span>
                      ) : (
                        <span>Add a cost price to the products used behind the chair to see margins here.</span>
                      )}
                    </div>
                  </div>

                  <div className={"xl:col-span-5 " + CARD + " p-5 flex flex-col justify-between"}>
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-[#c8c5cb]/20 mb-3">
                        <div>
                          <h2 className="text-[16px] leading-none tracking-[-0.01em] font-semibold text-[#1a1c1f]">Floor Efficiency &amp; Chair Yield</h2>
                          <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                            Stylist productivity · Takings / booked floor hr
                          </p>
                        </div>
                        {data.studioRevPerHourCents != null && (
                          <span className="px-2 py-0.5 rounded bg-[#eeedf1] text-[#47464b] text-[11.5px] leading-4 tracking-[0.04em] font-medium">
                            Avg {ringgit(data.studioRevPerHourCents)}/hr
                          </span>
                        )}
                      </div>
                      {data.stylists.length === 0 ? (
                        <div data-testid="stylists-empty" className="py-8 text-center text-[13.5px] text-[#77767b]">
                          No finished visits with a stylist on them this month yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {data.stylists.map((s, i) => (
                            <div
                              key={s.id}
                              data-testid="stylist-row"
                              className="p-3 rounded-lg border border-[#c8c5cb]/30 bg-[#f3f3f7]/20 flex flex-col gap-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={
                                      "w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[11.5px] font-bold " +
                                      (i === 0 ? "bg-[#000000] text-[#ffffff]" : "bg-[#e8e8ec] text-[#1a1c1f]")
                                    }
                                  >
                                    {initials(s.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[14.5px] leading-[22px] font-semibold text-[#1a1c1f] truncate">{s.name}</div>
                                    <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] truncate">
                                      {s.role ? `${s.role} · ` : ""}
                                      {s.visits} {s.visits === 1 ? "visit" : "visits"}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[18px] leading-7 font-bold text-[#1a1c1f] tabular-nums">
                                    {s.revPerHourCents != null ? ringgit(s.revPerHourCents) : "—"}
                                    <span className="text-[11px] font-normal text-[#5e5e67]">/hr</span>
                                  </div>
                                  {s.topProducer && (
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-800 bg-emerald-50 px-1.5 rounded border border-emerald-200/50">
                                      Top Producer
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 flex-wrap text-[11.5px] text-[#5e5e67] pt-1 border-t border-[#c8c5cb]/20">
                                <span>
                                  Takings: <strong className="text-[#1a1c1f] font-medium tabular-nums">{ringgit(s.takingsCents)}</strong>
                                </span>
                                <span>
                                  Booked: <strong className="text-[#1a1c1f] font-medium tabular-nums">{s.bookedHours.toFixed(1)} hrs</strong>
                                  {s.utilPct != null && s.clockedHours != null && (
                                    <>
                                      {" "}
                                      · {s.utilPct.toFixed(0)}% of {s.clockedHours.toFixed(0)} clocked
                                    </>
                                  )}
                                </span>
                                <span>
                                  Comm:{" "}
                                  <strong className="text-[#1a1c1f] font-medium tabular-nums">
                                    {s.commissionCents != null ? ringgit(s.commissionCents) : "—"}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-2 text-center text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                      Takings per hour = what the stylist did ÷ hours booked (appointment start to end)
                    </div>
                  </div>
                </div>

                {/* VIP Pareto */}
                <div className={CARD + " overflow-hidden"}>
                  <div className="p-5 border-b border-[#c8c5cb]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[16px] leading-none tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                          High-Yield VIP Pareto Matrix (Top 20% Clients)
                        </h2>
                        {data.vipShare != null && (
                          <span data-testid="vip-share" className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#000000] text-[#ffffff]">
                            {pct1(data.vipShare)} Revenue Share
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                        {data.vipTotalClients === 0
                          ? "No client has paid yet."
                          : `${data.vipClientCount} of ${data.vipTotalClients} paying clients account for ${ringgit(data.vipTopCents)} · lifetime spend, refunds excluded`}
                      </p>
                    </div>
                    {data.vips.length > 0 && (
                      <div className="flex items-center gap-2 print:hidden">
                        <div className="relative">
                          <input
                            type="text"
                            value={vipSearch}
                            onChange={(e) => {
                              setVipSearch(e.target.value);
                              setVipShown(VIP_PAGE);
                            }}
                            placeholder="Search client name..."
                            aria-label="Search VIP clients"
                            className="h-8 pl-8 pr-3 text-[13.5px] leading-5 rounded-lg border border-[#c8c5cb]/50 bg-[#ffffff] text-[#1a1c1f] placeholder:text-[#5e5e67] focus:border-[#000000] focus:outline-none w-48 transition-colors"
                          />
                          <span className="material-symbols-outlined text-[16px] text-[#5e5e67] absolute left-2.5 top-2">search</span>
                        </div>
                        <label className="h-8 px-2.5 rounded-lg border border-[#c8c5cb]/40 bg-[#f3f3f7] text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium flex items-center gap-1 hover:bg-[#eeedf1] transition-colors">
                          <span className="material-symbols-outlined text-[14px]">tune</span>
                          <select
                            aria-label="Filter tier"
                            value={tierOnly}
                            onChange={(e) => {
                              setTierOnly(e.target.value as "all" | "Top 5%");
                              setVipShown(VIP_PAGE);
                            }}
                            className="bg-transparent outline-none cursor-pointer"
                          >
                            <option value="all">All top 20%</option>
                            <option value="Top 5%">Top 5% only</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </div>

                  {data.vips.length === 0 ? (
                    <div data-testid="vip-empty" className="p-10 text-center text-[13.5px] text-[#77767b]">
                      Once clients start paying, your best 20% will be ranked here.
                    </div>
                  ) : filteredVips.length === 0 ? (
                    <div className="p-10 text-center text-[13.5px] text-[#77767b]">No VIP client matches that.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                      {filteredVips.slice(0, vipShown).map((v) => (
                        <div
                          key={v.id}
                          data-testid="vip-card"
                          className="p-4 rounded-xl border border-[#c8c5cb]/40 bg-[#f3f3f7]/20 hover:border-[#000000]/40 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={
                                  "px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase " +
                                  (v.tier === "Top 5%"
                                    ? "bg-[#000000] text-[#ffffff]"
                                    : "bg-amber-50 text-amber-900 border border-amber-300")
                                }
                              >
                                {v.tier}
                              </span>
                              <span className={SECTION_LABEL + " font-bold"}>#{String(v.rank).padStart(2, "0")}</span>
                            </div>
                            <div className="text-[16px] leading-6 font-semibold text-[#1a1c1f]">{v.name}</div>
                            <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                              {v.phone ? `${v.phone} · ` : ""}
                              {v.visits} {v.visits === 1 ? "visit" : "visits"}
                            </div>
                            <div className="mt-3 pt-3 border-t border-[#c8c5cb]/20 flex items-center justify-between text-[12px]">
                              <span className="text-[#5e5e67]">Lifetime Spend:</span>
                              <span className="font-bold text-[#1a1c1f] tabular-nums">{ringgit(v.lifetimeCents)}</span>
                            </div>
                            {v.preferredStylist && (
                              <div className="mt-1 flex items-center justify-between text-[12px]">
                                <span className="text-[#5e5e67]">Preferred Stylist:</span>
                                <span className="font-medium text-[#1a1c1f]">{v.preferredStylist}</span>
                              </div>
                            )}
                            <div className="mt-1 flex items-center justify-between gap-3 text-[12px]">
                              <span className="text-[#5e5e67] shrink-0">Cadence:</span>
                              <span
                                className={
                                  "font-medium text-right " +
                                  (v.cadence.tone === "ok"
                                    ? "text-emerald-800"
                                    : v.cadence.tone === "late"
                                      ? "text-amber-900"
                                      : "text-[#1a1c1f]")
                                }
                              >
                                {v.cadence.text}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-[#c8c5cb]/20 flex items-center gap-2 print:hidden">
                            {v.whatsappUrl ? (
                              <a
                                href={v.whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 h-8 rounded-lg bg-[#ffffff] hover:bg-[#eeedf1] border border-[#c8c5cb]/40 text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium flex items-center justify-center gap-1 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">chat</span> WhatsApp Care
                              </a>
                            ) : (
                              <span className="flex-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#77767b] text-center">
                                No WhatsApp number on file
                              </span>
                            )}
                            <Link
                              href={`/en/salon-preview/clients?client=${v.id}`}
                              title="View Profile"
                              aria-label={`View ${v.name}'s profile`}
                              className="h-8 w-8 rounded-lg bg-[#ffffff] hover:bg-[#eeedf1] border border-[#c8c5cb]/40 text-[#1a1c1f] flex items-center justify-center transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredVips.length > vipShown && (
                    <div className="px-5 pb-4 -mt-1 flex justify-center print:hidden">
                      <button
                        type="button"
                        onClick={() => setVipShown((n) => n + VIP_PAGE)}
                        className="h-8 px-3 rounded-lg border border-[#c8c5cb]/40 bg-[#ffffff] hover:bg-[#eeedf1] text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium transition-colors"
                      >
                        Show more ({filteredVips.length - vipShown} left)
                      </button>
                    </div>
                  )}

                  <div className="px-5 py-2 border-t border-[#c8c5cb]/30 bg-[#f3f3f7]/30 flex items-center justify-between text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                    <span>
                      {data.vipCutoffCents != null ? (
                        <>
                          Top 20% VIP threshold cut-off: <strong>{ringgit(data.vipCutoffCents)}</strong> lifetime payments
                        </>
                      ) : (
                        "Top 20% threshold appears once clients have paid."
                      )}
                    </span>
                    {data.census.length > 0 && (
                      <button
                        type="button"
                        onClick={exportCensus}
                        className="print:hidden hover:text-[#1a1c1f] text-[#5e5e67] underline decoration-[#c8c5cb] transition-colors"
                      >
                        Export Full {data.census.length} Client Census
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
