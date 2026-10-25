"use client";

import { useEffect, useState } from "react";

/**
 * Real invoices, real receipt preview per selection -- fixing the exact gap
 * this file's own header used to call out: the founder's original source
 * never updated the right-side receipt when a different row was clicked.
 * Now it does, because the data backing it is real per-row data, not one
 * hardcoded example.
 *
 * ── The fabricated tax breakdown is gone, not simplified ──────────────────
 *
 * The original receipt printed "SUBTOTAL / SST (6%) / TOTAL PAYABLE" and
 * itemised line items (Balayage RM480 + K18 RM180 + Olaplex RM120). Neither
 * exists in this product yet: ledger_entries stores one amount per payment,
 * no tax rate, no line breakdown, and e-Invoice/SST is explicitly a "build
 * later" item in the founder's own priorities. Printing a 6% tax line this
 * business isn't registered to charge would be inventing a number on a
 * document a customer could hold onto -- worse than a missing feature.
 * The receipt now shows exactly what's real: who paid, how much, how, and
 * to whom it's attributed.
 *
 * "Pending Deposit" status is also gone -- a ledger_entries row is, by what
 * it means, money that already arrived. An unpaid amount lives on the
 * quotation/order it's against, not here. Status is just Settled (the normal
 * case) or Refunded (a real reversal exists via adjusts_id).
 */

export type InvoiceStatus = "settled" | "refunded";

export type Invoice = {
  id: string;
  docNo: string;
  entryOn: string;
  createdAt: string;
  party: string;
  phone: string | null;
  staffName: string | null;
  amountCents: number;
  method: string;
  status: InvoiceStatus;
};

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  settled: { label: "Settled", className: "text-[#1a9a4d] bg-[#1a9a4d]/[0.08] border-[#1a9a4d]/20" },
  refunded: { label: "Refunded / Void", className: "text-[#ba1a1a] bg-[#ba1a1a]/[0.08] border-[#ba1a1a]/20" },
};

function ringgit(cents: number): string {
  return `RM ${(cents / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type PrintState = "idle" | "spooling" | "dispatched";

/* 一次只摆这么多行，往下滚才多拿一截——跟改动记录页同一条规矩（任务434
   实拍量过：50 张不分页、右边打印预览底下是一大片空白）。真的按一次
   多显示 20 行，不是一颗翻不了页的装饰按钮。 */
const PAGE_SIZE = 20;

export function InvoicesClient({
  invoices,
  businessName,
}: {
  invoices: Invoice[];
  businessName: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(invoices[0]?.id ?? null);
  const [printState, setPrintState] = useState<PrintState>("idle");
  const [formatTab, setFormatTab] = useState<"thermal" | "a4">("thermal");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [staffFilter, setStaffFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  const settledCount = invoices.filter((i) => i.status === "settled").length;
  const refundedCount = invoices.filter((i) => i.status === "refunded").length;

  // 哪几位师傅收过款——按次数排，没有记师傅的（"—"）不进这份清单，
  // 不然筛选里会多一个选了也等於没筛的选项。
  const staffCounts = Array.from(
    invoices.reduce((m, i) => {
      if (!i.staffName) return m;
      return m.set(i.staffName, (m.get(i.staffName) ?? 0) + 1);
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (staffFilter !== "all" && inv.staffName !== staffFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      inv.docNo.toLowerCase().includes(q) ||
      inv.party.toLowerCase().includes(q) ||
      (inv.phone ?? "").toLowerCase().includes(q)
    );
  });
  const visibleInvoices = filteredInvoices.slice(0, shown);

  // 换筛选条件要退回第一页，理由跟改动记录页同一条：不然切到一个只有
  // 5 张的筛选，画面却还记得着上一个筛选翻开的第 40 张。
  const setStatus = (s: InvoiceStatus | "all") => { setStatusFilter(s); setShown(PAGE_SIZE); };
  const setStaff = (s: string) => { setStaffFilter(s); setShown(PAGE_SIZE); };
  const setQuery = (v: string) => { setSearch(v); setShown(PAGE_SIZE); };

  const selected = invoices.find((i) => i.id === selectedId) ?? null;

  const runPrintSequence = (setState: (s: PrintState) => void) => {
    setState("spooling");
    setTimeout(() => {
      setState("dispatched");
      setTimeout(() => setState("idle"), 1400);
    }, 900);
  };

  const handleDirectPrint = () => {
    if (printState !== "idle") return;
    runPrintSequence(setPrintState);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleDirectPrint();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printState]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN */}
      <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-3">
        <div className="p-3 bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm flex flex-col gap-2">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#77767b] text-[18px]">
                search
              </span>
              <input
                className="w-full h-9 pl-9 pr-3 bg-[#ffffff] border border-[#e2e2e6] rounded text-[13.5px] leading-5 text-[#1a1c1f] placeholder:text-[#77767b] focus:outline-none focus:border-[#1a1c1f] transition-colors"
                placeholder="Search invoice #, guest name, or phone..."
                type="text"
                value={search}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {/* 只有一位师傅在收款的店，这格筛不出什么，不画。 */}
            {staffCounts.length > 1 && (
              <select
                aria-label="Filter by stylist"
                value={staffFilter}
                onChange={(e) => setStaff(e.target.value)}
                className="h-9 px-2.5 rounded border border-[#e2e2e6] bg-[#ffffff] text-[13.5px] text-[#1a1c1f] focus:outline-none focus:border-[#1a1c1f]"
              >
                <option value="all">All Stylists</option>
                {staffCounts.map(([name, count]) => (
                  <option key={name} value={name}>
                    {name} ({count})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {(
              [
                { label: `All Status (${invoices.length})`, status: "all" as const },
                { label: `Settled (${settledCount})`, status: "settled" as const },
                { label: `Refunded / Void (${refundedCount})`, status: "refunded" as const },
              ]
            ).map((f) => (
              <button
                key={f.label}
                onClick={() => setStatus(f.status)}
                className={
                  "h-7 px-2.5 rounded text-[11.5px] leading-4 tracking-[0.06em] font-semibold tracking-wider uppercase transition-colors active:scale-[0.97] " +
                  (statusFilter === f.status
                    ? "bg-[#000000] text-[#ffffff]"
                    : "bg-[#f3f3f7] text-[#5e5e67] hover:text-[#1a1c1f] border border-[#e2e2e6]")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f3f3f7] border-b border-[#e2e2e6]">
                  <th className="py-2.5 px-3 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                    Invoice No &amp; Date
                  </th>
                  <th className="py-2.5 px-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                    Guest &amp; Contact
                  </th>
                  <th className="py-2.5 px-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                    Stylist
                  </th>
                  <th className="py-2.5 px-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider text-right">
                    Amount (MYR)
                  </th>
                  <th className="py-2.5 px-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                    Method
                  </th>
                  <th className="py-2.5 px-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-2.5 px-3 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e2e6]">
                {visibleInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[13.5px] text-[#5e5e67]">
                      No invoices match {search.trim() ? `"${search.trim()}"` : "this filter"}.
                    </td>
                  </tr>
                )}
                {visibleInvoices.map((inv) => {
                  const isSelected = inv.id === selectedId;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedId(inv.id)}
                      className={
                        "transition-colors cursor-pointer " +
                        (isSelected
                          ? "bg-[#f3f3f7]/70 border-l-2 border-l-[#000000]"
                          : "hover:bg-[#f3f3f7] active:bg-[#eeedf1]")
                      }
                    >
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={
                              "text-[13.5px] leading-[18px] tracking-[0.01em] text-[#1a1c1f] " +
                              (isSelected ? "font-semibold" : "font-medium")
                            }
                          >
                            #{inv.docNo}
                          </span>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                            {inv.entryOn}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[13.5px] leading-5 font-medium text-[#1a1c1f]">
                            {inv.party || "Walk-in guest"}
                          </span>
                          {inv.phone ? (
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] tabular-nums">
                              {inv.phone}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span className="text-[13.5px] leading-5 text-[#1a1c1f]">{inv.staffName ?? "—"}</span>
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                          {ringgit(inv.amountCents)}
                        </span>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] uppercase px-1.5 py-0.5 rounded bg-[#eeedf1]">
                          {inv.method || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span
                          className={
                            "inline-flex items-center h-[22px] px-2 rounded-[6px] text-[11.5px] font-medium tracking-[0.04em] uppercase border " +
                            STATUS_BADGE[inv.status].className
                          }
                        >
                          {STATUS_BADGE[inv.status].label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(inv.id);
                          }}
                          className={
                            "h-7 px-2.5 rounded transition-colors active:scale-[0.97] text-[12px] inline-flex items-center gap-1 " +
                            (isSelected
                              ? "bg-[#000000] text-[#ffffff] hover:bg-zinc-800"
                              : "bg-[#f3f3f7] border border-[#e2e2e6] text-[#1a1c1f] hover:bg-[#eeedf1]")
                          }
                        >
                          <span className="material-symbols-outlined text-[15px]">print</span>
                          <span>Preview</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-[#ffffff] border-t border-[#e2e2e6] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[13.5px] leading-5 text-[#5e5e67]">
              {visibleInvoices.length > 0 ? (
                <>
                  Showing <span className="font-medium text-[#1a1c1f]">1</span> to{" "}
                  <span className="font-medium text-[#1a1c1f]">{visibleInvoices.length}</span> of{" "}
                  <span className="font-medium text-[#1a1c1f]">{filteredInvoices.length}</span>
                  {filteredInvoices.length !== invoices.length ? ` (filtered from ${invoices.length})` : ""}
                </>
              ) : (
                <>
                  Showing <span className="font-medium text-[#1a1c1f]">0</span> of{" "}
                  <span className="font-medium text-[#1a1c1f]">{invoices.length}</span>
                </>
              )}{" "}
              Invoices
            </span>
            {filteredInvoices.length > shown && (
              <button
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="h-7 px-3 rounded text-[12px] font-medium bg-[#f3f3f7] border border-[#e2e2e6] text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.97] transition-all"
              >
                Show {Math.min(PAGE_SIZE, filteredInvoices.length - shown)} more ({filteredInvoices.length - shown} left)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Live Print Terminal */}
      <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-3 sticky top-6">
        <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-3 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1a1c1f]">receipt_long</span>
                <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                  Preview &amp; Print Dispatch
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 p-0.5 bg-[#eeedf1] rounded border border-[#e2e2e6]">
              <button
                onClick={() => setFormatTab("thermal")}
                className={
                  "py-1 px-2 rounded text-center text-[11.5px] leading-4 tracking-[0.04em] uppercase tracking-wider transition-all active:scale-[0.97] " +
                  (formatTab === "thermal" ? "font-semibold bg-[#ffffff] text-[#1a1c1f]" : "font-medium text-[#5e5e67] hover:text-[#1a1c1f]")
                }
              >
                80mm Thermal Slip
              </button>
              <button
                onClick={() => setFormatTab("a4")}
                className={
                  "py-1 px-2 rounded text-center text-[11.5px] leading-4 tracking-[0.04em] uppercase tracking-wider transition-all active:scale-[0.97] " +
                  (formatTab === "a4" ? "font-semibold bg-[#ffffff] text-[#1a1c1f]" : "font-medium text-[#5e5e67] hover:text-[#1a1c1f]")
                }
              >
                A4 Print
              </button>
            </div>
          </div>

          {selected ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDirectPrint}
                  disabled={printState !== "idle"}
                  className="flex-1 h-9 px-3 bg-[#000000] text-[#ffffff] rounded hover:bg-zinc-800 active:scale-[0.98] transition-all text-[13.5px] leading-5 font-semibold inline-flex items-center justify-center gap-2"
                >
                  <span
                    className={
                      "material-symbols-outlined text-[18px] transition-colors" +
                      (printState === "spooling" ? " animate-spin" : "") +
                      (printState === "dispatched" ? " text-emerald-400" : "")
                    }
                  >
                    {printState === "idle" ? "print" : printState === "spooling" ? "refresh" : "done"}
                  </span>
                  <span>
                    {printState === "idle"
                      ? "Direct Print (⌘P)"
                      : printState === "spooling"
                        ? "Spooling..."
                        : "Dispatched"}
                  </span>
                </button>
              </div>

              {/* Receipt paper -- real fields only, no invented tax line */}
              <div className="relative bg-zinc-50 border border-zinc-300 rounded p-5 font-mono text-[11px] leading-[17px] text-zinc-900 shadow-sm select-text">
                <div className="text-center pb-3">
                  <div className="text-[13px] font-bold tracking-tight text-black uppercase">{businessName}</div>
                </div>
                <div className="border-b border-dashed border-zinc-400 my-2" />
                <div className="space-y-0.5 text-zinc-700">
                  <div className="flex justify-between">
                    <span className="font-bold text-black">RECEIPT:</span>
                    <span className="font-bold text-black tabular-nums">#{selected.docNo}</span>
                  </div>
                  <div className="flex justify-between tabular-nums">
                    <span>Date: {selected.entryOn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Guest: {selected.party || "Walk-in guest"}</span>
                  </div>
                  {selected.staffName ? (
                    <div className="flex justify-between">
                      <span>Stylist: {selected.staffName}</span>
                    </div>
                  ) : null}
                </div>
                <div className="border-b border-dashed border-zinc-400 my-2" />
                <div className="flex justify-between text-[13px] font-bold text-black pt-1">
                  <span>TOTAL PAID:</span>
                  <span className="tabular-nums">{ringgit(selected.amountCents)}</span>
                </div>
                <div className="border-b border-dashed border-zinc-400 my-2" />
                <div className="space-y-0.5 text-zinc-700">
                  <div className="flex justify-between font-semibold text-black">
                    <span>PAYMENT: {selected.method || "Not specified"}</span>
                  </div>
                </div>
                {selected.status === "refunded" ? (
                  <>
                    <div className="border-b border-dashed border-zinc-400 my-2" />
                    <div className="text-center font-bold text-[#ba1a1a]">REFUNDED / VOID</div>
                  </>
                ) : null}
                <div className="border-b border-dashed border-zinc-400 my-2" />
                <div className="text-center space-y-1 text-zinc-600 pt-1">
                  <div className="text-zinc-800 font-medium">Thank you for visiting {businessName}</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13.5px] text-[#77767b] py-8 text-center">No invoices to preview yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
