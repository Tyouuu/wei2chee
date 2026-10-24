"use client";

import { SalonSidebar } from "../salon-shell";

export type Driver = {
  rank: number;
  service: string;
  times: number;
  totalCents: number;
  avgCents: number;
  /** This service's takings as a share of the biggest one -- the bar. */
  barPct: number;
};

export type StylistRow = {
  id: string;
  name: string;
  visits: number;
  takingsCents: number;
  commissionCents: number | null;
};

export type ReportData = {
  businessName: string;
  monthLabel: string;
  rangeLabel: string;
  prevRangeLabel: string;
  grossCents: number;
  prevGrossCents: number;
  momPct: number | null;
  drivers: Driver[];
  stylists: StylistRow[];
};

function ringgit(cents: number) {
  return `RM ${(cents / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const SECTION_LABEL = "text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]";
const CARD = "bg-[#ffffff] rounded-xl border border-[#c8c5cb]/40 shadow-sm";

export function ReportsClient({ canSeeMoney, data }: { canSeeMoney: boolean; data: ReportData }) {
  const exportStatement = () => {
    const rows: (string | number)[][] = [
      ["Reports & Rankings", data.businessName],
      ["Period", data.rangeLabel],
      [],
      ["Gross takings (RM)", (data.grossCents / 100).toFixed(2)],
      ["Same days last month (RM)", (data.prevGrossCents / 100).toFixed(2)],
      [],
      ["Service", "Times done", "Takings (RM)", "Average (RM)"],
      ...data.drivers.map((d) => [d.service, d.times, (d.totalCents / 100).toFixed(2), (d.avgCents / 100).toFixed(2)]),
      [],
      ["Stylist", "Visits", "Takings (RM)", "Commission (RM)"],
      ...data.stylists.map((s) => [
        s.name,
        s.visits,
        (s.takingsCents / 100).toFixed(2),
        s.commissionCents != null ? (s.commissionCents / 100).toFixed(2) : "",
      ]),
    ];
    downloadCsv(`statement-${data.rangeLabel.replace(/[^0-9A-Za-z]+/g, "-")}.csv`, rows);
  };

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
                    Reports &amp; Rankings
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
                {/* This month's takings */}
                <div className={CARD + " p-5 mb-7"}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={SECTION_LABEL}>This Month&apos;s Takings</span>
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
                    </span>
                  </div>
                </div>

                {/* What sold + who did it */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  <div className={"xl:col-span-7 " + CARD + " p-5"}>
                    <div className="flex items-center justify-between pb-3 border-b border-[#c8c5cb]/20 mb-3">
                      <h2 className="text-[16px] leading-none tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                        What Sold
                      </h2>
                      <span className={SECTION_LABEL}>Ranked by Takings</span>
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
                            className="p-3 rounded-lg border border-[#c8c5cb]/30 bg-[#f3f3f7]/20"
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
                            <div className="w-full h-1.5 rounded-full bg-[#e8e8ec] overflow-hidden">
                              <div className="bg-[#000000] h-full rounded-full" style={{ width: `${d.barPct}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={"xl:col-span-5 " + CARD + " p-5"}>
                    <div className="flex items-center justify-between pb-3 border-b border-[#c8c5cb]/20 mb-3">
                      <h2 className="text-[16px] leading-none tracking-[-0.01em] font-semibold text-[#1a1c1f]">Who Did It</h2>
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
                            className="p-3 rounded-lg border border-[#c8c5cb]/30 bg-[#f3f3f7]/20 flex items-center justify-between gap-2"
                          >
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
                                  {s.visits} {s.visits === 1 ? "visit" : "visits"}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[14.5px] leading-[22px] font-bold text-[#1a1c1f] tabular-nums">{ringgit(s.takingsCents)}</div>
                              <div className="text-[11px] text-[#5e5e67]">
                                Comm: {s.commissionCents != null ? ringgit(s.commissionCents) : "—"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
