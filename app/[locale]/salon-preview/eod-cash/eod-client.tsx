"use client";

import { useState } from "react";
import { SalonSidebar } from "../salon-shell";

export type SettlementRow = { method: string; count: number; totalCents: number; isCash: boolean };
export type PettyCashRow = { id: string; name: string; note: string; amountCents: number };

type DenomKey = "c100" | "c50" | "c20" | "c10" | "c5" | "c1";

const DENOMINATIONS: { key: DenomKey; label: string; value: number; badgeClasses: string }[] = [
  { key: "c100", label: "Banknote RM 100", value: 100, badgeClasses: "bg-purple-50 text-purple-800 border-purple-200" },
  { key: "c50", label: "Banknote RM 50", value: 50, badgeClasses: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { key: "c20", label: "Banknote RM 20", value: 20, badgeClasses: "bg-amber-50 text-amber-800 border-amber-200" },
  { key: "c10", label: "Banknote RM 10", value: 10, badgeClasses: "bg-red-50 text-red-800 border-red-200" },
  { key: "c5", label: "Banknote RM 5", value: 5, badgeClasses: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { key: "c1", label: "Banknote RM 1", value: 1, badgeClasses: "bg-blue-50 text-blue-800 border-blue-200" },
];

const ZERO_COUNTS: Record<DenomKey, number> = { c100: 0, c50: 0, c20: 0, c10: 0, c5: 0, c1: 0 };

const CHECKLIST_INITIAL = [
  "Cash drawer physically verified",
  "Card/QR terminal batch settlement checked",
  "Waste bins & mixing area tidied",
  "Equipment powered off",
];

function ringgit(cents: number) {
  return `RM ${(cents / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function notWired(what: string) {
  alert(`${what} isn't wired up yet.`);
}

export function EodCashClient({
  businessName,
  dayLabel,
  canSeeMoney,
  leadName,
  settlements,
  pettyCash,
  totalGrossCents,
  expectedCashCents,
}: {
  businessName: string;
  dayLabel: string;
  canSeeMoney: boolean;
  leadName: string;
  settlements: SettlementRow[];
  pettyCash: PettyCashRow[];
  totalGrossCents: number;
  expectedCashCents: number;
}) {
  const [counts, setCounts] = useState<Record<DenomKey, number>>(ZERO_COUNTS);
  const [floatCents, setFloatCents] = useState(0);
  const [checklist, setChecklist] = useState(CHECKLIST_INITIAL.map((label) => ({ label, done: false })));
  const [lockState, setLockState] = useState<"idle" | "locking" | "locked">("idle");
  const [note, setNote] = useState("");

  const adjust = (key: DenomKey, delta: number) => setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  const setCount = (key: DenomKey, raw: string) => {
    const n = parseInt(raw, 10);
    setCounts((prev) => ({ ...prev, [key]: Number.isNaN(n) || n < 0 ? 0 : n }));
  };
  const toggleCheck = (i: number) => setChecklist((prev) => prev.map((item, idx) => (idx === i ? { ...item, done: !item.done } : item)));

  const totalCountedCents = DENOMINATIONS.reduce((sum, d) => sum + counts[d.key] * d.value * 100, 0);
  const varianceCents = totalCountedCents - expectedCashCents;
  const netDepositCents = Math.max(0, totalCountedCents - floatCents);
  const doneCount = checklist.filter((c) => c.done).length;

  const varianceColor = varianceCents === 0 ? "text-[#047857]" : varianceCents > 0 ? "text-[#1d4ed8]" : "text-[#be123c]";
  const varianceText = varianceCents === 0 ? ringgit(0) : varianceCents > 0 ? `+${ringgit(varianceCents)}` : `-${ringgit(Math.abs(varianceCents))}`;

  const handleLock = () => {
    setLockState("locking");
    setTimeout(() => setLockState("locked"), 1200);
  };

  const nonCashTotal = settlements.filter((s) => !s.isCash).reduce((s, r) => s + r.totalCents, 0);

  return (
    <div
      className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="end-of-day-cash" businessName={businessName} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main className="w-full px-8 pt-0 bg-[#f9f9fd] min-h-screen">
          <div className="flex flex-col w-full pb-16">
            <div className="pt-6 pb-4 flex items-center justify-between border-b border-[#e2e2e6]">
              <div className="flex items-center gap-2 text-[#47464b] text-[11.5px] leading-4 tracking-[0.04em] font-medium tracking-wider uppercase">
                <span>Operations</span><span>/</span><span>Management</span><span>/</span>
                <span className="text-[#1a1c1f] font-semibold">Shift Reconciliation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">{businessName}</span>
              </div>
            </div>

            <div className="py-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e2e2e6]">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold tracking-tight text-[#1a1c1f]">
                  End of Day Cash &amp; Register Reconciliation
                </h1>
                <p className="text-[13.5px] leading-5 text-[#47464b] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-[#77767b]">schedule</span>
                  <span>{dayLabel}</span>
                  <span className="text-[#77767b]">·</span>
                  <span>Logged in as: <strong className="text-[#1a1c1f] font-medium">{leadName}</strong></span>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#ffffff] border border-[#c8c5cb] hover:bg-[#f3f3f7] active:scale-[0.97] text-[#1a1c1f] text-[13.5px] leading-5 font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px] text-[#47464b]">print</span>
                  <span>Print Summary</span>
                </button>
                <button
                  onClick={() => notWired("Exporting a shift PDF")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#ffffff] border border-[#c8c5cb] hover:bg-[#f3f3f7] active:scale-[0.97] text-[#1a1c1f] text-[13.5px] leading-5 font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px] text-[#47464b]">file_download</span>
                  <span>Export Shift PDF</span>
                </button>
                <button
                  onClick={handleLock}
                  disabled={lockState !== "idle"}
                  className={
                    "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] leading-5 font-medium transition-colors active:scale-[0.99] " +
                    (lockState === "locked" ? "bg-[#e8e8ec] text-[#1a1c1f]" : "bg-[#000000] hover:bg-[#1b1b1e] text-[#ffffff]")
                  }
                  title={lockState === "locked" ? "This is a same-session marker only -- nothing is saved" : undefined}
                >
                  <span className={"material-symbols-outlined text-[17px]" + (lockState === "locking" ? " animate-spin" : "")}>
                    {lockState === "idle" ? "lock" : lockState === "locking" ? "refresh" : "lock_clock"}
                  </span>
                  <span>{lockState === "idle" ? "Lock Drawer (This Device)" : lockState === "locking" ? "Locking…" : "Locked (Not Saved)"}</span>
                </button>
              </div>
            </div>

            {!canSeeMoney ? (
              <div className="mt-6 bg-[#ffffff] rounded-xl p-10 border border-[#c8c5cb]/30 shadow-sm text-center text-[13.5px] text-[#77767b]">
                Cash reconciliation is only visible to the business owner.
              </div>
            ) : (
              <>
                {/* Summary Strip */}
                <div className="py-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#77767b]">Expected Cash (by method)</span>
                      <span className="material-symbols-outlined text-[18px] text-[#77767b]">account_balance_wallet</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(expectedCashCents)}</div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] mt-1">Payment methods containing &quot;cash&quot;, today</p>
                    </div>
                  </div>
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#77767b]">Cash Counted by Staff</span>
                      <span className="material-symbols-outlined text-[18px] text-[#77767b]">payments</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(totalCountedCents)}</div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] mt-1">From the physical count below</p>
                    </div>
                  </div>
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#77767b]">Cash Variance</span>
                      <span
                        className={
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border " +
                          (varianceCents === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")
                        }
                      >
                        <span className={"w-1.5 h-1.5 rounded-full " + (varianceCents === 0 ? "bg-emerald-600" : "bg-amber-600")} />
                        {varianceCents === 0 ? "Balanced" : "Check It"}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className={"text-[30px] leading-9 tracking-[-0.025em] font-semibold tabular-nums " + varianceColor}>{varianceText}</div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] mt-1">Counted minus expected cash</p>
                    </div>
                  </div>
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#77767b]">Total Shift Gross</span>
                      <span className="material-symbols-outlined text-[18px] text-[#77767b]">pie_chart</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(totalGrossCents)}</div>
                      <div className="flex items-center gap-3 mt-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">
                        <span>Cash {ringgit(expectedCashCents)}</span><span>·</span><span>Other {ringgit(nonCashTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* LEFT COLUMN */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#e2e2e6] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#47464b]">calculate</span>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Physical Cash Denomination Count</h2>
                        </div>
                      </div>
                      <div className="w-full overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-[#f3f3f7] text-[#47464b] text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase border-b border-[#e2e2e6]">
                              <th className="py-2.5 px-4">Denomination</th>
                              <th className="py-2.5 px-4">Face Value</th>
                              <th className="py-2.5 px-4 w-44">Counted Qty</th>
                              <th className="py-2.5 px-4 text-right">Line Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e2e2e6] text-[13.5px] leading-[18px]">
                            {DENOMINATIONS.map((d) => (
                              <tr key={d.key} className="hover:bg-[#f3f3f7] transition-colors">
                                <td className="py-3 px-4 flex items-center gap-2.5">
                                  <span className={"inline-block w-6 text-center text-[11.5px] leading-4 tracking-[0.04em] font-bold py-0.5 rounded border " + d.badgeClasses}>{d.value}</span>
                                  <span className="font-medium text-[#1a1c1f]">{d.label}</span>
                                </td>
                                <td className="py-3 px-4 tabular-nums text-[#47464b]">{ringgit(d.value * 100)}</td>
                                <td className="py-3 px-4">
                                  <div className="inline-flex items-center rounded-lg border border-[#e2e2e6] bg-[#ffffff]">
                                    <button onClick={() => adjust(d.key, -1)} className="w-8 h-8 flex items-center justify-center text-[#47464b] hover:text-[#1a1c1f] hover:bg-[#f3f3f7] active:scale-[0.9] transition-all rounded">
                                      <span className="material-symbols-outlined text-[16px]">remove</span>
                                    </button>
                                    <input
                                      className="w-14 text-center text-[13.5px] leading-[18px] tracking-[0.01em] font-medium tabular-nums text-[#1a1c1f] border-x border-[#e2e2e6] focus:outline-none py-1 bg-transparent"
                                      type="number" min={0} value={counts[d.key]} onChange={(e) => setCount(d.key, e.target.value)}
                                    />
                                    <button onClick={() => adjust(d.key, 1)} className="w-8 h-8 flex items-center justify-center text-[#47464b] hover:text-[#1a1c1f] hover:bg-[#f3f3f7] active:scale-[0.9] transition-all rounded">
                                      <span className="material-symbols-outlined text-[16px]">add</span>
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right tabular-nums text-[13.5px] leading-[18px] tracking-[0.01em] text-[#1a1c1f] font-medium">{ringgit(counts[d.key] * d.value * 100)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-[#f3f3f7] p-4 border-t border-[#e2e2e6] flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-6 text-[13.5px] leading-5">
                          <div className="flex items-center gap-2">
                            <span className="text-[#47464b]">Float Retention (Safe Bag): </span>
                            <span className="relative inline-flex items-center">
                              <span className="absolute left-2 text-[#5e5e67] text-[12px]">RM</span>
                              <input
                                type="number" min={0}
                                value={floatCents / 100}
                                onChange={(e) => setFloatCents(Math.max(0, Math.round(Number(e.target.value) * 100)) || 0)}
                                className="w-24 pl-8 pr-2 py-1 rounded border border-[#c8c5cb]/50 text-[13px] tabular-nums focus:outline-none focus:border-[#000000]"
                              />
                            </span>
                          </div>
                          <div className="w-px h-4 bg-[#c8c5cb]" />
                          <div>
                            <span className="text-[#47464b]">Net Night Bank Deposit: </span>
                            <strong className="text-[#047857] font-semibold tabular-nums">{ringgit(netDepositCents)}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[#47464b] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase">Total Physical Count:</span>
                          <span className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(totalCountedCents)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#e2e2e6] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#47464b]">receipt_long</span>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Payment Channel Settlements</h2>
                        </div>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#77767b]">Today, by method</span>
                      </div>
                      {settlements.length === 0 ? (
                        <p className="text-[13.5px] text-[#77767b] py-8 text-center">No payments recorded today yet.</p>
                      ) : (
                        <div className="divide-y divide-[#e2e2e6]">
                          {settlements.map((g) => (
                            <div key={g.method} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#f3f3f7] transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#eeedf1] flex items-center justify-center flex-shrink-0 text-[#1a1c1f]">
                                  <span className="material-symbols-outlined text-[20px]">{g.isCash ? "payments" : "credit_card"}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">{g.method}</span>
                                  <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] mt-0.5">{g.count} transaction{g.count === 1 ? "" : "s"}</div>
                                </div>
                              </div>
                              <span className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(g.totalCents)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-4 bg-[#f3f3f7] border-t border-[#e2e2e6] flex items-center justify-between">
                        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#47464b]">Total Gross Settled</span>
                        <span className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(totalGrossCents)}</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] p-5">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e2e2e6]">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#47464b]">checklist</span>
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Closing Checklist</h3>
                        </div>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">{doneCount} / {checklist.length} Done</span>
                      </div>
                      <div className="flex flex-col gap-3 text-[13.5px] leading-5">
                        {checklist.map((item, i) => (
                          <label key={item.label} className={"flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer select-none " + (item.done ? "hover:bg-[#f3f3f7]" : "bg-[#f3f3f7] hover:bg-[#eeedf1]")}>
                            <input checked={item.done} onChange={() => toggleCheck(i)} className="mt-0.5 w-4 h-4 rounded border-[#c8c5cb] text-[#000000] focus:ring-0 cursor-pointer accent-[#000000]" type="checkbox" />
                            <span className="leading-tight text-[#1a1c1f]">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] p-5">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e2e2e6]">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#47464b]">local_atm</span>
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Petty Cash Payouts</h3>
                        </div>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#77767b]">Today</span>
                      </div>
                      {pettyCash.length === 0 ? (
                        <p className="text-[13px] text-[#77767b] py-4 text-center">No expenses recorded today.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {pettyCash.map((p) => (
                            <div key={p.id} className="p-3 rounded-lg border border-[#e2e2e6] flex items-center justify-between">
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f] truncate">{p.name}</span>
                                {p.note && p.note !== p.name && <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] truncate">{p.note}</span>}
                              </div>
                              <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#1a1c1f] tabular-nums shrink-0">{ringgit(p.amountCents)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 pt-3 border-t border-[#e2e2e6] flex items-center justify-between text-[13.5px] leading-5">
                        <span className="text-[#47464b]">Total Drawer Outflows:</span>
                        <span className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(pettyCash.reduce((s, p) => s + p.amountCents, 0))}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#47464b]">chat_bubble_outline</span>
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Handover Note to Morning Lead</h3>
                        </div>
                      </div>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Anything the morning team should know? (Not saved -- this device only, this session)"
                        className="w-full min-h-[80px] p-3 rounded-lg bg-[#f3f3f7] border border-[#e2e2e6] text-[13.5px] leading-5 text-[#1a1c1f] placeholder:text-[#77767b] focus:outline-none focus:bg-[#ffffff] focus:border-[#000000] resize-y"
                      />
                    </div>
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
