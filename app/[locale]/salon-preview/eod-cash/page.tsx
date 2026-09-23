"use client";

import { useState } from "react";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "End of Day Cash &
 * Register Reconciliation" (Task 405, pasted 2026-09-23).
 *
 * Client Component: unlike Lookbook/Stylists, this source has REAL vanilla
 * JS behind it (adjustCount/updateLine/toggleCheck/the lock button's
 * setTimeout dance) -- the +/- steppers, the checklist counter, and the
 * variance/net-deposit figures all actually recompute live. Ported to
 * useState so the same behaviour survives, not re-invented.
 *
 * WHAT IS REAL AND WHAT IS NOT: the denomination counts, checklist,
 * payment-gateway settlement rows, petty cash, handover note, and staff
 * sign-off are all his own sample content. All the arithmetic (line
 * subtotals, total counted, variance, net deposit) is computed here in the
 * browser exactly like his script did -- nothing is written to a database,
 * "Print Summary" / "Export Shift PDF" do nothing, and "Lock Drawer" only
 * plays the same fake 1.2s spinner his source did before flipping to a
 * "Locked" label -- it does not persist anywhere.
 */

type DenomKey = "c100" | "c50" | "c20" | "c10" | "c5" | "c1";

const DENOMINATIONS: { key: DenomKey; label: string; value: number; badgeClasses: string }[] = [
  { key: "c100", label: "Banknote RM 100", value: 100, badgeClasses: "bg-purple-50 text-purple-800 border-purple-200" },
  { key: "c50", label: "Banknote RM 50", value: 50, badgeClasses: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { key: "c20", label: "Banknote RM 20", value: 20, badgeClasses: "bg-amber-50 text-amber-800 border-amber-200" },
  { key: "c10", label: "Banknote RM 10", value: 10, badgeClasses: "bg-red-50 text-red-800 border-red-200" },
  { key: "c5", label: "Banknote RM 5", value: 5, badgeClasses: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { key: "c1", label: "Banknote RM 1", value: 1, badgeClasses: "bg-blue-50 text-blue-800 border-blue-200" },
];

const INITIAL_COUNTS: Record<DenomKey, number> = { c100: 8, c50: 10, c20: 4, c10: 8, c5: 3, c1: 5 };

const EXPECTED_CASH = 1480;
const FLOAT_SAFE = 350;

const CHECKLIST_INITIAL: { label: string; done: boolean }[] = [
  { label: "Cash drawer physically verified & float RM 350 locked in safe", done: true },
  { label: "Credit card terminal batch settlement receipt printed & stapled", done: true },
  { label: "DuitNow QR incoming transaction log matched with POS orders", done: true },
  { label: "Dispensary chemical waste locked & mixing scales powered off", done: true },
  { label: "Towel autoclave sterilizer cycle initiated (final check)", done: false },
];

const GATEWAYS = [
  {
    icon: "credit_card",
    name: "Maybank EDC Terminal #1",
    detail: "14 transactions · Batch #089 · Terminal TID: 4099-2811",
    amount: "RM 1,280.00",
    note: "Slip Stapled & Verified",
    tag: "Matched",
  },
  {
    icon: "qr_code_2",
    name: "DuitNow Instant QR Hub",
    detail: "21 slips auto-verified · Instant Merchant API Settled",
    amount: "RM 3,980.00",
    note: "Cloud Audit Sync Clean",
    tag: "Matched",
  },
  {
    icon: "savings",
    name: "Cash Register Net Takings",
    detail: "7 guest transactions · Excluding Morning Float of RM 350.00",
    amount: "RM 1,130.00",
    note: "Total Gross RM 1,193 - RM 63 Payouts",
    tag: "Count Verified",
  },
];

const PETTY_CASH = [
  { name: "Fresh Towels Laundry Express", detail: "Paid from drawer · Receipt #8812", amount: "RM 45.00" },
  { name: "Drinking Water & Salon Milk", detail: "Paid from drawer · Receipt #8815", amount: "RM 18.00" },
];

function ringgit(n: number) {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SalonEodCashPreview() {
  const [counts, setCounts] = useState<Record<DenomKey, number>>(INITIAL_COUNTS);
  const [checklist, setChecklist] = useState(CHECKLIST_INITIAL);
  const [lockState, setLockState] = useState<"idle" | "locking" | "locked">("idle");

  const adjust = (key: DenomKey, delta: number) => {
    setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  };

  const setCount = (key: DenomKey, raw: string) => {
    const n = parseInt(raw, 10);
    setCounts((prev) => ({ ...prev, [key]: Number.isNaN(n) || n < 0 ? 0 : n }));
  };

  const toggleCheck = (index: number) => {
    setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item)));
  };

  const total = DENOMINATIONS.reduce((sum, d) => sum + counts[d.key] * d.value, 0);
  const variance = total - EXPECTED_CASH;
  const netDeposit = Math.max(0, total - FLOAT_SAFE);
  const doneCount = checklist.filter((c) => c.done).length;

  const varianceColor = variance === 0 ? "text-[#047857]" : variance > 0 ? "text-[#1d4ed8]" : "text-[#be123c]";
  const varianceText = variance === 0 ? ringgit(0) : variance > 0 ? `+${ringgit(variance)}` : `-${ringgit(Math.abs(variance))}`;

  const handleLock = () => {
    setLockState("locking");
    setTimeout(() => setLockState("locked"), 1200);
  };

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="end-of-day-cash" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full px-8 pt-0 bg-[#f9f9fd] min-h-screen">
            <div className="flex flex-col w-full pb-16">
              {/* Breadcrumb & Context Strip */}
              <div className="pt-6 pb-4 flex items-center justify-between border-b border-[#e2e2e6]">
                <div className="flex items-center gap-2 text-[#47464b] text-[11.5px] leading-4 tracking-[0.04em] font-medium tracking-wider uppercase">
                  <span>Operations</span>
                  <span>/</span>
                  <span>Management</span>
                  <span>/</span>
                  <span className="text-[#1a1c1f] font-semibold">Shift Reconciliation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#eeedf1] text-[#47464b]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Register Terminal #01 (Main Floor)
                  </span>
                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">Bangsar Flagship</span>
                </div>
              </div>

              {/* Page Header & Action Toolbar */}
              <div className="py-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e2e2e6]">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold tracking-tight text-[#1a1c1f]">
                      End of Day Cash &amp; Register Reconciliation
                    </h1>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#e8e8ec] text-[#47464b] tracking-wide">
                      Shift #2024-1024 · Evening Close
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-5 text-[#47464b] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#77767b]">schedule</span>
                    <span>Thursday, 24 Oct 2024 · Shift window 10:00 – 20:45</span>
                    <span className="text-[#77767b]">·</span>
                    <span>
                      Logged Lead: <strong className="text-[#1a1c1f] font-medium">Wei Lin</strong>
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#ffffff] border border-[#c8c5cb] hover:bg-[#f3f3f7] text-[#1a1c1f] text-[13.5px] leading-5 font-medium transition-colors">
                    <span className="material-symbols-outlined text-[17px] text-[#47464b]">print</span>
                    <span>Print Summary</span>
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#ffffff] border border-[#c8c5cb] hover:bg-[#f3f3f7] text-[#1a1c1f] text-[13.5px] leading-5 font-medium transition-colors">
                    <span className="material-symbols-outlined text-[17px] text-[#47464b]">file_download</span>
                    <span>Export Shift PDF</span>
                  </button>
                  <button
                    onClick={handleLock}
                    disabled={lockState !== "idle"}
                    className={
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] leading-5 font-medium transition-colors active:scale-[0.99] " +
                      (lockState === "locked"
                        ? "bg-[#e8e8ec] text-[#1a1c1f]"
                        : "bg-[#000000] hover:bg-[#1b1b1e] text-[#ffffff]")
                    }
                  >
                    <span className={"material-symbols-outlined text-[17px]" + (lockState === "locking" ? " animate-spin" : "")}>
                      {lockState === "idle" ? "lock" : lockState === "locking" ? "refresh" : "lock_clock"}
                    </span>
                    <span>
                      {lockState === "idle"
                        ? "Lock Drawer & Submit Reconciliation"
                        : lockState === "locking"
                          ? "Transmitting Settlement..."
                          : "Shift Locked & Dispatched"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Summary Strip */}
              <div className="py-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-[#ffffff] border border-[#e2e2e6] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#77767b]">
                      Expected Cash in Drawer
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-[#77767b]">account_balance_wallet</span>
                  </div>
                  <div className="mt-3">
                    <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#1a1c1f] tabular-nums">
                      {ringgit(EXPECTED_CASH)}
                    </div>
                    <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] mt-1">
                      Float RM 350.00 + Net Takings RM 1,130.00
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#ffffff] border border-[#e2e2e6] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#77767b]">
                      Cash Counted by Staff
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-[#77767b]">payments</span>
                  </div>
                  <div className="mt-3">
                    <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#1a1c1f] tabular-nums">
                      {ringgit(total)}
                    </div>
                    <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] mt-1">
                      Verified across 6 physical note categories
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#ffffff] border border-[#e2e2e6] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#77767b]">
                      Cash Variance
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      Balanced
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className={"text-[30px] leading-9 tracking-[-0.025em] font-semibold tabular-nums " + varianceColor}>
                      {varianceText}
                    </div>
                    <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] mt-1">
                      Zero discrepancy · Ready for lock &amp; safe deposit
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#ffffff] border border-[#e2e2e6] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#77767b]">
                      Total Shift Gross
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-[#77767b]">pie_chart</span>
                  </div>
                  <div className="mt-3">
                    <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#1a1c1f] tabular-nums">
                      RM 6,420.00
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">
                      <span>QR 62%</span>
                      <span>·</span>
                      <span>Card 20%</span>
                      <span>·</span>
                      <span>Cash 18%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Two-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  {/* Physical Cash Denomination Count */}
                  <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#e2e2e6] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#47464b]">calculate</span>
                        <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                          Physical Cash Denomination Count
                        </h2>
                      </div>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#77767b]">
                        Drawer #01 Closing Verification
                      </span>
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
                                <span
                                  className={
                                    "inline-block w-6 text-center text-[11.5px] leading-4 tracking-[0.04em] font-bold py-0.5 rounded border " +
                                    d.badgeClasses
                                  }
                                >
                                  {d.value}
                                </span>
                                <span className="font-medium text-[#1a1c1f]">{d.label}</span>
                              </td>
                              <td className="py-3 px-4 tabular-nums text-[#47464b]">{ringgit(d.value)}</td>
                              <td className="py-3 px-4">
                                <div className="inline-flex items-center rounded-lg border border-[#e2e2e6] bg-[#ffffff]">
                                  <button
                                    onClick={() => adjust(d.key, -1)}
                                    className="w-8 h-8 flex items-center justify-center text-[#47464b] hover:text-[#1a1c1f] hover:bg-[#f3f3f7] transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">remove</span>
                                  </button>
                                  <input
                                    className="w-14 text-center text-[13.5px] leading-[18px] tracking-[0.01em] font-medium tabular-nums text-[#1a1c1f] border-x border-[#e2e2e6] focus:outline-none py-1 bg-transparent"
                                    type="number"
                                    min={0}
                                    value={counts[d.key]}
                                    onChange={(e) => setCount(d.key, e.target.value)}
                                  />
                                  <button
                                    onClick={() => adjust(d.key, 1)}
                                    className="w-8 h-8 flex items-center justify-center text-[#47464b] hover:text-[#1a1c1f] hover:bg-[#f3f3f7] transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-[13.5px] leading-[18px] tracking-[0.01em] text-[#1a1c1f] font-medium">
                                {ringgit(counts[d.key] * d.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-[#f3f3f7] p-4 border-t border-[#e2e2e6] flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-6 text-[13.5px] leading-5">
                        <div>
                          <span className="text-[#47464b]">Float Retention (Safe Bag): </span>
                          <strong className="text-[#1a1c1f] font-semibold tabular-nums">{ringgit(FLOAT_SAFE)}</strong>
                        </div>
                        <div className="w-px h-4 bg-[#c8c5cb]" />
                        <div>
                          <span className="text-[#47464b]">Net Night Bank Deposit: </span>
                          <strong className="text-[#047857] font-semibold tabular-nums">{ringgit(netDeposit)}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#47464b] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase">
                          Total Physical Count:
                        </span>
                        <span className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                          {ringgit(total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Channel & EDC Settlements */}
                  <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#e2e2e6] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#47464b]">receipt_long</span>
                        <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                          Payment Channel &amp; EDC Settlements
                        </h2>
                      </div>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#77767b]">
                        Batch Verification
                      </span>
                    </div>
                    <div className="divide-y divide-[#e2e2e6]">
                      {GATEWAYS.map((g) => (
                        <div
                          key={g.name}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#f3f3f7] transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#eeedf1] flex items-center justify-center flex-shrink-0 text-[#1a1c1f]">
                              <span className="material-symbols-outlined text-[20px]">{g.icon}</span>
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                                  {g.name}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {g.tag}
                                </span>
                              </div>
                              <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] mt-0.5">
                                {g.detail}
                              </div>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-end justify-between sm:justify-center">
                            <span className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                              {g.amount}
                            </span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">{g.note}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-[#f3f3f7] border-t border-[#e2e2e6] flex items-center justify-between">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#47464b]">
                        Total Gross Settled Through All Portals
                      </span>
                      <span className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tabular-nums">
                        RM 6,420.00
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  {/* Closing Checklist */}
                  <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] p-5">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e2e2e6]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#47464b]">checklist</span>
                        <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Closing Checklist</h3>
                      </div>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">
                        {doneCount} / {checklist.length} Done
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 text-[13.5px] leading-5">
                      {checklist.map((item, i) => (
                        <label
                          key={item.label}
                          className={
                            "flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer select-none " +
                            (item.done ? "hover:bg-[#f3f3f7]" : "bg-[#f3f3f7] hover:bg-[#eeedf1]")
                          }
                        >
                          <input
                            checked={item.done}
                            onChange={() => toggleCheck(i)}
                            className="mt-0.5 w-4 h-4 rounded border-[#c8c5cb] text-[#000000] focus:ring-0 cursor-pointer accent-[#000000]"
                            type="checkbox"
                          />
                          <span className={"leading-tight " + (item.done ? "text-[#1a1c1f]" : "text-[#1a1c1f] font-medium")}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Petty Cash Payouts */}
                  <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] p-5">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e2e2e6]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#47464b]">local_atm</span>
                        <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Petty Cash Payouts</h3>
                      </div>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#77767b]">
                        Today
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {PETTY_CASH.map((p) => (
                        <div
                          key={p.name}
                          className="p-3 rounded-lg border border-[#e2e2e6] flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                              {p.name}
                            </span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">{p.detail}</span>
                          </div>
                          <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#1a1c1f] tabular-nums">
                            {p.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#e2e2e6] flex items-center justify-between text-[13.5px] leading-5">
                      <span className="text-[#47464b]">Total Drawer Outflows:</span>
                      <span className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                        RM 63.00
                      </span>
                    </div>
                  </div>

                  {/* Handover Note to Morning Lead */}
                  <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#47464b]">chat_bubble_outline</span>
                        <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                          Handover Note to Morning Lead
                        </h3>
                      </div>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">Shift Log</span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#f3f3f7] border border-[#e2e2e6]">
                      <p className="text-[13.5px] leading-5 text-[#1a1c1f] italic leading-relaxed">
                        &ldquo;Evening rush finished smoothly. Bay 02 dryer filter cleaned. Tomorrow first appointment is Datin
                        Nora 10:00 AM with Jasmine.&rdquo;
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-[#e2e2e6] flex items-center justify-between text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">
                        <span>Posted by Wei Lin</span>
                        <span>20:41 PM</span>
                      </div>
                    </div>
                  </div>

                  {/* Staff Witness Sign-Off */}
                  <div className="rounded-xl border border-[#c8c5cb]/30 shadow-sm bg-[#ffffff] p-5">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#e2e2e6]">
                      <span className="material-symbols-outlined text-[18px] text-[#47464b]">verified_user</span>
                      <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Staff Witness Sign-Off</h3>
                    </div>
                    <div className="flex flex-col gap-3 text-[13.5px] leading-5">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-[#e2e2e6] bg-[#f3f3f7]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center text-[#ffffff] text-[11.5px] leading-4 tracking-[0.04em] font-bold">
                            WL
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-[#1a1c1f]">Wei Lin</span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">
                              Floor Lead &amp; Director
                            </span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-emerald-700">
                          <span className="material-symbols-outlined text-[14px]">check</span>
                          Closed 20:45
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-[#e2e2e6] bg-[#ffffff]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#e8e8ec] flex items-center justify-center text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-bold">
                            JT
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-[#1a1c1f]">Jasmine Teo</span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">
                              Master Stylist (Witness)
                            </span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-emerald-700">
                          <span className="material-symbols-outlined text-[14px]">check</span>
                          Witnessed 20:48
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 flex items-center justify-between text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#77767b]">
                      <span>Hash: e81b29a...04a</span>
                      <span>Security Lock Ready</span>
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
