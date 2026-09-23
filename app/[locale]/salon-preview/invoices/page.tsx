"use client";

import { useEffect, useState } from "react";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Invoice Dispatch &
 * Tax Print Spooler" (Task 405, pasted 2026-09-23).
 *
 * Client Component: the source wires four real behaviours, all ported to
 * React state instead of re-invented --
 *   1. clicking an invoice row highlights it and swaps its row-action
 *      button to the primary style (this is ALL the row click does in his
 *      own vanilla JS -- see the caveat below)
 *   2. "Direct Print" and "Thermal Test Print" each play the same
 *      spooling -> dispatched -> idle sequence his setTimeout chain did
 *   3. ⌘P / Ctrl+P triggers Direct Print, same as his `window.addEventListener`
 *   4. the 80mm/A4 format tabs toggle their own active/inactive look
 *
 * CAVEAT, preserved rather than "fixed": his own script does not update the
 * thermal-receipt preview when a different row is clicked -- only the row
 * highlight and button style change. The preview always shows the
 * #INV-2024-1088 / Amanda Choong receipt regardless of which row is
 * selected. That is a real gap in his own design (a prospect clicking row 2
 * would expect the receipt on the right to change), not something this
 * port introduced -- flagging it rather than quietly inventing behaviour
 * his source doesn't have.
 *
 * WHAT IS REAL AND WHAT IS NOT: every invoice, guest, amount and hardware
 * status below is his own sample content. Nothing here reads from or
 * writes to a database -- "Manual New Invoice", "Export Tax Ledger", the
 * date arrows, and the four filter/status pills are exactly as inert in
 * his source as they are here (no onclick wired for any of them there
 * either).
 */

type InvoiceStatus = "settled" | "pending" | "refunded";

type Invoice = {
  id: string;
  time: string;
  terminal: string;
  guest: string;
  phone: string;
  stylist: string;
  services: string;
  servicesFull: string;
  amount: string;
  method: string;
  status: InvoiceStatus;
};

const INVOICES: Invoice[] = [
  {
    id: "INV-2024-1088",
    time: "19:42",
    terminal: "POS Terminal #1",
    guest: "Amanda Choong",
    phone: "+60 12-882 9104",
    stylist: "Jasmine Teo",
    services: "Balayage Full Lift + K18 Molecular Treatment + Olaplex No. 3",
    servicesFull: "Balayage Full Lift + K18 Molecular Treatment + Olaplex No. 3 Retail",
    amount: "RM 780.00",
    method: "Maybank EDC",
    status: "settled",
  },
  {
    id: "INV-2024-1087",
    time: "18:15",
    terminal: "POS Terminal #1",
    guest: "Datin Nora Al-Habshee",
    phone: "+60 12-553 0921",
    stylist: "Wei Lin",
    services: "Japanese Hair Spa + Precision Scissor Cut + Kerastase Serum",
    servicesFull: "Japanese Hair Spa + Precision Scissor Cut + Kerastase Serum",
    amount: "RM 590.00",
    method: "DuitNow QR",
    status: "settled",
  },
  {
    id: "INV-2024-1086",
    time: "16:30",
    terminal: "POS Terminal #2",
    guest: "Lim Wei Seng",
    phone: "+60 16-778 2004",
    stylist: "Amy Chen",
    services: "Men's Scissor Restyle & Scalp Detox",
    servicesFull: "Men's Scissor Restyle & Scalp Detox",
    amount: "RM 160.00",
    method: "Cash Drawer",
    status: "settled",
  },
  {
    id: "INV-2024-1085",
    time: "14:50",
    terminal: "POS Terminal #1",
    guest: "Rachel Soo",
    phone: "+60 11-230 4401",
    stylist: "Jasmine Teo",
    services: "Korean Digital Perm & Milbon Bond Mask",
    servicesFull: "Korean Digital Perm & Milbon Bond Mask",
    amount: "RM 520.00",
    method: "Maybank EDC",
    status: "pending",
  },
  {
    id: "INV-2024-1084",
    time: "13:10",
    terminal: "POS Terminal #3",
    guest: "Elena Rostova",
    phone: "+60 17-229 0113",
    stylist: "Chloe Tan",
    services: "Root Color Touchup & Blowdry",
    servicesFull: "Root Color Touchup & Blowdry",
    amount: "RM 220.00",
    method: "DuitNow QR",
    status: "settled",
  },
  {
    id: "INV-2024-1083",
    time: "11:20",
    terminal: "POS Terminal #2",
    guest: "Marcus Tan",
    phone: "+60 19-482 9110",
    stylist: "Amy Chen",
    services: "Classic Beard Trim & Scissor Cut",
    servicesFull: "Classic Beard Trim & Scissor Cut",
    amount: "RM 140.00",
    method: "Cash Drawer",
    status: "refunded",
  },
];

const FILTERS: { label: string; status: InvoiceStatus | "all"; total: number }[] = [
  { label: "All Status (142)", status: "all", total: 142 },
  { label: "Settled (134)", status: "settled", total: 134 },
  { label: "Pending Deposit (5)", status: "pending", total: 5 },
  { label: "Refunded / Void (3)", status: "refunded", total: 3 },
];

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  settled: { label: "Settled", className: "text-[#1a9a4d] bg-[#1a9a4d]/[0.08] border-[#1a9a4d]/20" },
  pending: { label: "Pending Deposit", className: "text-[#a15c00] bg-[#a15c00]/[0.08] border-[#a15c00]/20" },
  refunded: { label: "Refunded / Void", className: "text-[#ba1a1a] bg-[#ba1a1a]/[0.08] border-[#ba1a1a]/20" },
};

const PRINTERS = [
  { name: "Epson TM-T88VI", detail: "192.168.1.180:9100" },
  { name: "HP LaserJet (A4)", detail: "Google Cloud Print" },
];

type PrintState = "idle" | "spooling" | "dispatched";

export default function SalonInvoicesPreview() {
  const [selectedInv, setSelectedInv] = useState<string>(INVOICES[0].id);
  const [printState, setPrintState] = useState<PrintState>("idle");
  const [testPrintState, setTestPrintState] = useState<PrintState>("idle");
  const [formatTab, setFormatTab] = useState<"thermal" | "a4">("thermal");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");

  const visibleInvoices = INVOICES.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      inv.id.toLowerCase().includes(q) ||
      inv.guest.toLowerCase().includes(q) ||
      inv.phone.toLowerCase().includes(q)
    );
  });

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
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="invoices-and-terminal" />
        <div className="pl-64 min-h-screen flex flex-col bg-[#f9f9fd]">
          <main className="flex-1 w-full p-8">
            <div className="flex flex-col w-full">
              {/* Breadcrumb & Status Terminal Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] tracking-widest uppercase">
                    <span>OPERATIONS</span>
                    <span className="text-[#c8c5cb]">/</span>
                    <span>MANAGEMENT</span>
                    <span className="text-[#c8c5cb]">/</span>
                    <span className="text-[#1a1c1f] font-semibold">INVOICES &amp; TERMINAL</span>
                  </div>
                  <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                    Invoice Dispatch &amp; Tax Print Spooler
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#eeedf1] border border-[#e2e2e6]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                    </span>
                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b]">
                      Thermal Slip &amp; A4 Cloud Spooler · Online
                    </span>
                    <span className="text-[#c8c5cb]">|</span>
                    <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#1a1c1f] uppercase">
                      #POS-01-BANGSAR
                    </span>
                  </div>
                  <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded bg-[#ffffff] border border-[#c8c5cb] text-[#1a1c1f] hover:bg-[#eeedf1] hover:border-[#1a1c1f] active:scale-[0.97] transition-all text-[13.5px] leading-5">
                    <span className="material-symbols-outlined text-[17px]">receipt</span>
                    <span>Manual New Invoice</span>
                  </button>
                  <button
                    onClick={() => runPrintSequence(setTestPrintState)}
                    disabled={testPrintState !== "idle"}
                    title={testPrintState === "idle" ? "Thermal Test Print" : testPrintState === "spooling" ? "Spooling to ESC/POS..." : "Slip Dispatched"}
                    aria-label="Thermal Test Print"
                    className={
                      "h-9 w-9 inline-flex items-center justify-center rounded bg-[#ffffff] border active:scale-[0.97] transition-colors " +
                      (testPrintState === "dispatched"
                        ? "border-emerald-200 text-emerald-600"
                        : "border-[#e2e2e6] text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1]")
                    }
                  >
                    <span className={"material-symbols-outlined text-[18px] transition-colors" + (testPrintState === "spooling" ? " animate-spin" : "")}>
                      {testPrintState === "idle" ? "print" : testPrintState === "spooling" ? "refresh" : "done"}
                    </span>
                  </button>
                  <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded bg-[#ffffff] border border-[#c8c5cb] text-[#1a1c1f] hover:bg-[#eeedf1] hover:border-[#1a1c1f] active:scale-[0.97] transition-all text-[13.5px] leading-5">
                    <span className="material-symbols-outlined text-[17px]">download</span>
                    <span>Export Tax Ledger (SST)</span>
                  </button>
                </div>
              </div>

              {/* Golden Ratio Split Canvas */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-3">
                  {/* Filter & Search Toolbar */}
                  <div className="p-3 bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm flex flex-col gap-2">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#77767b] text-[18px]">
                          search
                        </span>
                        <input
                          className="w-full h-9 pl-9 pr-3 bg-[#ffffff] border border-[#e2e2e6] rounded text-[13.5px] leading-5 text-[#1a1c1f] placeholder:text-[#77767b] focus:outline-none focus:border-[#1a1c1f] transition-colors"
                          placeholder="Search invoice #, guest name, phone, or payment ref..."
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between bg-[#ffffff] border border-[#e2e2e6] rounded h-9 px-1">
                        <button
                          aria-label="Previous day"
                          className="p-1 text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1] rounded transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] block">chevron_left</span>
                        </button>
                        <div className="flex items-center gap-1.5 px-2">
                          <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">calendar_today</span>
                          <span className="text-[13.5px] leading-5 text-[#1a1c1f] font-medium whitespace-nowrap">
                            Today, 24 Oct 2024
                          </span>
                        </div>
                        <button
                          aria-label="Next day"
                          className="p-1 text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1] rounded transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] block">chevron_right</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {FILTERS.map((f) => (
                        <button
                          key={f.label}
                          onClick={() => setStatusFilter(f.status)}
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

                  {/* Invoices Table */}
                  <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-[#f3f3f7] border-b border-[#e2e2e6]">
                            <th className="py-2.5 px-3 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                              Invoice No &amp; Time
                            </th>
                            <th className="py-2.5 px-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                              Guest &amp; Contact
                            </th>
                            <th className="py-2.5 px-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                              Stylist
                            </th>
                            <th className="py-2.5 px-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase tracking-wider">
                              Services &amp; Retail
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
                              <td colSpan={8} className="py-10 text-center text-[13.5px] text-[#5e5e67]">
                                No invoices match {search.trim() ? `"${search.trim()}"` : "this filter"} in today&apos;s list.
                              </td>
                            </tr>
                          )}
                          {visibleInvoices.map((inv) => {
                            const isSelected = inv.id === selectedInv;
                            return (
                              <tr
                                key={inv.id}
                                onClick={() => setSelectedInv(inv.id)}
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
                                      #{inv.id}
                                    </span>
                                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                                      {inv.time} · {inv.terminal}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-[13.5px] leading-5 font-medium text-[#1a1c1f]">{inv.guest}</span>
                                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] tabular-nums">
                                      {inv.phone}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  <span className="text-[13.5px] leading-5 text-[#1a1c1f]">{inv.stylist}</span>
                                </td>
                                <td className="py-3 px-2 max-w-[210px]">
                                  <p
                                    className={"text-[13.5px] leading-5 truncate " + (isSelected ? "text-[#1a1c1f]" : "text-[#5e5e67]")}
                                    title={inv.servicesFull}
                                  >
                                    {inv.services}
                                  </p>
                                </td>
                                <td className="py-3 px-2 text-right whitespace-nowrap">
                                  <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">
                                    {inv.amount}
                                  </span>
                                </td>
                                <td className="py-3 px-2 whitespace-nowrap">
                                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#47464b] uppercase px-1.5 py-0.5 rounded bg-[#eeedf1]">
                                    {inv.method}
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
                    <div className="px-3 py-2 bg-[#ffffff] border-t border-[#e2e2e6] flex flex-col sm:flex-row items-center justify-between gap-2">
                      <span className="text-[13.5px] leading-5 text-[#5e5e67]">
                        {visibleInvoices.length > 0 ? (
                          <>
                            Showing <span className="font-medium text-[#1a1c1f]">1</span> to{" "}
                            <span className="font-medium text-[#1a1c1f]">{visibleInvoices.length}</span> of{" "}
                          </>
                        ) : (
                          "Showing 0 of "
                        )}
                        <span className="font-medium text-[#1a1c1f]">
                          {(FILTERS.find((f) => f.status === statusFilter) ?? FILTERS[0]).total}
                        </span>{" "}
                        Invoices
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled
                          className="h-8 px-2.5 rounded bg-[#f3f3f7] text-[#77767b] cursor-not-allowed text-[13.5px] leading-5 inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                          <span>Previous</span>
                        </button>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#1a1c1f] font-semibold px-2">
                          Page 1 of 24
                        </span>
                        <button className="h-8 px-2.5 rounded bg-[#f3f3f7] border border-[#e2e2e6] text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.97] transition-colors text-[13.5px] leading-5 inline-flex items-center gap-1">
                          <span>Next</span>
                          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                      </div>
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
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">
                          ESC/POS v2.4
                        </span>
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
                          A4 SST Tax PDF
                        </button>
                      </div>
                    </div>

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
                              ? "Spooling to ESC/POS..."
                              : "Slip Dispatched"}
                        </span>
                      </button>
                      <button
                        aria-label="Send via WhatsApp"
                        title="Send WhatsApp PDF"
                        className="h-9 w-9 bg-[#ffffff] border border-[#e2e2e6] text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.97] rounded transition-colors inline-flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[18px]">chat</span>
                      </button>
                      <button
                        aria-label="Email Invoice PDF"
                        title="Email Invoice"
                        className="h-9 w-9 bg-[#ffffff] border border-[#e2e2e6] text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.97] rounded transition-colors inline-flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[18px]">mail</span>
                      </button>
                    </div>

                    {/* Thermal Receipt Simulation Paper */}
                    <div className="relative bg-zinc-50 border border-zinc-300 rounded p-5 font-mono text-[11px] leading-[17px] text-zinc-900 shadow-sm select-text">
                      <div className="absolute -top-1.5 left-0 right-0 h-1.5 flex justify-between overflow-hidden opacity-60">
                        <div className="w-full border-t border-dashed border-zinc-400" />
                      </div>
                      <div className="text-center pb-3">
                        <div className="text-[13px] font-bold tracking-tight text-black">WEI HAIR STUDIO</div>
                        <div className="text-[10px] tracking-wide text-zinc-600">BANGSAR FLAGSHIP</div>
                        <div className="text-[9.5px] text-zinc-500 mt-1">Lot 12A, Jalan Telawi 3, Bangsar</div>
                        <div className="text-[9.5px] text-zinc-500">59100 Kuala Lumpur, Wilayah Persekutuan</div>
                        <div className="text-[9.5px] text-zinc-500 mt-0.5">SST Reg: W10-1808-32000455 · Tel: +60 3-2284 9104</div>
                      </div>
                      <div className="border-b border-dashed border-zinc-400 my-2" />
                      <div className="space-y-0.5 text-zinc-700">
                        <div className="flex justify-between">
                          <span className="font-bold text-black">TAX INVOICE:</span>
                          <span className="font-bold text-black tabular-nums">#INV-2024-1088</span>
                        </div>
                        <div className="flex justify-between tabular-nums">
                          <span>Date: 24/10/2024</span>
                          <span>Time: 19:42:15</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cashier: Wei Lin</span>
                          <span>Station: POS-01</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Guest: Amanda Choong</span>
                          <span className="text-[9.5px] font-semibold text-zinc-800">[VIP PLATINUM]</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stylist: Jasmine Teo</span>
                          <span className="text-zinc-500 text-[9.5px]">Master Colorist</span>
                        </div>
                      </div>
                      <div className="border-b border-dashed border-zinc-400 my-2" />
                      <div className="flex justify-between text-[10px] font-bold text-black tracking-wider">
                        <span>ITEMS &amp; DESCRIPTION</span>
                        <span>AMOUNT</span>
                      </div>
                      <div className="space-y-1.5 pt-1 text-zinc-800">
                        <div>
                          <div className="flex justify-between items-baseline">
                            <span className="font-semibold text-black">1x Balayage Signature Lift</span>
                            <span className="tabular-nums font-semibold text-black">RM 480.00</span>
                          </div>
                          <div className="text-[9.5px] text-zinc-500 italic pl-3">Full head babylights + root melt gloss</div>
                        </div>
                        <div>
                          <div className="flex justify-between items-baseline">
                            <span className="font-semibold text-black">1x K18 Molecular Treatment</span>
                            <span className="tabular-nums font-semibold text-black">RM 180.00</span>
                          </div>
                          <div className="text-[9.5px] text-zinc-500 italic pl-3">Professional peptide bond repair</div>
                        </div>
                        <div>
                          <div className="flex justify-between items-baseline">
                            <span className="font-semibold text-black">1x Olaplex No. 3 (100ml)</span>
                            <span className="tabular-nums font-semibold text-black">RM 120.00</span>
                          </div>
                          <div className="text-[9.5px] text-zinc-500 italic pl-3">Retail retail homecare hair perfector</div>
                        </div>
                      </div>
                      <div className="border-b border-dashed border-zinc-400 my-2" />
                      <div className="space-y-1 text-zinc-800">
                        <div className="flex justify-between">
                          <span>SUBTOTAL:</span>
                          <span className="tabular-nums">RM 780.00</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>SST (6% Tax Included):</span>
                          <span className="tabular-nums">RM  44.15</span>
                        </div>
                        <div className="flex justify-between text-[13px] font-bold text-black pt-1 border-t border-zinc-300">
                          <span>TOTAL PAYABLE:</span>
                          <span className="tabular-nums">RM 780.00</span>
                        </div>
                      </div>
                      <div className="border-b border-dashed border-zinc-400 my-2" />
                      <div className="space-y-0.5 text-zinc-700">
                        <div className="flex justify-between font-semibold text-black">
                          <span>PAYMENT: Maybank EDC</span>
                          <span>VISA DEBIT</span>
                        </div>
                        <div className="flex justify-between text-[9.5px] text-zinc-500 tabular-nums">
                          <span>Approval Code: 489201</span>
                          <span>Batch: #089</span>
                        </div>
                        <div className="flex justify-between text-[9.5px] text-zinc-500 tabular-nums">
                          <span>Card: **** **** **** 4812</span>
                          <span>Auth: Approved 00</span>
                        </div>
                        <div className="flex justify-between pt-0.5 font-semibold text-zinc-800 tabular-nums">
                          <span>CHANGE DUE:</span>
                          <span>RM   0.00</span>
                        </div>
                      </div>
                      <div className="border-b border-dashed border-zinc-400 my-2" />
                      <div className="text-center space-y-1 text-zinc-600 pt-1">
                        <div className="text-zinc-800 font-medium">Thank you for visiting Wei Hair Studio</div>
                        <div className="text-[9.5px]">
                          Follow us Instagram: <span className="font-semibold text-black">@weihair.studio</span>
                        </div>
                        <div className="text-[9px] text-zinc-500 leading-tight">
                          Complimentary color-balancing &amp; fringe touchup consultation valid within 7 days of service with
                          receipt.
                        </div>
                      </div>
                      <div className="absolute -bottom-1.5 left-0 right-0 h-1.5 flex justify-between overflow-hidden opacity-60">
                        <div className="w-full border-b border-dashed border-zinc-400" />
                      </div>
                    </div>

                    {/* Hardware & Spooler Diagnostic Pill Matrix */}
                    <div className="p-2 bg-[#eeedf1] rounded border border-[#e2e2e6] space-y-2">
                      <div className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                        HARDWARE CONNECTIVITY
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PRINTERS.map((p) => (
                          <div
                            key={p.name}
                            className="flex items-center justify-between p-2 rounded bg-[#ffffff] border border-[#e2e2e6]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-semibold text-[#1a1c1f] truncate">{p.name}</span>
                                <span className="text-[10px] text-[#5e5e67] tabular-nums truncate">{p.detail}</span>
                              </div>
                            </div>
                            <span className="text-[10px] uppercase text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 shrink-0">
                              Ready
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#5e5e67] pt-1 px-1">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-emerald-600">check_circle</span>
                          Auto-Cutter: Active
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-emerald-600">check_circle</span>
                          Drawer Kick: Pin 2 (100ms)
                        </span>
                        <span className="flex items-center gap-1 tabular-nums">Buffer: 0 Pending</span>
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
