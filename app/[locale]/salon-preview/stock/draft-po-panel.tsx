"use client";

import { useState } from "react";

/**
 * Unchanged from the original literal-port page (pre-2026-09-24 real-data
 * pass): the founder's own sample "Draft PO" and "Delivery Inbound" cards,
 * with the qty steppers' real local behaviour kept exactly as it was.
 *
 * Not converted to real data this pass -- see stock/page.tsx's header for
 * why (a real purchase-order pipeline exists but wiring a write flow is a
 * separate, larger piece than this pass's read-only stock list). Simply
 * extracted verbatim into its own client component so the page around it
 * could become a Server Component without losing this working interaction.
 */

type Line = { name: string; unitLabel: string; unitPrice: number; qty: number };

const INITIAL_LINES: Line[] = [
  { name: "Blond Studio 9 Multi-Tech", unitLabel: "tubs", unitPrice: 142, qty: 4 },
  { name: "DiaLight 9.12 Milkshake", unitLabel: "tubes", unitPrice: 31, qty: 6 },
  { name: "Olaplex No. 1 Bond Multiplier", unitLabel: "jugs", unitPrice: 480, qty: 2 },
];

function ringgit(n: number): string {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DraftPoPanel() {
  const [lines, setLines] = useState(INITIAL_LINES);
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  const adjust = (name: string, delta: number) => {
    setLines((prev) => prev.map((l) => (l.name === name ? { ...l, qty: Math.max(0, l.qty + delta) } : l)));
  };

  return (
    <>
      <div className="bg-[#ffffff] rounded-xl shadow-sm p-5 border border-[#c8c5cb]/30 flex flex-col gap-4">
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
                    className="text-[#77767b] hover:text-[#1a1c1f] active:scale-[0.97] transition-transform text-[13px] w-4"
                  >
                    −
                  </button>
                  <span className="font-mono text-[12px] font-semibold text-[#1a1c1f] px-1 tabular-nums">{l.qty}</span>
                  <button
                    onClick={() => adjust(l.name, 1)}
                    className="text-[#77767b] hover:text-[#1a1c1f] active:scale-[0.97] transition-transform text-[13px] w-4"
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
          <button className="w-full h-10 bg-[#000000] text-[#ffffff] rounded-lg text-[13px] font-semibold shadow-sm hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[17px]">send</span>
            <span>Send WhatsApp PO to Supplier</span>
          </button>
          <button className="w-full h-8 bg-[#f3f3f7] text-[#47464b] rounded-lg text-[11.5px] font-medium hover:bg-[#eeedf1] active:scale-[0.98] transition-colors flex items-center justify-center gap-1.5 border border-[#e8e8ec]">
            <span className="material-symbols-outlined text-[14px]">save</span>
            <span>Save PO Draft</span>
          </button>
        </div>
      </div>

      <div className="bg-[#ffffff] rounded-xl shadow-sm p-5 border border-[#c8c5cb]/30 flex flex-col gap-3.5">
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
    </>
  );
}
