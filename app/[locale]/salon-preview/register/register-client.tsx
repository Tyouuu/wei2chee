"use client";

import { useEffect, useRef, useState } from "react";
import { SalonSidebar } from "../salon-shell";

export type CatalogRow = { id: string; name: string; unit: string; sku: string; priceCents: number | null };

const PAYMENT_METHODS = [
  { key: "qr", icon: "qr_code_scanner", label: "DuitNow QR", note: "Instant Settlement" },
  { key: "card", icon: "credit_card", label: "Terminal EDC", note: "Visa / Master" },
  { key: "cash", icon: "payments", label: "Cash Drawer", note: "Exact / Change" },
  { key: "pass", icon: "loyalty", label: "Prepaid Pass", note: "Deduct sessions" },
] as const;

const SAMPLE_LINES = [
  { name: "Full Balayage & Gloss Lift", note: "Jasmine Teo · Chair 03", price: "RM 480.00" },
  { name: "Kérastase Chronologiste Oil", note: "Retail take-home", price: "RM 220.00" },
];

const PARKED_FOLIOS = [
  { chair: "Chair 01 · Sample Guest A", detail: "Fade + Scalp Detox", price: "RM 210.00" },
  { chair: "Chair 05 · Sample Guest B", detail: "Blowdry & Retail Oil", price: "RM 285.00" },
];

function ringgit(cents: number): string {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", { minimumFractionDigits: whole % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
function notWired(what: string) {
  alert(`${what} isn't wired up yet -- there's no cart/checkout database behind this register.`);
}

export function RegisterClient({
  businessName,
  leadName,
  catalog,
  canSeeMoney,
  shiftTakingsCents,
  settledCount,
  totalCount,
}: {
  businessName: string;
  leadName: string;
  catalog: CatalogRow[];
  canSeeMoney: boolean;
  shiftTakingsCents: number | null;
  settledCount: number;
  totalCount: number;
}) {
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["key"]>("qr");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleCatalog = catalog.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
  });

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
    <div
      className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="register-and-checkout" businessName={businessName} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main className="w-full pt-0 bg-[#f9f9fd] min-h-screen">
          <div className="flex flex-col w-full">
            <div className="p-8 w-full max-w-[1720px] mx-auto space-y-6">
              {/* Top Utility Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#c8c5cb]/20">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#1a9a4d] animate-pulse" />
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#1a1c1f]">{businessName}</span>
                  </div>
                  <span className="text-[#c8c5cb]/60 text-xs">/</span>
                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#eeedf1] px-2.5 py-1 rounded text-[#5e5e67] font-medium">Cashier: {leadName}</span>
                </div>
                <div className="flex items-center gap-5 text-[13.5px]">
                  {canSeeMoney && shiftTakingsCents != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">Shift Takings:</span>
                      <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(shiftTakingsCents)}</span>
                    </div>
                  )}
                  <div className="h-3.5 w-px bg-[#c8c5cb]/30" />
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">Completed Today:</span>
                    <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">{settledCount} / {totalCount}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-8 items-start w-full">
                {/* LEFT: Catalog */}
                <div className="flex-1 w-full min-w-0 flex flex-col space-y-6">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#5e5e67]">search</span>
                      <input
                        ref={searchRef}
                        className="w-full h-10 pl-10 pr-20 rounded-lg bg-[#ffffff] text-[#1a1c1f] placeholder:text-[#5e5e67]/70 focus:outline-none focus:ring-1 focus:ring-[#000000] shadow-sm border border-[#c8c5cb]/30 text-[13.5px] leading-5 font-normal"
                        placeholder="Search service or retail SKU... (⌘K)"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                        <kbd className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#5e5e67] bg-[#eeedf1] rounded border border-[#c8c5cb]/20">⌘K</kbd>
                      </div>
                    </div>
                    <button
                      onClick={() => notWired("Scanning a barcode")}
                      className="h-10 px-3.5 rounded-lg bg-[#ffffff] hover:bg-[#eeedf1] active:scale-[0.97] text-[#1a1c1f] text-[13.5px] leading-5 font-normal flex items-center gap-2 shadow-sm border border-[#c8c5cb]/30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
                      <span>Scan SKU</span>
                    </button>
                  </div>

                  {visibleCatalog.length === 0 && (
                    <div className="p-8 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm text-center text-[13.5px] text-[#5e5e67]">
                      {catalog.length === 0 ? "No services or products set up yet." : `No items match "${search.trim()}".`}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleCatalog.map((item) => (
                      <div key={item.id} className="group relative p-4 rounded-xl bg-[#ffffff] hover:shadow-md transition-all flex flex-col justify-between cursor-pointer border border-[#c8c5cb]/30">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider px-2 py-0.5 rounded font-medium bg-[#eeedf1] text-[#5e5e67]">{item.sku || "No SKU"}</span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">inventory_2</span>
                              {item.unit || "unit"}
                            </span>
                          </div>
                          <h3 className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-semibold text-[#1a1c1f] group-hover:text-[#000000] transition-colors leading-snug">{item.name}</h3>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#c8c5cb]/20">
                          <span className="text-[16px] text-[#1a1c1f] font-semibold tabular-nums">{item.priceCents != null ? ringgit(item.priceCents) : "—"}</span>
                          <button
                            onClick={() => notWired("Adding this to a cart")}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-[0.97] bg-[#eeedf1] hover:bg-[#000000] text-[#1a1c1f] hover:text-[#ffffff]"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT: Folio / Checkout Terminal -- sample ticket, clearly labelled */}
                <div className="w-full shrink-0 flex flex-col space-y-5 xl:w-[390px]">
                  <div className="rounded-2xl bg-[#ffffff] p-5 shadow-sm border border-[#c8c5cb]/30 flex flex-col space-y-4 relative">
                    <div className="flex items-center justify-between pb-3 border-b border-[#c8c5cb]/20">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[17px] text-[#1a1c1f] font-semibold">Sample Ticket</span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-semibold">Not a real folio</span>
                        </div>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5 block">Illustrates what checkout will look like once a cart is built</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => notWired("Holding this ticket")} className="h-7 w-7 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-center transition-colors" title="Hold Folio">
                          <span className="material-symbols-outlined text-[16px]">pause_circle</span>
                        </button>
                        <button onClick={() => notWired("Clearing this ticket")} className="h-7 w-7 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] text-[#5e5e67] hover:text-[#ba1a1a] flex items-center justify-center transition-colors" title="Clear Folio">
                          <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f3f3f7] border border-[#c8c5cb]/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0 pr-1">
                          <div className="w-9 h-9 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-semibold text-[11px] tracking-wider shrink-0">?</div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13.5px] leading-5 font-normal text-[#1a1c1f] font-semibold truncate">No client attached yet</span>
                          </div>
                        </div>
                        <button onClick={() => notWired("Attaching a client to this ticket")} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#e8e8ec] active:scale-[0.97] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors shrink-0" title="Attach Client">
                          <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-0.5">
                      <div className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67] flex justify-between border-b border-[#c8c5cb]/20 pb-1.5">
                        <span>Itemized Services &amp; Retail (Example)</span>
                        <span className="tabular-nums font-medium">{SAMPLE_LINES.length} Items</span>
                      </div>
                      <div className="space-y-2">
                        {SAMPLE_LINES.map((line) => (
                          <div key={line.name} className="p-2.5 rounded-xl bg-[#ffffff] hover:bg-[#f3f3f7] border border-[#c8c5cb]/20 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-6 h-6 rounded-md bg-[#eeedf1] flex items-center justify-center text-[#5e5e67] text-[11px] font-semibold tabular-nums shrink-0">1×</div>
                              <div className="min-w-0">
                                <h4 className="text-[13.5px] leading-5 font-normal text-[#1a1c1f] font-medium leading-tight truncate">{line.name}</h4>
                                <p className="text-[11px] text-[#5e5e67] mt-0.5 truncate">{line.note}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-right shrink-0">
                              <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">{line.price}</span>
                              <button onClick={() => notWired("Removing this line")} className="opacity-0 group-hover:opacity-100 p-0.5 text-[#5e5e67] hover:text-[#ba1a1a] transition-opacity">
                                <span className="material-symbols-outlined text-[15px]">close</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <button onClick={() => notWired("Adding a discount or tip")} className="text-[11.5px] text-[#5e5e67] hover:text-[#1a1c1f] active:scale-[0.97] flex items-center gap-1 font-medium transition-colors">
                          <span className="material-symbols-outlined text-[15px]">add_circle</span>
                          <span>Custom Discount / Tip</span>
                        </button>
                        <button onClick={() => notWired("Applying a voucher")} className="text-[11.5px] text-[#5e5e67] hover:text-[#1a1c1f] active:scale-[0.97] flex items-center gap-1 font-medium transition-colors">
                          <span className="material-symbols-outlined text-[15px]">redeem</span>
                          <span>Voucher</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#c8c5cb]/20 space-y-2">
                      <div className="flex justify-between text-[13.5px] text-[#5e5e67]">
                        <span className="text-[11.5px] uppercase tracking-wider">Items Subtotal (Example)</span>
                        <span className="tabular-nums text-[#1a1c1f] font-medium">RM 700.00</span>
                      </div>
                      <div className="pt-2.5 mt-1 border-t border-[#c8c5cb]/30 flex justify-between items-baseline">
                        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Total Payable (MYR)</span>
                        <span className="text-[24px] font-bold text-[#1a1c1f] tabular-nums tracking-tight">RM 700.00</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Select Settlement Method</span>
                      <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_METHODS.map((m) => {
                          const selected = method === m.key;
                          return (
                            <button
                              key={m.key}
                              onClick={() => setMethod(m.key)}
                              className={"p-2.5 rounded-xl flex items-center justify-between text-left transition-all active:scale-[0.97] border " + (selected ? "bg-[#000000] text-[#ffffff] shadow-sm border-[#000000]" : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] border-[#c8c5cb]/20")}
                            >
                              <div className="flex items-center gap-2">
                                <span className={"material-symbols-outlined text-[18px] " + (selected ? "" : "text-[#5e5e67]")}>{m.icon}</span>
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

                    <div className="pt-1 space-y-2">
                      <button
                        onClick={() => notWired("Charging and printing a receipt")}
                        className="w-full h-11 rounded-xl bg-[#000000] hover:bg-neutral-900 text-[#ffffff] text-[13.5px] leading-5 font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]"
                      >
                        <span className="material-symbols-outlined text-[17px]">check</span>
                        <span>Charge RM 700.00 &amp; Print Receipt</span>
                      </button>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => notWired("Sending a WhatsApp receipt")} className="h-8 px-1.5 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] border border-[#c8c5cb]/20 text-[#1a1c1f] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors">
                          <span className="material-symbols-outlined text-[13px]">send_to_mobile</span>
                          <span>WhatsApp</span>
                        </button>
                        <button onClick={() => notWired("Splitting the bill")} className="h-8 px-1.5 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] border border-[#c8c5cb]/20 text-[#1a1c1f] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors">
                          <span className="material-symbols-outlined text-[13px]">call_split</span>
                          <span>Split Bill</span>
                        </button>
                        <button onClick={() => notWired("Parking this ticket")} className="h-8 px-1.5 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] border border-[#c8c5cb]/20 text-[#1a1c1f] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors">
                          <span className="material-symbols-outlined text-[13px]">pause</span>
                          <span>Park Folio</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#ffffff] shadow-sm border border-[#c8c5cb]/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#c8c5cb]/20">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Other Parked Tickets (Example)</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#eeedf1] px-2 py-0.5 rounded text-[#5e5e67] font-medium tabular-nums">{PARKED_FOLIOS.length}</span>
                    </div>
                    <div className="space-y-2">
                      {PARKED_FOLIOS.map((f) => (
                        <div key={f.chair} onClick={() => notWired("Opening this parked ticket")} className="p-2.5 rounded-xl bg-[#f3f3f7] hover:bg-[#eeedf1] border border-[#c8c5cb]/20 transition-colors flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <div>
                              <div className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f]">{f.chair}</div>
                              <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">{f.detail}</div>
                            </div>
                          </div>
                          <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">{f.price}</span>
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
  );
}
