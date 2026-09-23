"use client";

import { useState } from "react";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Salon Stock &
 * Inventory" (Task 405, pasted 2026-09-23) -- the first of the five
 * Management rows to get a real page. Same structure, same copy, same
 * numbers he designed with.
 *
 * "use client": kept the source's own real behaviour (the draft PO's qty
 * steppers actually change the line total and the order total) rather than
 * ship steppers that visibly do nothing.
 *
 * No backend behind it: no real stock table, no PO writes, no WhatsApp send.
 * Still sample content only.
 */
const CATEGORIES = [
  { label: "All Items", count: 186, active: true },
  { label: "Bleach & Lighteners", count: 12 },
  { label: "Demi & Permanent Color", count: 94 },
  { label: "Developers & Peroxides", count: 24 },
  { label: "Bond Builders", count: 32 },
  { label: "Backbar Care", count: 24 },
];

type Row = {
  sku: string;
  name: string;
  tag: string;
  tagTone: "neutral" | "deficit";
  brandLine: string;
  location: string;
  bay: string;
  level: string;
  levelNote: string;
  levelTone: "healthy" | "low" | "deficit";
  cost: string;
  velocity: string;
  velocityNote: string;
  action: "restock" | "addToPO";
  deficitRow?: boolean;
};

const ROWS: Row[] = [
  {
    sku: "WH-COL-061",
    name: "Majirel Cool 6.1",
    tag: "Ash Brown",
    tagTone: "neutral",
    brandLine: "L'Oréal Pro · 50ml · Par: 10",
    location: "Shelf A-02",
    bay: "Color Bar",
    level: "14 tubes",
    levelNote: "(Healthy)",
    levelTone: "healthy",
    cost: "RM 28.50",
    velocity: "18 tubes / mo",
    velocityNote: "~4.2 / wk",
    action: "restock",
  },
  {
    sku: "LOR-BS9-500",
    name: "Blond Studio 9 Multi-Tech",
    tag: "Deficit",
    tagTone: "deficit",
    brandLine: "L'Oréal Pro · 500g · Par: 3",
    location: "Shelf B-01",
    bay: "Bleach Bar",
    level: "1 tub",
    levelNote: "(-2)",
    levelTone: "deficit",
    cost: "RM 142.00",
    velocity: "5 tubs / mo",
    velocityNote: "High Burn",
    action: "addToPO",
    deficitRow: true,
  },
  {
    sku: "WH-TON-912",
    name: "DiaLight 9.12 Milkshake",
    tag: "Toner",
    tagTone: "neutral",
    brandLine: "L'Oréal Pro · 50ml · Par: 6",
    location: "Bay 4 (Toner)",
    bay: "Color Bar",
    level: "2 tubes",
    levelNote: "(-4)",
    levelTone: "low",
    cost: "RM 31.00",
    velocity: "22 tubes / mo",
    velocityNote: "Peak Season",
    action: "addToPO",
  },
  {
    sku: "OLX-BND-001",
    name: "Olaplex No. 1 Multiplier",
    tag: "Salon Pro",
    tagTone: "neutral",
    brandLine: "Kao Partner · 525ml · Par: 2",
    location: "Safe Vault A",
    bay: "Secure Shelf",
    level: "1 jug (~20%)",
    levelNote: "(Low)",
    levelTone: "low",
    cost: "RM 480.00",
    velocity: "1.8 jugs / mo",
    velocityNote: "Calibrated",
    action: "addToPO",
  },
  {
    sku: "WEL-KOL-1001",
    name: "Koleston Perfect ME+ 10/01",
    tag: "Blonde",
    tagTone: "neutral",
    brandLine: "Wella Pro · 60ml · Par: 8",
    location: "Shelf A-05",
    bay: "Color Bar",
    level: "9 tubes",
    levelNote: "(Healthy)",
    levelTone: "healthy",
    cost: "RM 32.00",
    velocity: "11 tubes / mo",
    velocityNote: "Steady",
    action: "restock",
  },
  {
    sku: "MLB-GL-001X",
    name: "Milbon Grand Linkage 1X",
    tag: "Treatment",
    tagTone: "neutral",
    brandLine: "Milbon Direct · 600g · Par: 4",
    location: "Basin 01",
    bay: "Under Cart",
    level: "5 pouches",
    levelNote: "(Healthy)",
    levelTone: "healthy",
    cost: "RM 115.00",
    velocity: "6 pouches / mo",
    velocityNote: "Standard",
    action: "restock",
  },
  {
    sku: "K18-PRO-150",
    name: "K18 Molecular Repair Mist",
    tag: "Peptide",
    tagTone: "neutral",
    brandLine: "K18 Direct · 150ml · Par: 3",
    location: "Safe Vault B",
    bay: "Restricted",
    level: "4 bottles",
    levelNote: "(Healthy)",
    levelTone: "healthy",
    cost: "RM 320.00",
    velocity: "2.5 bottles / mo",
    velocityNote: "Foil Addon",
    action: "restock",
  },
];

const DOT_TONE: Record<Row["levelTone"], string> = {
  healthy: "bg-emerald-500",
  low: "bg-amber-500",
  deficit: "bg-[#ba1a1a]",
};

type Line = { name: string; unitLabel: string; unitPrice: number; qty: number };

const INITIAL_LINES: Line[] = [
  { name: "Blond Studio 9 Multi-Tech", unitLabel: "tubs", unitPrice: 142, qty: 4 },
  { name: "DiaLight 9.12 Milkshake", unitLabel: "tubes", unitPrice: 31, qty: 6 },
  { name: "Olaplex No. 1 Bond Multiplier", unitLabel: "jugs", unitPrice: 480, qty: 2 },
];

function ringgit(n: number): string {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SalonStockPreview() {
  const [lines, setLines] = useState(INITIAL_LINES);
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  const adjust = (name: string, delta: number) => {
    setLines((prev) => prev.map((l) => (l.name === name ? { ...l, qty: Math.max(0, l.qty + delta) } : l)));
  };

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="salon-stock-and-orders" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full min-h-screen">
            <div className="flex flex-col w-full">
              <div className="px-8 py-7 flex flex-col gap-6 max-w-[1560px] mx-auto w-full">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#e8e8ec]">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#77767b]">
                      <span>OPERATIONS</span>
                      <span className="text-[#c8c5cb]">/</span>
                      <span>INVENTORY &amp; DISPENSARY</span>
                      <span className="text-[#c8c5cb]">/</span>
                      <span className="text-[#1a1c1f] font-semibold">STOCK AUDIT</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <h1 className="text-xl leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                        Salon Stock &amp; Inventory
                      </h1>
                      <span className="text-[11.5px] font-mono px-2 py-0.5 rounded bg-[#e8e8ec] text-[#47464b] font-medium">
                        DISPENSARY BAY · BANGSAR
                      </span>
                    </div>
                    <p className="text-[13.5px] leading-5 text-[#77767b]">
                      Real-time dispensary levels, shade stock matrix, and 1-tap WhatsApp supplier replenishment.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button className="h-9 px-3.5 bg-[#ffffff] text-[#1a1c1f] border border-[#e8e8ec] rounded-lg text-[13.5px] leading-5 font-medium shadow-sm hover:bg-[#f3f3f7] transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-[#77767b]">barcode_scanner</span>
                      <span>Quick Scan</span>
                    </button>
                    <button className="h-9 px-3.5 bg-[#ffffff] text-[#1a1c1f] border border-[#e8e8ec] rounded-lg text-[13.5px] leading-5 font-medium shadow-sm hover:bg-[#f3f3f7] transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-[#77767b]">picture_as_pdf</span>
                      <span>PO Export (PDF)</span>
                    </button>
                    <button className="h-9 px-4 bg-[#000000] text-[#ffffff] rounded-lg text-[13.5px] leading-5 font-medium shadow-sm hover:bg-neutral-800 transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                      <span>New Reorder</span>
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  {/* LEFT: table */}
                  <section className="xl:col-span-8 flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-nowrap">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c.label}
                            className={
                              "h-8 px-3 rounded-lg text-[13px] font-medium transition-colors " +
                              (c.active
                                ? "bg-[#000000] text-[#ffffff]"
                                : "bg-[#ffffff] text-[#1a1c1f] border border-[#e8e8ec] hover:bg-[#eeedf1]")
                            }
                          >
                            {c.label}{" "}
                            <span
                              className={
                                "ml-1 font-mono text-[11px] " + (c.active ? "opacity-70" : "text-[#77767b]")
                              }
                            >
                              {c.count}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#ffffff] p-2.5 rounded-xl border border-[#e8e8ec] shadow-sm">
                        <div className="relative flex-1">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#77767b]">
                            search
                          </span>
                          <input
                            className="w-full h-9 pl-9 pr-14 bg-[#f3f3f7] rounded-lg text-[13px] text-[#1a1c1f] placeholder:text-[#77767b] focus:outline-none focus:bg-[#ffffff] transition-colors"
                            placeholder="Search SKU, shade (6.1, 9.12), or brand..."
                            type="text"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[#77767b] bg-[#e2e2e6] rounded">
                            ⌘K
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-[#f3f3f7] px-2.5 py-1.5 rounded-lg border border-[#e8e8ec]">
                            <span className="text-[11px] text-[#77767b] uppercase">Bay:</span>
                            <select className="bg-transparent text-[12.5px] text-[#1a1c1f] font-medium focus:outline-none cursor-pointer">
                              <option>All Locations</option>
                              <option>Color Bar (Shelf A &amp; B)</option>
                              <option>Backbar Basin 01-04</option>
                              <option>Safe Vault A &amp; B</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5 bg-[#f3f3f7] px-2.5 py-1.5 rounded-lg border border-[#e8e8ec]">
                            <span className="text-[11px] text-[#77767b] uppercase">Sort:</span>
                            <select className="bg-transparent text-[12.5px] text-[#1a1c1f] font-medium focus:outline-none cursor-pointer">
                              <option>Velocity (High to Low)</option>
                              <option>Deficit Priority First</option>
                              <option>SKU Alphabetical</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#ffffff] rounded-xl shadow-sm border border-[#e8e8ec] overflow-hidden flex flex-col">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[#f3f3f7] border-b border-[#e8e8ec] text-[#47464b]">
                            <tr>
                              <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">SKU</th>
                              <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">
                                Product Formula &amp; Shade
                              </th>
                              <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">Location</th>
                              <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">Stock Level</th>
                              <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-right">Cost</th>
                              <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">Velocity</th>
                              <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e8e8ec] text-[13px]">
                            {ROWS.map((r) => (
                              <tr
                                key={r.sku}
                                className={
                                  "transition-colors " +
                                  (r.deficitRow ? "bg-[#ffdad6]/10 hover:bg-[#ffdad6]/20" : "hover:bg-[#f3f3f7]/60")
                                }
                              >
                                <td className={"py-3 px-4 font-mono text-[12px] font-medium " + (r.deficitRow ? "text-[#ba1a1a] font-semibold" : "text-[#77767b]")}>
                                  {r.sku}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-[#1a1c1f]">{r.name}</span>
                                      <span
                                        className={
                                          "text-[10px] uppercase font-mono px-1.5 py-0.5 rounded " +
                                          (r.tagTone === "deficit"
                                            ? "bg-[#ffdad6] text-[#93000a] font-bold"
                                            : "bg-[#e8e8ec] text-[#5e5e67]")
                                        }
                                      >
                                        {r.tag}
                                      </span>
                                    </div>
                                    <span className="text-[11.5px] text-[#77767b]">{r.brandLine}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-[#1a1c1f] text-[12.5px]">{r.location}</span>
                                    <span className="text-[11px] text-[#77767b]">{r.bay}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className={"w-2 h-2 rounded-full " + DOT_TONE[r.levelTone]} />
                                    <span
                                      className={
                                        "font-mono font-semibold " +
                                        (r.levelTone === "deficit" ? "font-bold text-[#ba1a1a]" : "text-[#1a1c1f]")
                                      }
                                    >
                                      {r.level}
                                    </span>
                                    <span
                                      className={
                                        "text-[11px] font-mono " +
                                        (r.levelTone === "deficit" ? "text-[#ba1a1a] font-medium" : "text-[#77767b]")
                                      }
                                    >
                                      {r.levelNote}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-[13px] text-[#1a1c1f] font-medium">{r.cost}</td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-col">
                                    <span className="font-mono text-[#1a1c1f] text-[12px]">{r.velocity}</span>
                                    <span className="text-[11px] text-[#77767b]">{r.velocityNote}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {r.action === "restock" ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button className="h-7 px-2.5 bg-[#f3f3f7] hover:bg-[#e8e8ec] text-[#1a1c1f] border border-[#e8e8ec] rounded text-[11.5px] font-medium transition-colors">
                                        Adjust
                                      </button>
                                      <button className="h-7 px-2.5 bg-[#e8e8ec] hover:bg-[#e2e2e6] text-[#1a1c1f] rounded text-[11.5px] font-medium transition-colors">
                                        + Restock
                                      </button>
                                    </div>
                                  ) : r.deficitRow ? (
                                    <button className="h-7 px-3 bg-[#000000] text-[#ffffff] rounded text-[11.5px] font-medium hover:bg-neutral-800 transition-colors shadow-sm">
                                      Add to PO
                                    </button>
                                  ) : (
                                    <button className="h-7 px-3 bg-[#e8e8ec] hover:bg-[#e2e2e6] text-[#1a1c1f] rounded text-[11.5px] font-medium transition-colors">
                                      Add to PO
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-3 bg-[#f3f3f7] flex flex-col sm:flex-row items-center justify-between gap-3 text-[#77767b] text-[11.5px] border-t border-[#e8e8ec]">
                        <div className="flex items-center gap-2">
                          <span className="text-[#1a1c1f] font-medium">Showing 1 to 7 of 186 SKUs</span>
                          <span className="text-[#c8c5cb]">·</span>
                          <span>Updated 8 mins ago by Wei Lin</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            disabled
                            className="h-7 w-7 rounded flex items-center justify-center bg-[#ffffff] text-[#1a1c1f] hover:bg-[#eeedf1] disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                          </button>
                          <button className="h-7 w-7 rounded flex items-center justify-center bg-[#000000] text-[#ffffff] font-mono text-[12px] font-semibold">
                            1
                          </button>
                          <button className="h-7 w-7 rounded flex items-center justify-center bg-[#ffffff] text-[#1a1c1f] hover:bg-[#eeedf1] font-mono text-[12px] border border-[#e8e8ec]">
                            2
                          </button>
                          <button className="h-7 w-7 rounded flex items-center justify-center bg-[#ffffff] text-[#1a1c1f] hover:bg-[#eeedf1] font-mono text-[12px] border border-[#e8e8ec]">
                            3
                          </button>
                          <span className="px-1 text-[#77767b]">...</span>
                          <button className="h-7 w-7 rounded flex items-center justify-center bg-[#ffffff] text-[#1a1c1f] hover:bg-[#eeedf1] font-mono text-[12px] border border-[#e8e8ec]">
                            24
                          </button>
                          <button className="h-7 w-7 rounded flex items-center justify-center bg-[#ffffff] text-[#1a1c1f] hover:bg-[#eeedf1] border border-[#e8e8ec]">
                            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* RIGHT: Draft PO + Delivery */}
                  <aside className="xl:col-span-4 flex flex-col gap-5">
                    <div className="bg-[#ffffff] rounded-xl shadow-sm p-5 border border-[#e8e8ec] flex flex-col gap-4">
                      <div className="flex items-center justify-between pb-3 border-b border-[#e8e8ec]">
                        <div className="flex flex-col">
                          <span className="text-[11px] uppercase tracking-wider text-[#77767b] font-medium font-mono">
                            DRAFT PO #2024-108
                          </span>
                          <h2 className="text-[15px] font-semibold text-[#1a1c1f]">Quick Purchase Order</h2>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#e8e8ec] text-[#5e5e67] font-mono text-[11px] font-semibold">
                          {lines.length} Line Items
                        </span>
                      </div>
                      <div className="flex flex-col divide-y divide-[#e8e8ec]">
                        {lines.map((l) => (
                          <div key={l.name} className="py-3 flex items-center justify-between gap-3">
                            <div className="flex flex-col">
                              <span className="text-[#1a1c1f] font-medium text-[13px]">{l.name}</span>
                              <span className="text-[11.5px] text-[#77767b] font-mono">
                                {l.qty} {l.unitLabel} × {ringgit(l.unitPrice)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 bg-[#f3f3f7] px-2 py-0.5 rounded border border-[#e8e8ec]">
                                <button
                                  onClick={() => adjust(l.name, -1)}
                                  className="text-[#77767b] hover:text-[#1a1c1f] text-[13px] w-4"
                                >
                                  −
                                </button>
                                <span className="font-mono text-[12px] font-semibold text-[#1a1c1f] px-1 tabular-nums">{l.qty}</span>
                                <button
                                  onClick={() => adjust(l.name, 1)}
                                  className="text-[#77767b] hover:text-[#1a1c1f] text-[13px] w-4"
                                >
                                  +
                                </button>
                              </div>
                              <span className="font-mono text-[13px] font-semibold text-[#1a1c1f] min-w-[70px] text-right tabular-nums">
                                {ringgit(l.unitPrice * l.qty)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-3.5 bg-[#f3f3f7] rounded-lg flex items-center justify-between border border-[#e8e8ec]">
                        <span className="text-[11px] text-[#77767b] uppercase font-mono font-medium">Order Total</span>
                        <span className="font-mono font-bold text-[#1a1c1f] text-[17px] tabular-nums">{ringgit(total)}</span>
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        <button className="w-full h-10 bg-[#000000] text-[#ffffff] rounded-lg text-[13px] font-semibold shadow-sm hover:bg-neutral-800 transition-all flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-[17px]">send</span>
                          <span>Send WhatsApp PO to Supplier</span>
                        </button>
                        <button className="w-full h-8 bg-[#f3f3f7] text-[#47464b] rounded-lg text-[11.5px] font-medium hover:bg-[#eeedf1] transition-colors flex items-center justify-center gap-1.5 border border-[#e8e8ec]">
                          <span className="material-symbols-outlined text-[14px]">save</span>
                          <span>Save PO Draft</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#ffffff] rounded-xl shadow-sm p-5 border border-[#e8e8ec] flex flex-col gap-3.5">
                      <div className="flex items-center justify-between pb-2 border-b border-[#e8e8ec]">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11.5px] text-[#1a1c1f] uppercase tracking-wider font-semibold">Delivery Inbound</span>
                        </div>
                        <span className="font-mono text-[11px] text-[#77767b] font-medium">2 Active Batches</span>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {[
                          { name: "L'Oréal Professional MY", tag: "Tomorrow 11:30 AM", tagTone: "on", note: "14 Cartons · Color & Peroxide Batch", po: "PO #106" },
                          { name: "Milbon Direct HQ", tag: "In Preparation", tagTone: "muted", note: "Grand Linkage Treatment Refills", po: "PO #107" },
                        ].map((d) => (
                          <div key={d.name} className="p-3 rounded-lg bg-[#f3f3f7] border border-[#e8e8ec] flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[13px] text-[#1a1c1f]">{d.name}</span>
                              <span
                                className={
                                  "px-2 py-0.5 rounded bg-[#e2e2e6] font-mono text-[11px] font-semibold " +
                                  (d.tagTone === "on" ? "text-[#1a1c1f]" : "text-[#5e5e67]")
                                }
                              >
                                {d.tag}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11.5px] text-[#77767b]">
                              <span>{d.note}</span>
                              <span className="font-mono text-[#1a1c1f] font-medium">{d.po}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-[#e8e8ec] flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-[#77767b] uppercase text-[11px]">Dispensary Par Compliance</span>
                          <span className="font-mono font-bold text-[#1a1c1f] text-[12px]">94.2%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#e8e8ec] rounded-full overflow-hidden flex">
                          <div className="bg-[#000000] h-full" style={{ width: "94.2%" }} />
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
