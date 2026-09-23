"use client";

import { useState } from "react";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Packages & Prepaid
 * Balance Ledger" (Task 405, pasted 2026-09-23) -- a new Management row
 * that didn't exist in the sidebar before this source.
 *
 * Client Component: the source wires two real onclick handlers on the
 * inspector panel --
 *   1. "Redeem 1 Session (Punch #04)" flips its own label to
 *      "Redeeming Session #04..." then, after 700ms, to
 *      "✓ Punch Confirmed & Logged" and turns the button emerald. It does
 *      NOT revert afterwards in his source -- ported the same way (no
 *      auto-reset), not invented.
 *   2. "Send WhatsApp Balance Slip" is a plain `alert(...)` in his source
 *      -- kept as a real `alert()` call here too, matching the same literal
 *      pattern already used for Schedule's Quick Slot Placement buttons.
 *
 * WHAT IS REAL AND WHAT IS NOT: every guest, package, balance and punch
 * history entry below is his own sample content. Nothing reads from or
 * writes to a database -- "Issue New Package", the category/sort/status
 * filters, the search box, export, pagination, and the two selects in the
 * inspector (Performing Stylist / Station) are exactly as inert in his
 * source as they are here.
 */

type PackageRow = {
  guest: string;
  cardId: string;
  vipBadge?: string;
  selected?: boolean;
  program: string;
  category: string;
  balanceLabel: string;
  balancePercent: number;
  balanceColor: "primary" | "amber";
  value: string;
  valueSub: string;
  expiry: string;
  expiryWarning?: boolean;
  host: string;
  actionLabel: string;
  actionStyle: "primary" | "outline";
};

const METRICS = [
  {
    label: "Prepaid Liability",
    icon: "account_balance_wallet",
    iconColor: "text-[#5e5e67]/70",
    value: "RM 42,850",
    suffix: ".00",
    note: "Escrow unearned float",
  },
  {
    label: "Active Cards",
    icon: "credit_card",
    iconColor: "text-[#5e5e67]/70",
    value: "68",
    suffix: "",
    note: "Across 54 VIP guests",
  },
  {
    label: "Redeemed (MTD)",
    icon: "check_circle",
    iconColor: "text-[#5e5e67]/70",
    value: "34",
    suffix: " uses",
    note: "RM 5,120 value drawn",
  },
  {
    label: "Expiring <30 Days",
    icon: "notifications_active",
    iconColor: "text-amber-600",
    value: "03",
    suffix: "",
    note: "WhatsApp prompt queued",
    noteColor: "text-amber-700",
  },
];

const CATEGORY_TABS = [
  { label: "All Packages", count: 68, active: true },
  { label: "Scalp & Spa Series", count: 32 },
  { label: "Color Refresh Pass", count: 21 },
  { label: "Cash Wallet Store-Value", count: 15 },
];

const PACKAGES: PackageRow[] = [
  {
    guest: "Amanda Choong",
    cardId: "#PK-8821",
    vipBadge: "VIP Plat",
    selected: true,
    program: "10-Session Kérastase Fusio-Dose Scalp Ritual",
    category: "Scalp Care Series",
    balanceLabel: "7 of 10",
    balancePercent: 70,
    balanceColor: "primary",
    value: "RM 1,470.00",
    valueSub: "Orig. RM 2,100.00",
    expiry: "24 Oct 2025",
    host: "Jasmine Teo",
    actionLabel: "Redeem",
    actionStyle: "primary",
  },
  {
    guest: "Datin Nora Al-Habshee",
    cardId: "#PK-8409",
    program: "6-Session Balayage Gloss & Color Lock",
    category: "Color Tech Series",
    balanceLabel: "2 of 6",
    balancePercent: 33,
    balanceColor: "amber",
    value: "RM 560.00",
    valueSub: "Orig. RM 1,680.00",
    expiry: "15 Dec 2024",
    expiryWarning: true,
    host: "Wei Lin",
    actionLabel: "View",
    actionStyle: "outline",
  },
  {
    guest: "Rachel Soo",
    cardId: "#PK-8211",
    program: "VIP Cash Wallet Deposit Credit",
    category: "Prepaid Store-Value",
    balanceLabel: "Store Credit",
    balancePercent: 42,
    balanceColor: "primary",
    value: "RM 840.00",
    valueSub: "Store Credit Balance",
    expiry: "No Expiry",
    host: "Jasmine Teo",
    actionLabel: "Deduct",
    actionStyle: "outline",
  },
  {
    guest: "Lim Wei Seng",
    cardId: "#PK-7902",
    program: "5-Session Scalp Peppermint Reset & Cut",
    category: "Scalp Care Series",
    balanceLabel: "1 of 5",
    balancePercent: 20,
    balanceColor: "primary",
    value: "RM 140.00",
    valueSub: "Orig. RM 700.00",
    expiry: "08 Jan 2025",
    host: "Amy Chen",
    actionLabel: "View",
    actionStyle: "outline",
  },
  {
    guest: "Marcus Tan",
    cardId: "#PK-7640",
    program: "Annual Gentlemen's Scissor Fade (12 Sessions)",
    category: "Grooming Master",
    balanceLabel: "8 of 12",
    balancePercent: 67,
    balanceColor: "primary",
    value: "RM 680.00",
    valueSub: "Orig. RM 1,020.00",
    expiry: "30 Mar 2025",
    host: "Amy Chen",
    actionLabel: "View",
    actionStyle: "outline",
  },
];

type PunchCell = { num: string; status: "done" | "today" | "future"; sublabel: string };

const PUNCH_CELLS: PunchCell[] = [
  { num: "01", status: "done", sublabel: "Jan 24" },
  { num: "02", status: "done", sublabel: "Apr 12" },
  { num: "03", status: "done", sublabel: "Jun 08" },
  { num: "04", status: "today", sublabel: "Today" },
  { num: "05", status: "future", sublabel: "RM 210" },
  { num: "06", status: "future", sublabel: "RM 210" },
  { num: "07", status: "future", sublabel: "RM 210" },
  { num: "08", status: "future", sublabel: "RM 210" },
  { num: "09", status: "future", sublabel: "RM 210" },
  { num: "10", status: "future", sublabel: "RM 210" },
];

const PUNCH_HISTORY = [
  { title: "Punch #03 · Fusio-Dose Oleo-Fusion", by: "Jasmine Teo · Bangsar Station 02", when: "08 Jun 2024 · 14:30" },
  { title: "Punch #02 · Fusio-Dose Concentré", by: "Jasmine Teo · Bangsar Basin 01", when: "12 Apr 2024 · 11:15" },
  { title: "Punch #01 · Activation & Scalp Camera", by: "Jasmine Teo · Welcome Consult", when: "24 Jan 2024 · 16:00" },
];

export default function SalonPackagesPreview() {
  const [redeemState, setRedeemState] = useState<"idle" | "redeeming" | "confirmed">("idle");

  const handleRedeem = () => {
    if (redeemState !== "idle") return;
    setRedeemState("redeeming");
    setTimeout(() => setRedeemState("confirmed"), 700);
  };

  const handleWhatsapp = () => {
    alert(
      "WhatsApp dispatch sent to Amanda Choong (+6012-8829104):\n\nHi Amanda, 1 session redeemed today at Wei Hair Studio Bangsar. 6 sessions remaining in your Kérastase Fusio-Dose Ritual package.",
    );
  };

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="packages-and-prepaid" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full px-7 py-7 bg-[#f9f9fd]">
            <div className="flex flex-col w-full">
              {/* Breadcrumb & Top Cluster */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 gap-3">
                <div className="flex items-center gap-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium tracking-wider uppercase text-[#5e5e67]">
                  <span>Operations</span>
                  <span className="text-[#c8c5cb]">/</span>
                  <span>Management</span>
                  <span className="text-[#c8c5cb]">/</span>
                  <span className="font-medium text-[#1a1c1f]">Packages &amp; Prepaid Balance Ledger</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#eeedf1] border border-[#c8c5cb]/40">
                    <span className="w-2 h-2 rounded-full bg-[#000000] animate-pulse" />
                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">
                      Prepaid Float:
                    </span>
                    <span className="text-[13.5px] leading-[18px] font-semibold text-[#1a1c1f] tabular-nums">RM 42,850.00</span>
                    <span className="text-[#c8c5cb] text-[11px]">|</span>
                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                      Active Liability Ledger
                    </span>
                  </div>
                  <button className="inline-flex items-center gap-1 px-3 h-9 bg-[#000000] text-[#ffffff] rounded hover:bg-[#1a1c1f] transition-all active:scale-[0.99] font-medium text-[13.5px] leading-5">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Issue New Package</span>
                    <kbd className="ml-1 px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-tighter bg-[#ffffff]/20 text-[#ffffff] rounded">
                      ⌘N
                    </kbd>
                  </button>
                </div>
              </div>

              {/* Split Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
                {/* LEFT 8 COLUMNS */}
                <div className="lg:col-span-8 flex flex-col gap-5 min-w-0">
                  {/* Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {METRICS.map((m) => (
                      <div
                        key={m.label}
                        className="bg-[#ffffff] p-4 rounded-xl border border-[#c8c5cb]/30 flex flex-col justify-between shadow-xs"
                      >
                        <div className="flex items-center justify-between text-[#5e5e67] mb-2.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5e5e67]">{m.label}</span>
                          <span className={"material-symbols-outlined text-[18px] " + m.iconColor}>{m.icon}</span>
                        </div>
                        <div>
                          <div className="text-[28px] leading-tight font-semibold text-[#1a1c1f] tabular-nums tracking-tight mb-0.5">
                            {m.value}
                            {m.suffix && <span className="text-[#5e5e67] text-base font-normal">{m.suffix}</span>}
                          </div>
                          <div className={"text-[11.5px] leading-4 tracking-[0.04em] font-medium " + (m.noteColor ?? "text-[#5e5e67]")}>
                            {m.note}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Filter Toolbar */}
                  <div className="bg-[#ffffff] p-4 rounded-xl border border-[#c8c5cb]/30 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between gap-3 border-b border-[#c8c5cb]/20 pb-3 flex-wrap">
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        {CATEGORY_TABS.map((t) => (
                          <button
                            key={t.label}
                            className={
                              "px-3.5 py-1.5 rounded-lg text-[13.5px] leading-5 whitespace-nowrap " +
                              (t.active ? "font-medium bg-[#000000] text-[#ffffff]" : "text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1] transition-colors")
                            }
                          >
                            {t.label} <span className={"ml-1 tabular-nums text-[12px] " + (t.active ? "opacity-70" : "text-[#5e5e67]/70")}>{t.count}</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase text-[#5e5e67]">Sort:</span>
                        <button className="text-[13.5px] leading-[18px] text-[#1a1c1f] font-medium flex items-center gap-1 hover:text-[#000000]">
                          Expiry Date <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                      <div className="relative w-full sm:max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#5e5e67]">search</span>
                        <input
                          className="w-full pl-9 pr-3 py-2 bg-[#f9f9fd] border border-[#c8c5cb]/40 rounded-lg text-[13.5px] leading-[18px] text-[#1a1c1f] placeholder:text-[#5e5e67] focus:outline-none focus:border-[#000000] transition-all"
                          placeholder="Search guest name, phone, card #PK-..."
                          type="text"
                          defaultValue="Amanda Choong"
                        />
                      </div>
                      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <div className="inline-flex rounded-lg border border-[#c8c5cb]/30 p-1 bg-[#f3f3f7]/70">
                          <button className="px-3 py-1 text-[11.5px] font-medium rounded-md bg-[#ffffff] text-[#1a1c1f] shadow-xs">
                            Status: Active
                          </button>
                          <button className="px-3 py-1 text-[11.5px] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors">
                            Expiring Soon (3)
                          </button>
                          <button className="px-3 py-1 text-[11.5px] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors">Depleted</button>
                        </div>
                        <button
                          title="Export Ledger"
                          className="p-2 border border-[#c8c5cb]/30 rounded-lg hover:bg-[#eeedf1] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">file_download</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#c8c5cb]/30 bg-[#eeedf1]/30">
                            <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider">
                              Guest &amp; Card ID
                            </th>
                            <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider">
                              Package Program
                            </th>
                            <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider">
                              Remaining Balance
                            </th>
                            <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider text-right">
                              Value / Float
                            </th>
                            <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider">
                              Expiry &amp; Host
                            </th>
                            <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider text-right">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#c8c5cb]/20 text-[13.5px] leading-[18px]">
                          {PACKAGES.map((p) => (
                            <tr
                              key={p.cardId}
                              className={
                                "transition-colors " + (p.selected ? "bg-[#f3f3f7]/80" : "hover:bg-[#eeedf1]/30")
                              }
                            >
                              <td className="py-3.5 px-5 align-middle">
                                <div className="flex items-center gap-3">
                                  {p.selected && <span className="w-2 h-2 rounded-full bg-[#000000] shrink-0" />}
                                  <div className={"flex flex-col min-w-0" + (!p.selected ? " pl-5" : "")}>
                                    <div className="font-medium text-[13.5px] text-[#1a1c1f] flex items-center gap-2">
                                      <span className="truncate">{p.guest}</span>
                                      {p.vipBadge && (
                                        <span className="px-2 py-0.5 bg-[#000000] text-[#ffffff] text-[10px] uppercase rounded-full tracking-wide shrink-0">
                                          {p.vipBadge}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] font-mono mt-0.5">
                                      {p.cardId}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-5 align-middle">
                                <div className="font-medium text-[13.5px] text-[#1a1c1f] truncate max-w-[220px]">{p.program}</div>
                                <span className="text-[11.5px] text-[#5e5e67] mt-0.5 block">{p.category}</span>
                              </td>
                              <td className="py-3.5 px-5 align-middle">
                                <div className="flex flex-col gap-1.5 w-32">
                                  <div className="flex justify-between text-[12px] text-[#1a1c1f]">
                                    <span className={"font-medium" + (p.balanceColor === "amber" ? " text-amber-700" : "")}>
                                      {p.balanceLabel}
                                    </span>
                                    <span className={p.balanceColor === "amber" ? "text-amber-700 font-medium" : "text-[#5e5e67]"}>
                                      {p.balancePercent}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-[#c8c5cb]/30 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={"h-1.5 rounded-full " + (p.balanceColor === "amber" ? "bg-amber-600" : "bg-[#000000]")}
                                      style={{ width: `${p.balancePercent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-right align-middle tabular-nums">
                                <div className="font-medium text-[#1a1c1f]">{p.value}</div>
                                <div className="text-[11px] text-[#5e5e67] mt-0.5">{p.valueSub}</div>
                              </td>
                              <td className="py-3.5 px-5 align-middle">
                                {p.expiryWarning ? (
                                  <div className="text-amber-700 font-medium tabular-nums flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="material-symbols-outlined text-[15px]">warning</span>
                                    <span>{p.expiry}</span>
                                  </div>
                                ) : (
                                  <div className={"tabular-nums " + (p.expiry === "No Expiry" ? "text-[#5e5e67] font-medium uppercase" : "text-[#1a1c1f]")}>
                                    {p.expiry}
                                  </div>
                                )}
                                <div className="text-[11.5px] text-[#5e5e67] flex items-center gap-1 mt-0.5">
                                  <span className="material-symbols-outlined text-[13px]">person</span>
                                  <span>{p.host}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-right align-middle">
                                <button
                                  className={
                                    "px-3 py-1.5 font-medium text-[11.5px] rounded-lg transition-colors " +
                                    (p.actionStyle === "primary"
                                      ? "bg-[#000000] text-[#ffffff] hover:bg-neutral-800 shadow-xs"
                                      : "border border-[#c8c5cb]/50 text-[#1a1c1f] hover:bg-[#eeedf1]")
                                  }
                                >
                                  {p.actionLabel}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 px-5 border-t border-[#c8c5cb]/30 flex items-center justify-between text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] bg-[#eeedf1]/20">
                      <div>
                        Showing <span className="font-medium text-[#1a1c1f] tabular-nums">1</span> to{" "}
                        <span className="font-medium text-[#1a1c1f] tabular-nums">5</span> of{" "}
                        <span className="font-medium text-[#1a1c1f] tabular-nums">68</span> active packages
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button disabled className="px-3 py-1 border border-[#c8c5cb]/50 rounded-md text-[#1a1c1f] disabled:opacity-40">
                          Previous
                        </button>
                        <button className="px-3 py-1 bg-[#e2e2e6] text-[#1a1c1f] rounded-md font-medium">1</button>
                        <button className="px-3 py-1 border border-[#c8c5cb]/30 rounded-md hover:bg-[#eeedf1] transition-colors">2</button>
                        <button className="px-3 py-1 border border-[#c8c5cb]/30 rounded-md hover:bg-[#eeedf1] transition-colors">3</button>
                        <button className="px-3 py-1 border border-[#c8c5cb]/50 rounded-md text-[#1a1c1f] hover:bg-[#eeedf1] transition-colors">
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT 4 COLUMNS: Inspection & Quick Redeem */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 overflow-hidden shadow-xs">
                    <div className="p-5 border-b border-[#c8c5cb]/20 flex items-center justify-between bg-[#eeedf1]/20">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-base leading-6 tracking-[-0.01em] text-[#1a1c1f] font-semibold tracking-tight">
                          Inspection &amp; Quick Redeem
                        </span>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5 tabular-nums">
                          Card #PK-8821 · Live Terminal
                        </span>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 shrink-0 self-center">
                        Active Pass
                      </span>
                    </div>
                    <div className="p-6 space-y-6">
                      {/* Guest info */}
                      <div className="p-3.5 bg-[#f3f3f7]/60 rounded-xl border border-[#c8c5cb]/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center text-[11.5px] font-medium shrink-0">
                            AC
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13.5px] leading-[18px] text-[#1a1c1f] truncate font-semibold">Amanda Choong</span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] tabular-nums">
                              +60 12-882 9104
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase text-[#5e5e67] block">Assigned Stylist</span>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#1a1c1f]">Jasmine Teo</span>
                        </div>
                      </div>

                      {/* Package info */}
                      <div className="space-y-2 text-[13.5px] leading-[18px]">
                        <div className="text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] font-semibold">
                          10-Session Kérastase Fusio-Dose Scalp Ritual
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[11.5px] pt-2 pb-3 border-b border-[#c8c5cb]/20">
                          <div>
                            <span className="text-[#5e5e67] block">Purchased Date</span>
                            <span className="font-medium text-[#1a1c1f] tabular-nums mt-0.5 block">12 Jan 2024 · #INV-0192</span>
                          </div>
                          <div>
                            <span className="text-[#5e5e67] block">Original Price Paid</span>
                            <span className="font-medium text-[#1a1c1f] tabular-nums mt-0.5 block">RM 2,100 (RM 210/sess)</span>
                          </div>
                        </div>
                        <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] leading-relaxed">
                          Includes complimentary blowdry finish. Shareable with direct family members. Valid until 24 Oct 2025.
                        </p>
                      </div>

                      {/* Punch-card status */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[11.5px] text-[#5e5e67]">
                          <span className="uppercase tracking-wider text-[11.5px] leading-4 tracking-[0.06em] font-semibold">
                            Punch-Card Status
                          </span>
                          <span className="tabular-nums font-medium text-[#1a1c1f]">3 Consumed · 7 Remaining</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2.5 p-3.5 bg-[#eeedf1]/40 rounded-xl border border-[#c8c5cb]/30">
                          {PUNCH_CELLS.map((c) => (
                            <div
                              key={c.num}
                              className={
                                "flex flex-col items-center justify-center py-2.5 px-1 rounded-lg aspect-square select-none " +
                                (c.status === "today"
                                  ? "bg-[#000000] text-[#ffffff] relative shadow-sm ring-2 ring-[#000000] ring-offset-2"
                                  : c.status === "done"
                                    ? "bg-[#ffffff] border border-[#c8c5cb]/40"
                                    : "bg-[#ffffff]/60 border border-dashed border-[#c8c5cb]/70")
                              }
                            >
                              <span
                                className={
                                  "material-symbols-outlined " +
                                  (c.status === "today"
                                    ? "text-[18px] animate-pulse"
                                    : c.status === "done"
                                      ? "text-[18px] text-[#000000]"
                                      : "text-[16px] text-[#c8c5cb]")
                                }
                              >
                                {c.status === "done" ? "check_circle" : c.status === "today" ? "radio_button_checked" : "circle"}
                              </span>
                              <span
                                className={
                                  "text-[10px] font-mono mt-1 leading-none " +
                                  (c.status === "today" ? "font-bold" : c.status === "done" ? "font-medium text-[#1a1c1f]" : "text-[#5e5e67]")
                                }
                              >
                                #{c.num}
                              </span>
                              <span
                                className={
                                  "text-[9px] mt-1 leading-none " +
                                  (c.status === "today"
                                    ? "uppercase tracking-tighter opacity-90 font-medium"
                                    : c.status === "done"
                                      ? "text-[#5e5e67]"
                                      : "text-[#5e5e67]/70")
                                }
                              >
                                {c.sublabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Redeem controls */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] uppercase tracking-wider mb-1.5">
                              Performing Stylist
                            </label>
                            <select
                              className="w-full h-9 px-3 bg-[#f9f9fd] border border-[#c8c5cb]/40 rounded-lg text-[13.5px] leading-[18px] text-[#1a1c1f] focus:outline-none focus:border-[#000000] transition-colors cursor-pointer"
                              defaultValue="Jasmine Teo (Master)"
                            >
                              <option>Jasmine Teo (Master)</option>
                              <option>Wei Lin (Director)</option>
                              <option>Amy Chen (Senior)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] uppercase tracking-wider mb-1.5">
                              Station / Bay
                            </label>
                            <select
                              className="w-full h-9 px-3 bg-[#f9f9fd] border border-[#c8c5cb]/40 rounded-lg text-[13.5px] leading-[18px] text-[#1a1c1f] focus:outline-none focus:border-[#000000] transition-colors cursor-pointer"
                              defaultValue="Basin 01 / Chair #03"
                            >
                              <option>Basin 01 / Chair #03</option>
                              <option>Basin 02 / Chair #04</option>
                              <option>Styling Bay 01</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] uppercase mb-1.5">
                            Session Service Notes
                          </label>
                          <input
                            className="w-full h-9 px-3 bg-[#f9f9fd] border border-[#c8c5cb]/40 rounded-lg text-[13.5px] leading-[18px] text-[#1a1c1f] placeholder:text-[#5e5e67] focus:outline-none focus:border-[#000000]"
                            type="text"
                            defaultValue="Client requested extra Chronologiste masque sample"
                          />
                        </div>
                        <div className="space-y-2.5 pt-1">
                          <button
                            onClick={handleRedeem}
                            className={
                              "w-full h-10 rounded-lg font-medium text-[13.5px] leading-5 flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-xs " +
                              (redeemState === "confirmed" ? "bg-emerald-700 text-[#ffffff]" : "bg-[#000000] text-[#ffffff] hover:bg-neutral-800")
                            }
                          >
                            {redeemState !== "confirmed" && <span className="material-symbols-outlined text-[18px]">confirmation_number</span>}
                            <span>
                              {redeemState === "idle"
                                ? "Redeem 1 Session (Punch #04)"
                                : redeemState === "redeeming"
                                  ? "Redeeming Session #04..."
                                  : "✓ Punch Confirmed & Logged"}
                            </span>
                          </button>
                          <button
                            onClick={handleWhatsapp}
                            className="w-full h-9 border border-[#c8c5cb]/50 text-[#5e5e67] hover:text-[#1a1c1f] bg-[#ffffff] rounded-lg font-medium text-[11.5px] flex items-center justify-center gap-2 hover:bg-[#eeedf1] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                            <span>Send WhatsApp Balance Slip</span>
                          </button>
                        </div>
                      </div>

                      {/* Audit trail */}
                      <div className="pt-4 border-t border-[#c8c5cb]/20 space-y-3">
                        <div className="flex items-center justify-between text-[11.5px] text-[#5e5e67] uppercase tracking-wider">
                          <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold">Audit Trail &amp; Previous Punches</span>
                          <span className="tabular-nums">3 entries</span>
                        </div>
                        <div className="space-y-2 text-[12px]">
                          {PUNCH_HISTORY.map((h) => (
                            <div
                              key={h.title}
                              className="flex items-start justify-between p-3 rounded-lg bg-[#f3f3f7]/60 border border-[#c8c5cb]/20"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-[#1a1c1f]">{h.title}</span>
                                <span className="text-[#5e5e67] text-[11px] mt-0.5">{h.by}</span>
                              </div>
                              <div className="text-right text-[#5e5e67] tabular-nums text-[11px]">{h.when}</div>
                            </div>
                          ))}
                        </div>
                      </div>
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
