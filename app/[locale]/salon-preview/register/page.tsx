"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Register & Checkout"
 * (the POS terminal, Task 405, pasted 2026-09-23). Task 405 flagged this page
 * as needing genuinely new backend (a cart/folio, split payment, a cash
 * drawer float) -- nothing here reads from any database, it is his own
 * sample content, frozen at the one moment his mockup depicts (Datin Nora's
 * folio already carries two items).
 *
 * "use client": kept the source's own two real behaviours (payment-method
 * selection toggle, Cmd/Ctrl+K focuses the search box) rather than drop them
 * -- the item "+" buttons had no handler in the source either, so they stay
 * inert here too, matching what he actually designed rather than inventing
 * cart logic that doesn't exist yet.
 */
const PAYMENT_METHODS = [
  { key: "qr", icon: "qr_code_scanner", label: "DuitNow QR", note: "Instant Settlement" },
  { key: "card", icon: "credit_card", label: "Terminal EDC", note: "Visa / Master" },
  { key: "cash", icon: "payments", label: "Cash Drawer", note: "Exact / Change" },
  { key: "pass", icon: "loyalty", label: "Prepaid Pass", note: "Bal: RM 1,200" },
] as const;

const CATEGORY_TABS = [
  "All Catalog (10)",
  "Cuts & Blowdry",
  "Color & Balayage",
  "Scalp & Spa Treatments",
  "Retail Products (Take-home)",
];

const CATALOG: {
  tag: string;
  tagTone?: "info";
  minutes?: string;
  unit?: string;
  name: string;
  note: string;
  price: string;
  active?: boolean;
}[] = [
  { tag: "Cut & Style", minutes: "45 min", name: "Haircut & Signature Blowdry", note: "Consultation, detox shampoo, precision razor/shear finish", price: "RM 120.00" },
  { tag: "Men's Grooming", minutes: "35 min", name: "Men's Precision Fade & Wash", note: "Taper skin fade, hot eucalyptus towel scalp cleanse", price: "RM 80.00" },
  { tag: "Signature Color", tagTone: "info", minutes: "150 min", name: "Full Balayage & Gloss Lift", note: "Freehand hand-painted blonding, custom acidic gloss toner", price: "RM 480.00", active: true },
  { tag: "Color", minutes: "60 min", name: "Root Retouch Majirel 6.1", note: "Ash brown 100% white hair coverage with Ionène G", price: "RM 180.00" },
  { tag: "Scalp Clinic", minutes: "45 min", name: "Kérastase Fusio-Dose Ritual", note: "Concentré + Booster tailored fusion with micro-mist cap", price: "RM 240.00" },
  { tag: "Repair Spa", minutes: "60 min", name: "Tokio Inkarami Bond Repair", note: "Fullerene patented 4-step keratin molecular infusion", price: "RM 320.00" },
  { tag: "Texture & Smoothing", minutes: "90 min", name: "Brazilian Keratin Express Seal", note: "Anti-frizz humidity shield, lasting shine & alignment", price: "RM 380.00" },
  { tag: "Retail Boutique", unit: "100ml", name: "Kérastase Chronologiste Oil", note: "Huile de Parfum luxury shine oil, Persian lime & tea rose", price: "RM 220.00", active: true },
  { tag: "Retail Boutique", unit: "100ml", name: "Olaplex No. 3 Hair Perfector", note: "Weekly home bond builder for bleached & damaged hair", price: "RM 165.00" },
];

const PARKED_FOLIOS = [
  { chair: "Chair 01 · Marcus Tan (VIP)", detail: "Fade + Scalp Detox · Kevin Lim", price: "RM 210.00", ago: "25m ago" },
  { chair: "Chair 05 · Walk-in Guest (Sarah)", detail: "Blowdry & Olaplex #3 Retail · Kelly", price: "RM 285.00", ago: "8m ago" },
];

export default function SalonRegisterPreview() {
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["key"]>("qr");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#ffffff] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="register-and-checkout" />
        <div className="pl-64 min-h-screen bg-[#ffffff]">
          <main className="w-full pt-0 bg-[#ffffff] min-h-screen">
            <div className="flex flex-col w-full">
              <div className="p-8 w-full max-w-[1720px] mx-auto space-y-6">
                {/* Top Utility Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#c8c5cb]/20">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#1a9a4d] animate-pulse" />
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#1a1c1f]">
                        Terminal 01 · Bangsar Telawi Studio
                      </span>
                    </div>
                    <span className="text-[#c8c5cb]/60 text-xs">/</span>
                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#eeedf1] px-2.5 py-1 rounded text-[#5e5e67] font-medium">
                      Cashier: Wei Lin (Lead)
                    </span>
                  </div>
                  <div className="flex items-center gap-5 text-[13.5px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">
                        Shift Takings:
                      </span>
                      <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                        RM 3,420.00
                      </span>
                    </div>
                    <div className="h-3.5 w-px bg-[#c8c5cb]/30" />
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">
                        Settled:
                      </span>
                      <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                        14 / 19
                      </span>
                    </div>
                    <div className="h-3.5 w-px bg-[#c8c5cb]/30" />
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">
                        Drawer:
                      </span>
                      <span className="text-[13.5px] leading-[18px] tracking-[0.01em] text-[#1a9a4d] font-semibold tabular-nums">
                        RM 350.00 (Balanced)
                      </span>
                    </div>
                    <div className="h-3.5 w-px bg-[#c8c5cb]/30" />
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#eeedf1]">
                      <span className="material-symbols-outlined text-[15px] text-[#1a9a4d]">wifi_tethering</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase font-medium text-[#1a1c1f]">
                        Maybank EDC #442 Online
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Workspace Split */}
                <div className="flex flex-col xl:flex-row gap-8 items-start w-full">
                  {/* LEFT: Catalog */}
                  <div className="flex-1 w-full min-w-0 flex flex-col space-y-6">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#5e5e67]">
                          search
                        </span>
                        <input
                          ref={searchRef}
                          className="w-full h-10 pl-10 pr-20 rounded-lg bg-[#ffffff] text-[#1a1c1f] placeholder:text-[#5e5e67]/70 focus:outline-none focus:ring-1 focus:ring-[#000000] shadow-sm border border-[#c8c5cb]/30 text-[13.5px] leading-5 font-normal"
                          placeholder="Search service, shade code, or retail SKU... (⌘K)"
                          type="text"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                          <kbd className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#5e5e67] bg-[#eeedf1] rounded border border-[#c8c5cb]/20">
                            ⌘K
                          </kbd>
                        </div>
                      </div>
                      <button className="h-10 px-3.5 rounded-lg bg-[#ffffff] hover:bg-[#eeedf1] text-[#1a1c1f] text-[13.5px] leading-5 font-normal flex items-center gap-2 shadow-sm border border-[#c8c5cb]/30 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
                        <span>Scan SKU</span>
                      </button>
                      <button className="h-10 px-3.5 rounded-lg bg-[#ffffff] hover:bg-[#eeedf1] text-[#1a1c1f] text-[13.5px] leading-5 font-normal flex items-center gap-2 shadow-sm border border-[#c8c5cb]/30 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">tune</span>
                        <span>Filter</span>
                      </button>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                      {CATEGORY_TABS.map((tab, i) => (
                        <button
                          key={tab}
                          className={
                            "h-8 px-3.5 rounded-full text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase transition-colors flex items-center whitespace-nowrap " +
                            (i === 0
                              ? "bg-[#000000] text-[#ffffff] shadow-sm"
                              : "bg-[#ffffff] hover:bg-[#eeedf1] text-[#5e5e67] hover:text-[#1a1c1f] border border-[#c8c5cb]/30")
                          }
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Item Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {CATALOG.map((item) => (
                        <div
                          key={item.name}
                          className={
                            "group relative p-4 rounded-xl bg-[#ffffff] hover:shadow-md transition-all flex flex-col justify-between cursor-pointer " +
                            (item.active ? "border-2 border-[#000000]" : "border border-[#c8c5cb]/30")
                          }
                        >
                          {item.active && (
                            <div className="absolute -top-2.5 right-3 bg-[#000000] text-[#ffffff] text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">
                              In Active Ticket
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={
                                  "text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider px-2 py-0.5 rounded font-medium " +
                                  (item.tagTone === "info" ? "bg-[#3b62d9]/10 text-[#3b62d9]" : "bg-[#eeedf1] text-[#5e5e67]")
                                }
                              >
                                {item.tag}
                              </span>
                              <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">
                                  {item.minutes ? "schedule" : "inventory_2"}
                                </span>
                                {item.minutes ?? item.unit}
                              </span>
                            </div>
                            <h3 className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-semibold text-[#1a1c1f] group-hover:text-[#000000] transition-colors leading-snug">
                              {item.name}
                            </h3>
                            <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] leading-relaxed">{item.note}</p>
                          </div>
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#c8c5cb]/20">
                            <span className="text-[16px] text-[#1a1c1f] font-semibold tabular-nums">{item.price}</span>
                            <button
                              className={
                                "w-7 h-7 rounded-lg flex items-center justify-center transition-colors " +
                                (item.active
                                  ? "bg-[#000000] text-[#ffffff]"
                                  : "bg-[#eeedf1] hover:bg-[#000000] text-[#1a1c1f] hover:text-[#ffffff]")
                              }
                            >
                              <span className="material-symbols-outlined text-[16px]">{item.active ? "check" : "add"}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Formula in progress note */}
                    <div className="p-3.5 rounded-xl bg-[#f3f3f7] border border-[#c8c5cb]/30 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[#5e5e67] text-[18px]">science</span>
                        <div className="text-[13.5px] leading-5 font-normal">
                          <span className="font-semibold text-[#1a1c1f]">Formula in progress:</span>
                          <span className="text-[#5e5e67] ml-1">
                            L&apos;Oreal Dialight 9.02 Milkshake + 6 vol on pre-lightened zones 2 &amp; 3. Recorded 14:15.
                          </span>
                        </div>
                      </div>
                      <button className="text-[13.5px] leading-5 font-normal font-medium text-[#000000] hover:underline whitespace-nowrap flex items-center gap-1">
                        <span>View Color History</span>
                        <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>

                  {/* RIGHT: Folio / Checkout Terminal */}
                  <div className="w-full shrink-0 flex flex-col space-y-5 xl:w-[390px]">
                    <div className="rounded-2xl bg-[#ffffff] p-5 shadow-sm border border-[#c8c5cb]/30 flex flex-col space-y-4 relative">
                      <div className="flex items-center justify-between pb-3 border-b border-[#c8c5cb]/20">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[17px] text-[#1a1c1f] font-semibold">Folio #INV-1083</span>
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1a9a4d]/10 text-[#1a9a4d] font-semibold">
                              Active
                            </span>
                          </div>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5 block">
                            Opened 13:45 · Chair 03 (Wash Basin #2)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="h-7 w-7 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-center transition-colors"
                            title="Hold Folio"
                          >
                            <span className="material-symbols-outlined text-[16px]">pause_circle</span>
                          </button>
                          <button
                            className="h-7 w-7 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#5e5e67] hover:text-[#ba1a1a] flex items-center justify-center transition-colors"
                            title="Clear Folio"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                          </button>
                        </div>
                      </div>

                      {/* Client + stylist */}
                      <div className="p-3 rounded-xl bg-[#f3f3f7] border border-[#c8c5cb]/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0 pr-1">
                            <div className="w-9 h-9 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-semibold text-[11px] tracking-wider shrink-0">
                              NA
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[13.5px] leading-5 font-normal text-[#1a1c1f] font-semibold truncate">
                                  Datin Nora Al-Habshee
                                </span>
                                <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[#000000] text-[#ffffff] shrink-0">
                                  VIP Gold
                                </span>
                              </div>
                              <span className="text-[11px] text-[#5e5e67] truncate mt-0.5">+60 12-389 9122 · 28 Visits · Tier 10%</span>
                            </div>
                          </div>
                          <button
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#e8e8ec] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors shrink-0"
                            title="Change Client"
                          >
                            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                          </button>
                        </div>
                        <div className="pt-2 border-t border-[#c8c5cb]/20 flex items-center justify-between text-[13.5px]">
                          <div className="flex items-center gap-1 text-[#5e5e67]">
                            <span className="material-symbols-outlined text-[15px]">badge</span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider">Stylist</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13.5px] leading-5 font-normal text-[#1a1c1f] font-semibold">Jasmine Teo</span>
                            <span className="text-[10px] text-[#5e5e67] bg-[#eeedf1] px-1.5 py-0.5 rounded">50% Comm.</span>
                          </div>
                        </div>
                      </div>

                      {/* Itemized services */}
                      <div className="space-y-2.5 pt-0.5">
                        <div className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67] flex justify-between border-b border-[#c8c5cb]/20 pb-1.5">
                          <span>Itemized Services &amp; Retail</span>
                          <span className="tabular-nums font-medium">2 Items</span>
                        </div>
                        <div className="space-y-2">
                          {[
                            { name: "Full Balayage & Gloss Lift", note: "Jasmine Teo · Chair 03 · SST 6%", price: "RM 480.00" },
                            { name: "Kérastase Chronologiste Oil", note: "KER-CHR-100ML · 10% VIP Apply", price: "RM 220.00" },
                          ].map((line) => (
                            <div
                              key={line.name}
                              className="p-2.5 rounded-xl bg-[#ffffff] hover:bg-[#f3f3f7] border border-[#c8c5cb]/20 transition-colors flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className="w-6 h-6 rounded-md bg-[#eeedf1] flex items-center justify-center text-[#5e5e67] text-[11px] font-semibold tabular-nums shrink-0">
                                  1×
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-[13.5px] leading-5 font-normal text-[#1a1c1f] font-medium leading-tight truncate">
                                    {line.name}
                                  </h4>
                                  <p className="text-[11px] text-[#5e5e67] mt-0.5 truncate">{line.note}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-right shrink-0">
                                <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                                  {line.price}
                                </span>
                                <button className="opacity-0 group-hover:opacity-100 p-0.5 text-[#5e5e67] hover:text-[#ba1a1a] transition-opacity">
                                  <span className="material-symbols-outlined text-[15px]">close</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-0.5">
                          <button className="text-[11.5px] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center gap-1 font-medium transition-colors">
                            <span className="material-symbols-outlined text-[15px]">add_circle</span>
                            <span>Custom Discount / Tip</span>
                          </button>
                          <button className="text-[11.5px] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center gap-1 font-medium transition-colors">
                            <span className="material-symbols-outlined text-[15px]">redeem</span>
                            <span>Voucher</span>
                          </button>
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="pt-2.5 border-t border-[#c8c5cb]/20 space-y-2">
                        <div className="flex justify-between text-[13.5px] text-[#5e5e67]">
                          <span className="text-[11.5px] uppercase tracking-wider">Items Subtotal</span>
                          <span className="tabular-nums text-[#1a1c1f] font-medium">RM 700.00</span>
                        </div>
                        <div className="flex justify-between text-[13.5px] text-[#5e5e67]">
                          <span className="text-[11.5px] uppercase tracking-wider flex items-center gap-1">
                            Service Tax (SST 6%)
                            <span className="material-symbols-outlined text-[13px] text-[#5e5e67]">help_outline</span>
                          </span>
                          <span className="tabular-nums text-[#1a1c1f] font-medium">RM 28.80</span>
                        </div>
                        <div className="flex justify-between text-[13.5px] text-[#1a9a4d]">
                          <span className="text-[11.5px] uppercase tracking-wider">VIP Discount (10% Retail)</span>
                          <span className="tabular-nums font-semibold">-RM 22.00</span>
                        </div>
                        <div className="pt-2.5 mt-1 border-t border-[#c8c5cb]/30 flex justify-between items-baseline">
                          <div className="flex flex-col">
                            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                              Total Payable (MYR)
                            </span>
                            <span className="text-[10.5px] text-[#5e5e67] mt-0.5">6% SST #W10-1808-3200049</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[24px] font-bold text-[#1a1c1f] tabular-nums tracking-tight">RM 706.80</span>
                          </div>
                        </div>
                      </div>

                      {/* Payment methods */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Select Settlement Method
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {PAYMENT_METHODS.map((m) => {
                            const selected = method === m.key;
                            return (
                              <button
                                key={m.key}
                                onClick={() => setMethod(m.key)}
                                className={
                                  "p-2.5 rounded-xl flex items-center justify-between text-left transition-all border " +
                                  (selected
                                    ? "bg-[#000000] text-[#ffffff] shadow-sm border-[#000000]"
                                    : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] border-[#c8c5cb]/20")
                                }
                              >
                                <div className="flex items-center gap-2">
                                  <span className={"material-symbols-outlined text-[18px] " + (selected ? "" : "text-[#5e5e67]")}>
                                    {m.icon}
                                  </span>
                                  <div>
                                    <div className="text-[13px] font-semibold leading-tight">{m.label}</div>
                                    <div className={"text-[10px] mt-0.5 " + (selected ? "text-[#e4e1e6]" : "text-[#5e5e67]")}>{m.note}</div>
                                  </div>
                                </div>
                                {selected && <span className="material-symbols-outlined text-[15px]">check_circle</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Charge + quick actions */}
                      <div className="pt-1 space-y-2">
                        <button className="w-full h-11 rounded-xl bg-[#000000] hover:bg-neutral-900 text-[#ffffff] text-[13.5px] leading-5 font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]">
                          <span className="material-symbols-outlined text-[17px]">check</span>
                          <span>Charge RM 706.80 &amp; Print Receipt</span>
                        </button>
                        <div className="grid grid-cols-3 gap-2">
                          <button className="h-8 px-1.5 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] border border-[#c8c5cb]/20 text-[#1a1c1f] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors">
                            <span className="material-symbols-outlined text-[13px]">send_to_mobile</span>
                            <span>WhatsApp</span>
                          </button>
                          <button className="h-8 px-1.5 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] border border-[#c8c5cb]/20 text-[#1a1c1f] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors">
                            <span className="material-symbols-outlined text-[13px]">call_split</span>
                            <span>Split Bill</span>
                          </button>
                          <button className="h-8 px-1.5 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] border border-[#c8c5cb]/20 text-[#1a1c1f] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors">
                            <span className="material-symbols-outlined text-[13px]">pause</span>
                            <span>Park Folio</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Parked folios */}
                    <div className="p-4 rounded-2xl bg-[#ffffff] shadow-sm border border-[#c8c5cb]/30 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#c8c5cb]/20">
                        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Other Parked Floor Folios
                        </span>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#eeedf1] px-2 py-0.5 rounded text-[#5e5e67] font-medium tabular-nums">
                          {PARKED_FOLIOS.length} Open
                        </span>
                      </div>
                      <div className="space-y-2">
                        {PARKED_FOLIOS.map((f) => (
                          <div
                            key={f.chair}
                            className="p-2.5 rounded-xl bg-[#f3f3f7] hover:bg-[#eeedf1] border border-[#c8c5cb]/20 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                              <div>
                                <div className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f]">{f.chair}</div>
                                <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">{f.detail}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                                {f.price}
                              </span>
                              <span className="block text-[10px] text-[#5e5e67] tabular-nums mt-0.5">{f.ago}</span>
                            </div>
                          </div>
                        ))}
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
