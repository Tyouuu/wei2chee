"use client";

import { useState } from "react";

/**
 * Real stock rows, client-side search only -- no category tabs.
 *
 * The original design's 6 category pills (Bleach & Lighteners, Demi &
 * Permanent Color, ...) were hardcoded SKU lists with no backing field:
 * catalog_items has no category/group column, and inventing one to keep
 * the tabs would be fabricating a taxonomy this business never entered.
 * Dropped rather than faked, same call as Overview's per-stylist "tier".
 */

export type StockRow = {
  itemId: string;
  sku: string | null;
  name: string;
  location: string;
  unit: string;
  onHand: number;
  reorderAt: number | null;
  costCents: number | null;
  velocityOutLast30d: number;
  /** Already on an open purchase order that has not fully arrived. */
  onOrder: boolean;
};

function ringgit(cents: number): string {
  return `RM ${(cents / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StockTable({ rows, totalCount }: { rows: StockRow[]; totalCount: number }) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const visibleRows = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.sku ?? "").toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q),
      )
    : rows;

  const toneOf = (r: StockRow): "healthy" | "low" | "deficit" => {
    if (r.reorderAt == null) return "healthy";
    if (r.onHand <= 0) return "deficit";
    if (r.onHand <= r.reorderAt) return "low";
    return "healthy";
  };
  const dotClass: Record<string, string> = {
    healthy: "bg-emerald-500",
    low: "bg-amber-500",
    deficit: "bg-[#ba1a1a]",
  };
  const tagLabel: Record<string, string> = {
    healthy: "In Stock",
    low: "Low",
    deficit: "Deficit",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#ffffff] p-2.5 rounded-xl border border-[#c8c5cb]/30 shadow-sm">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#77767b]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-4 bg-[#f3f3f7] rounded-lg text-[13px] text-[#1a1c1f] placeholder:text-[#77767b] focus:outline-none focus:bg-[#ffffff] transition-colors"
            placeholder="Search SKU, name, or location..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-[#ffffff] rounded-xl shadow-sm border border-[#c8c5cb]/30 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f3f3f7] border-b border-[#e8e8ec] text-[#47464b]">
              <tr>
                <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">SKU</th>
                <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">Product</th>
                <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">Location</th>
                <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">Stock Level</th>
                <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-right">Cost</th>
                <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-left">
                  Moved Out (30d)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e8ec] text-[13px]">
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[13px] text-[#77767b]">
                    No items match {q ? `"${search.trim()}"` : "this business's stock"}.
                  </td>
                </tr>
              )}
              {visibleRows.map((r) => {
                const tone = toneOf(r);
                return (
                  <tr
                    key={r.itemId}
                    className={
                      "transition-colors " +
                      (tone === "deficit" ? "bg-[#ffdad6]/10 hover:bg-[#ffdad6]/20" : "hover:bg-[#f3f3f7]/60")
                    }
                  >
                    <td
                      className={
                        "py-3 px-4 font-mono text-[12px] font-medium " +
                        (tone === "deficit" ? "text-[#ba1a1a] font-semibold" : "text-[#77767b]")
                      }
                    >
                      {r.sku ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[#1a1c1f]">{r.name}</span>
                        <span
                          className={
                            "text-[10px] uppercase font-mono px-1.5 py-0.5 rounded whitespace-nowrap " +
                            (tone === "deficit"
                              ? "bg-[#ffdad6] text-[#93000a] font-bold"
                              : tone === "low"
                                ? "bg-amber-100 text-amber-800 font-semibold"
                                : "bg-[#e8e8ec] text-[#5e5e67]")
                          }
                        >
                          {tagLabel[tone]}
                        </span>
                        {r.onOrder && (
                          <span data-testid="on-order-tag" className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#000000] text-[#ffffff] font-semibold whitespace-nowrap">
                            On order
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[12.5px] text-[#77767b]">{r.location || "—"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className={"w-2 h-2 rounded-full shrink-0 " + dotClass[tone]} />
                        <span
                          className={
                            "font-mono font-semibold " +
                            (tone === "deficit" ? "font-bold text-[#ba1a1a]" : "text-[#1a1c1f]")
                          }
                        >
                          {r.onHand} {r.unit}
                        </span>
                        {r.reorderAt != null ? (
                          <span className="text-[11px] font-mono text-[#77767b]">(reorder at {r.reorderAt})</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[13px] text-[#1a1c1f] font-medium">
                      {r.costCents != null ? ringgit(r.costCents) : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[12px] text-[#1a1c1f]">
                      {r.velocityOutLast30d > 0 ? `${r.velocityOutLast30d} ${r.unit}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-[#f3f3f7] flex items-center justify-between gap-3 text-[#77767b] text-[11.5px] border-t border-[#e8e8ec]">
          <span className="text-[#1a1c1f] font-medium">
            {visibleRows.length > 0 ? `Showing 1 to ${visibleRows.length} of ` : "Showing 0 of "}
            {totalCount} SKUs
          </span>
        </div>
      </div>
    </div>
  );
}
