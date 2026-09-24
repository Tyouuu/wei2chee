"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { waLink } from "@/lib/portal/wa-link";
import { SalonSidebar } from "../salon-shell";

export type CatalogRow = { id: string; name: string; unit: string; sku: string; priceCents: number | null };
export type CustomerRow = { id: string; name: string; whatsapp: string };

const PAYMENT_METHODS = [
  { key: "qr", icon: "qr_code_scanner", label: "DuitNow QR", note: "Instant Settlement" },
  { key: "card", icon: "credit_card", label: "Terminal EDC", note: "Visa / Master" },
  { key: "cash", icon: "payments", label: "Cash Drawer", note: "Exact / Change" },
  { key: "pass", icon: "loyalty", label: "Prepaid Pass", note: "Deduct sessions" },
] as const;
type MethodKey = (typeof PAYMENT_METHODS)[number]["key"];
const methodLabelOf = (k: MethodKey) => PAYMENT_METHODS.find((m) => m.key === k)?.label ?? "Cash Drawer";

type CartLine = { itemId: string; name: string; unit: string; priceCents: number; qty: number };
type ParkedTicket = {
  id: string;
  label: string;
  detail: string;
  lines: CartLine[];
  partyId: string | null;
  partyName: string;
  discountCents: number;
  parkedAt: number;
};
type Receipt = {
  at: string;
  cashier: string;
  party: string;
  lines: CartLine[];
  subtotalCents: number;
  discountCents: number;
  voucherCents: number;
  totalCents: number;
  tenders: { label: string; amountCents: number }[];
  /** The attached client's WhatsApp number, if she has one on file. */
  whatsapp: string;
};

const PARK_KEY = "formae-register-parked-v1";

function ringgit(cents: number): string {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", { minimumFractionDigits: whole % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
/** "45", "45.5", "RM 1,045.00" -> cents; anything else -> null. */
function parseMoney(text: string): number | null {
  const t = text.replace(/RM|,|\s/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
function loadParked(): ParkedTicket[] {
  try {
    const raw = sessionStorage.getItem(PARK_KEY);
    return raw ? (JSON.parse(raw) as ParkedTicket[]) : [];
  } catch {
    return [];
  }
}
function saveParked(list: ParkedTicket[]) {
  try {
    sessionStorage.setItem(PARK_KEY, JSON.stringify(list));
  } catch {
    // sessionStorage can throw in a private tab -- parking just won't
    // survive a reload there, which is the same honest limit as always.
  }
}
function printWhenPainted() {
  // Two rAFs, not one -- a single frame can still land before React has
  // committed the receipt DOM the print rule reads from data-print-sheet.
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

/** The receipt as a WhatsApp message: what was bought, what was paid, how. */
function receiptMessage(r: Receipt, businessName: string): string {
  const when = new Date(r.at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" });
  return [
    `${businessName} — receipt (${when})`,
    ...r.lines.map((l) => `${l.qty} x ${l.name}  ${ringgit(l.priceCents * l.qty)}`),
    ...(r.discountCents > 0 ? [`Discount  -${ringgit(r.discountCents)}`] : []),
    ...(r.voucherCents > 0 ? [`Gift credit  -${ringgit(r.voucherCents)}`] : []),
    `Total paid  ${ringgit(r.totalCents)}`,
    r.tenders.map((t) => `${t.label} ${ringgit(t.amountCents)}`).join(" + "),
    "Thank you!",
  ].join("\n");
}

export function RegisterClient({
  businessName,
  leadName,
  projectId,
  catalog,
  customers,
  canSeeMoney,
  shiftTakingsCents,
  settledCount,
  totalCount,
  initialClientId = null,
}: {
  businessName: string;
  leadName: string;
  projectId: string;
  catalog: CatalogRow[];
  customers: CustomerRow[];
  canSeeMoney: boolean;
  shiftTakingsCents: number | null;
  settledCount: number;
  totalCount: number;
  /** ?client=<id> from a client's folio: the sale starts with her attached. */
  initialClientId?: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<MethodKey>("qr");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const initialClient = customers.find((c) => c.id === initialClientId) ?? null;
  const [partyId, setPartyId] = useState<string | null>(initialClient?.id ?? null);
  const [partyName, setPartyName] = useState(initialClient?.name ?? "");
  const [pickingClient, setPickingClient] = useState(false);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountCents, setDiscountCents] = useState(0);

  const [giftAvailableCents, setGiftAvailableCents] = useState<number | null>(null);
  const [voucherAppliedCents, setVoucherAppliedCents] = useState(0);

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitSecondInput, setSplitSecondInput] = useState("");
  const [splitSecondMethod, setSplitSecondMethod] = useState<MethodKey>("cash");

  const [parked, setParked] = useState<ParkedTicket[]>([]);
  const [charging, setCharging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // The number the receipt goes to: her saved WhatsApp, editable, because a
  // walk-in has none on file and a family often shares one phone.
  const [receiptWa, setReceiptWa] = useState("");

  // Scanning: a barcode scanner is a keyboard that types the code and presses
  // Enter, so the search box IS the scan input. Enter on an exact SKU adds it.
  const [scanNote, setScanNote] = useState<{ tone: "ready" | "ok" | "miss"; text: string } | null>(null);
  // An item with no price on file asks for one, once, and can remember it.
  const [priceFor, setPriceFor] = useState<CatalogRow | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [rememberPrice, setRememberPrice] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  // A price he just told us to remember shows on the card at once; the refresh
  // that brings it back from the database lands a moment later.
  const [savedPrices, setSavedPrices] = useState<Record<string, number>>({});
  const catalogView = useMemo(
    () => catalog.map((i) => (i.priceCents == null && i.id in savedPrices ? { ...i, priceCents: savedPrices[i.id] } : i)),
    [catalog, savedPrices],
  );

  useEffect(() => {
    // `react-hooks/set-state-in-effect` (task 47) rejects a setState call
    // that runs synchronously in the effect body -- so the sessionStorage
    // read (genuinely synchronous, nothing to await) goes through a real
    // microtask boundary instead, the same shape as the async branch
    // below and as period-lock.tsx's already-accepted pattern.
    let alive = true;
    Promise.resolve().then(() => {
      if (alive) setParked(loadParked());
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!partyId) {
      Promise.resolve().then(() => {
        if (!cancelled) { setGiftAvailableCents(null); setVoucherAppliedCents(0); }
      });
      return () => { cancelled = true; };
    }
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.rpc("credit_of", { in_project_id: projectId, in_party_id: partyId });
      const row = Array.isArray(data) ? data[0] : data;
      if (!cancelled) setGiftAvailableCents(row?.gift_cents ?? 0);
    })();
    return () => { cancelled = true; };
  }, [partyId, projectId]);

  const visibleCatalog = catalogView.filter((item) => {
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

  const subtotalCents = useMemo(() => cart.reduce((s, l) => s + l.priceCents * l.qty, 0), [cart]);
  const afterDiscountCents = Math.max(0, subtotalCents - discountCents);
  const netTotalCents = Math.max(0, afterDiscountCents - voucherAppliedCents);
  const splitSecondCents = splitOpen ? Math.round((parseFloat(splitSecondInput || "0") || 0) * 100) : 0;
  const splitFirstCents = Math.max(0, netTotalCents - splitSecondCents);
  const splitValid = !splitOpen || (splitSecondCents > 0 && splitSecondCents < netTotalCents);

  function addToCart(item: CatalogRow) {
    if (item.priceCents == null) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) return prev.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { itemId: item.id, name: item.name, unit: item.unit, priceCents: item.priceCents!, qty: 1 }];
    });
  }
  function tryAdd(item: CatalogRow) {
    if (item.priceCents == null) {
      setPriceFor(item);
      setPriceInput("");
      setPriceError(null);
      return;
    }
    addToCart(item);
  }
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = search.trim();
    if (!code) return;
    const hits = catalogView.filter((i) => i.sku && i.sku.trim().toLowerCase() === code.toLowerCase());
    if (hits.length === 1) {
      tryAdd(hits[0]);
      setSearch("");
      // An unpriced item opens the price prompt, which says so itself.
      setScanNote(hits[0].priceCents == null ? null : { tone: "ok", text: `Added ${hits[0].name}` });
    } else if (hits.length > 1) {
      setScanNote({ tone: "miss", text: `${hits.length} items share the SKU "${code}" — pick the right one below.` });
    } else {
      setScanNote({ tone: "miss", text: `No item has the SKU "${code}".` });
    }
  }
  function startScan() {
    searchRef.current?.focus();
    searchRef.current?.select();
    setScanNote({ tone: "ready", text: "Ready — point the scanner at the barcode, or type the SKU and press Enter." });
  }
  async function confirmPrice() {
    if (!priceFor || pricing) return;
    const cents = parseMoney(priceInput);
    if (cents == null) return setPriceError("Enter the price, like 45 or 45.50.");
    const item = priceFor;
    setPricing(true);
    setPriceError(null);
    addToCart({ ...item, priceCents: cents });
    let note: { tone: "ready" | "ok" | "miss"; text: string } = { tone: "ok", text: `Added ${item.name}` };
    if (rememberPrice) {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("update_catalog_item", { in_id: item.id, in_price_cents: cents });
      if (error) note = { tone: "miss", text: `Added ${item.name}, but the price was not saved: ${error.message}` };
      else {
        note = { tone: "ok", text: `Added ${item.name} — price saved for next time` };
        setSavedPrices((p) => ({ ...p, [item.id]: cents }));
        router.refresh();
      }
    }
    setScanNote(note);
    setPriceFor(null);
    setPricing(false);
  }
  function removeLine(itemId: string) {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId));
  }
  function resetTicket() {
    setCart([]);
    setPartyId(null);
    setPartyName("");
    setDiscountCents(0);
    setDiscountOpen(false);
    setDiscountInput("");
    setVoucherAppliedCents(0);
    setSplitOpen(false);
    setSplitSecondInput("");
    setErrorMsg(null);
  }

  function applyDiscount() {
    const trimmed = discountInput.trim();
    if (trimmed === "") { setDiscountCents(0); setDiscountOpen(false); return; }
    const cents = Math.round(parseFloat(trimmed) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    setDiscountCents(Math.min(cents, subtotalCents));
    setDiscountOpen(false);
  }

  function toggleVoucher() {
    if (voucherAppliedCents > 0) { setVoucherAppliedCents(0); return; }
    if (!giftAvailableCents || giftAvailableCents <= 0) return;
    setVoucherAppliedCents(Math.min(giftAvailableCents, afterDiscountCents));
  }

  function holdTicket() {
    if (cart.length === 0) return;
    const entry: ParkedTicket = {
      id: crypto.randomUUID(),
      label: partyName || "Walk-in",
      detail: cart.map((l) => `${l.qty}× ${l.name}`).join(", "),
      lines: cart,
      partyId,
      partyName,
      discountCents,
      parkedAt: Date.now(),
    };
    const next = [...parked, entry];
    setParked(next);
    saveParked(next);
    resetTicket();
  }
  function resumeTicket(id: string) {
    const found = parked.find((p) => p.id === id);
    if (!found) return;
    if (cart.length > 0 && !confirm("This clears the current ticket. Continue?")) return;
    setCart(found.lines);
    setPartyId(found.partyId);
    setPartyName(found.partyName);
    setDiscountCents(found.discountCents);
    const next = parked.filter((p) => p.id !== id);
    setParked(next);
    saveParked(next);
  }

  async function charge() {
    if (cart.length === 0 || charging || !splitValid) return;
    setCharging(true);
    setErrorMsg(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const noteText = cart.map((l) => `${l.qty}x ${l.name}`).join(", ") + (discountCents > 0 ? ` (RM ${(discountCents / 100).toFixed(2)} discount)` : "");
      const firstLabel = methodLabelOf(method);
      const secondLabel = methodLabelOf(splitSecondMethod);

      if (voucherAppliedCents > 0 && partyId) {
        const { error: creditErr } = await supabase.rpc("use_credit", {
          in_project_id: projectId,
          in_party_id: partyId,
          in_amount_cents: voucherAppliedCents,
          in_reason: "Register checkout",
        });
        if (creditErr) { setErrorMsg(creditErr.message); return; }
      }

      const tenders: { label: string; amountCents: number }[] = [];
      if (splitFirstCents > 0) {
        const { error } = await supabase.rpc("add_ledger_entry", {
          in_project_id: projectId,
          in_module_key: "payments",
          in_direction: "in",
          in_amount_cents: splitFirstCents,
          in_party: partyName || "Walk-in",
          in_party_id: partyId,
          in_category: "service",
          in_note: splitOpen ? `${noteText} (split: ${firstLabel})` : noteText,
          in_method: firstLabel,
        });
        if (error) { setErrorMsg(error.message); return; }
        tenders.push({ label: firstLabel, amountCents: splitFirstCents });
      }
      if (splitOpen && splitSecondCents > 0) {
        const { error } = await supabase.rpc("add_ledger_entry", {
          in_project_id: projectId,
          in_module_key: "payments",
          in_direction: "in",
          in_amount_cents: splitSecondCents,
          in_party: partyName || "Walk-in",
          in_party_id: partyId,
          in_category: "service",
          in_note: `${noteText} (split: ${secondLabel})`,
          in_method: secondLabel,
        });
        if (error) { setErrorMsg(error.message); return; }
        tenders.push({ label: secondLabel, amountCents: splitSecondCents });
      }
      if (voucherAppliedCents > 0) tenders.push({ label: "Gift Credit", amountCents: voucherAppliedCents });

      setReceipt({
        at: new Date().toISOString(),
        cashier: leadName,
        party: partyName || "Walk-in",
        lines: cart,
        subtotalCents,
        discountCents,
        voucherCents: voucherAppliedCents,
        totalCents: netTotalCents,
        tenders,
        whatsapp: customers.find((c) => c.id === partyId)?.whatsapp ?? "",
      });
      setReceiptWa(customers.find((c) => c.id === partyId)?.whatsapp ?? "");
      resetTicket();
      router.refresh();
      printWhenPainted();
    } finally {
      setCharging(false);
    }
  }

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
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setScanNote(null);
                        }}
                        onKeyDown={onSearchKey}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                        <kbd className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#5e5e67] bg-[#eeedf1] rounded border border-[#c8c5cb]/20">⌘K</kbd>
                      </div>
                    </div>
                    <button
                      onClick={startScan}
                      className="h-10 px-3.5 rounded-lg bg-[#ffffff] hover:bg-[#eeedf1] active:scale-[0.97] text-[#1a1c1f] text-[13.5px] leading-5 font-normal flex items-center gap-2 shadow-sm border border-[#c8c5cb]/30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
                      <span>Scan SKU</span>
                    </button>
                  </div>

                  {scanNote && (
                    <p
                      data-testid="scan-note"
                      className={"text-[12.5px] px-1 -mt-3 " + (scanNote.tone === "miss" ? "text-[#ba1a1a]" : "text-[#47464b]")}
                    >
                      {scanNote.text}
                    </p>
                  )}

                  {priceFor && (
                    <div data-testid="price-prompt" className="p-4 rounded-xl bg-[#ffffff] border-2 border-[#000000] shadow-sm flex flex-col gap-3">
                      <span className="text-[13.5px] text-[#1a1c1f]">
                        <strong className="font-semibold">{priceFor.name}</strong> has no price yet. What does it cost?
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#5e5e67]">RM</span>
                          <input
                            autoFocus
                            aria-label="Price"
                            inputMode="decimal"
                            value={priceInput}
                            onChange={(e) => {
                              setPriceInput(e.target.value);
                              setPriceError(null);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && confirmPrice()}
                            placeholder="0.00"
                            className="h-9 w-28 pl-9 pr-2 rounded-lg border border-[#c8c5cb]/60 text-[13.5px] tabular-nums focus:outline-none focus:border-[#000000]"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-[12.5px] text-[#47464b] cursor-pointer">
                          <input type="checkbox" checked={rememberPrice} onChange={(e) => setRememberPrice(e.target.checked)} className="h-4 w-4 accent-[#000000]" />
                          <span>Remember this price</span>
                        </label>
                        <div className="flex items-center gap-2 ml-auto">
                          <button type="button" onClick={() => setPriceFor(null)} className="h-9 px-3 rounded-lg border border-[#c8c5cb]/60 text-[13px] font-medium hover:bg-[#f3f3f7]">
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={pricing}
                            onClick={confirmPrice}
                            className="h-9 px-4 rounded-lg bg-[#000000] text-[#ffffff] text-[13px] font-semibold hover:bg-neutral-800 disabled:opacity-50"
                          >
                            Add to Ticket
                          </button>
                        </div>
                      </div>
                      {priceError && (
                        <p role="alert" data-testid="price-error" className="text-[12.5px] text-[#ba1a1a]">
                          {priceError}
                        </p>
                      )}
                    </div>
                  )}

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
                            onClick={() => tryAdd(item)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-[0.97] bg-[#eeedf1] hover:bg-[#000000] text-[#1a1c1f] hover:text-[#ffffff]"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT: Folio / Checkout Terminal -- real cart + real charge, or the last receipt */}
                <div className="w-full shrink-0 flex flex-col space-y-5 xl:w-[390px]">
                  {receipt ? (
                    <div className="rounded-2xl bg-[#ffffff] shadow-sm border border-[#c8c5cb]/30 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#c8c5cb]/20 bg-[#eeedf1]/40">
                        <span className="text-[13px] font-semibold text-[#1a1c1f] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-[#1a9a4d]">check_circle</span>
                          Charged &amp; Printed
                        </span>
                        <button onClick={printWhenPainted} className="text-[11.5px] font-medium text-[#5e5e67] hover:text-[#1a1c1f] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">print</span> Print Again
                        </button>
                      </div>
                      {/* Only this block survives @media print -- see globals.css'
                          [data-print-sheet] rule (task 139's printed-quotation
                          fix). Without it, printing here would print the whole
                          POS screen: sidebar, catalog grid and all. */}
                      <div data-print-sheet className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-[15px] font-semibold text-[#1a1c1f]">{businessName}</div>
                            <div className="text-[11px] text-[#5e5e67] mt-0.5">{new Date(receipt.at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" })}</div>
                          </div>
                          <div className="text-right text-[11px] text-[#5e5e67]">
                            <div>Cashier: {receipt.cashier}</div>
                            <div>{receipt.party}</div>
                          </div>
                        </div>
                        <div className="border-t border-[#c8c5cb]/30 pt-3 space-y-1.5">
                          {receipt.lines.map((l) => (
                            <div key={l.itemId} className="flex justify-between text-[12.5px] text-[#1a1c1f]">
                              <span>{l.qty}× {l.name}</span>
                              <span className="tabular-nums">{ringgit(l.priceCents * l.qty)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-[#c8c5cb]/30 pt-3 space-y-1 text-[12.5px]">
                          <div className="flex justify-between text-[#5e5e67]"><span>Subtotal</span><span className="tabular-nums">{ringgit(receipt.subtotalCents)}</span></div>
                          {receipt.discountCents > 0 && <div className="flex justify-between text-[#5e5e67]"><span>Discount</span><span className="tabular-nums">-{ringgit(receipt.discountCents)}</span></div>}
                          {receipt.voucherCents > 0 && <div className="flex justify-between text-[#5e5e67]"><span>Gift Credit</span><span className="tabular-nums">-{ringgit(receipt.voucherCents)}</span></div>}
                          <div className="flex justify-between text-[15px] font-bold text-[#1a1c1f] pt-1.5 border-t border-[#c8c5cb]/30"><span>Total Paid</span><span className="tabular-nums">{ringgit(receipt.totalCents)}</span></div>
                        </div>
                        <div className="border-t border-[#c8c5cb]/30 pt-3 space-y-1 text-[11.5px] text-[#5e5e67]">
                          {receipt.tenders.map((t, i) => (
                            <div key={i} className="flex justify-between"><span>{t.label}</span><span className="tabular-nums">{ringgit(t.amountCents)}</span></div>
                          ))}
                        </div>
                        <div className="text-center text-[11px] text-[#5e5e67] pt-2">Thank you</div>
                      </div>
                      <div className="p-4 border-t border-[#c8c5cb]/20 space-y-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Send receipt on WhatsApp</span>
                          <div className="flex items-center gap-2">
                            <input
                              aria-label="Customer WhatsApp"
                              type="tel"
                              value={receiptWa}
                              onChange={(e) => setReceiptWa(e.target.value)}
                              placeholder="012-345 6789"
                              className="h-9 flex-1 min-w-0 px-3 rounded-lg border border-[#c8c5cb]/60 text-[13px] focus:outline-none focus:border-[#000000]"
                            />
                            {waLink(receiptWa) ? (
                              <a
                                data-testid="wa-receipt"
                                href={waLink(receiptWa, receiptMessage(receipt, businessName)) ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="h-9 px-3.5 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] border border-[#c8c5cb]/40 text-[13px] font-medium text-[#1a1c1f] flex items-center gap-1.5 shrink-0"
                              >
                                <span className="material-symbols-outlined text-[15px]">send_to_mobile</span>
                                Send
                              </a>
                            ) : (
                              <span data-testid="wa-receipt-off" className="h-9 px-3.5 rounded-lg bg-[#f3f3f7] border border-[#c8c5cb]/30 text-[13px] text-[#77767b] flex items-center shrink-0 opacity-60">
                                Send
                              </span>
                            )}
                          </div>
                          {!waLink(receiptWa) && receiptWa.trim() !== "" && <span className="text-[11.5px] text-[#77767b]">That number is not complete — check it.</span>}
                        </div>
                        <button onClick={() => setReceipt(null)} className="w-full h-10 rounded-xl bg-[#000000] hover:bg-neutral-900 text-[#ffffff] text-[13.5px] font-semibold">
                          New Sale
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="rounded-2xl bg-[#ffffff] p-5 shadow-sm border border-[#c8c5cb]/30 flex flex-col space-y-4 relative">
                    <div className="flex items-center justify-between pb-3 border-b border-[#c8c5cb]/20">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[17px] text-[#1a1c1f] font-semibold">Current Ticket</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={holdTicket} disabled={cart.length === 0} className="h-7 w-7 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-center transition-colors disabled:opacity-30" title="Hold Folio">
                          <span className="material-symbols-outlined text-[16px]">pause_circle</span>
                        </button>
                        <button onClick={() => { if (cart.length === 0 || confirm("Clear this ticket?")) resetTicket(); }} className="h-7 w-7 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] text-[#5e5e67] hover:text-[#ba1a1a] flex items-center justify-center transition-colors" title="Clear Folio">
                          <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f3f3f7] border border-[#c8c5cb]/20 space-y-2.5">
                      {partyId ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0 pr-1">
                            <div className="w-9 h-9 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-semibold text-[11px] tracking-wider shrink-0">{initialsOf(partyName)}</div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13.5px] leading-5 font-normal text-[#1a1c1f] font-semibold truncate">{partyName}</span>
                            </div>
                          </div>
                          <button onClick={() => { setPartyId(null); setPartyName(""); }} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#e8e8ec] active:scale-[0.97] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors shrink-0" title="Change Client">
                            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                          </button>
                        </div>
                      ) : pickingClient ? (
                        <select
                          autoFocus
                          className="w-full h-9 px-2 rounded-lg bg-[#ffffff] border border-[#c8c5cb]/40 text-[13.5px] text-[#1a1c1f]"
                          onChange={(e) => {
                            const c = customers.find((x) => x.id === e.target.value);
                            if (c) { setPartyId(c.id); setPartyName(c.name); }
                            setPickingClient(false);
                          }}
                          onBlur={() => setPickingClient(false)}
                          defaultValue=""
                        >
                          <option value="" disabled>{customers.length === 0 ? "No clients in your directory yet" : "Select a client…"}</option>
                          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0 pr-1">
                            <div className="w-9 h-9 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-semibold text-[11px] tracking-wider shrink-0">?</div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13.5px] leading-5 font-normal text-[#1a1c1f] font-semibold truncate">No client attached yet</span>
                            </div>
                          </div>
                          <button onClick={() => setPickingClient(true)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#e8e8ec] active:scale-[0.97] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors shrink-0" title="Attach Client">
                            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-0.5">
                      <div className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67] flex justify-between border-b border-[#c8c5cb]/20 pb-1.5">
                        <span>Itemized Services &amp; Retail</span>
                        <span className="tabular-nums font-medium">{cart.length} Items</span>
                      </div>
                      {cart.length === 0 ? (
                        <p className="text-[12px] text-[#77767b] py-3 text-center">Add items from the catalog on the left.</p>
                      ) : (
                        <div className="space-y-2">
                          {cart.map((line) => (
                            <div key={line.itemId} className="p-2.5 rounded-xl bg-[#ffffff] hover:bg-[#f3f3f7] border border-[#c8c5cb]/20 transition-colors flex items-center justify-between group">
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className="w-6 h-6 rounded-md bg-[#eeedf1] flex items-center justify-center text-[#5e5e67] text-[11px] font-semibold tabular-nums shrink-0">{line.qty}×</div>
                                <div className="min-w-0">
                                  <h4 className="text-[13.5px] leading-5 font-normal text-[#1a1c1f] font-medium leading-tight truncate">{line.name}</h4>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-right shrink-0">
                                <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(line.priceCents * line.qty)}</span>
                                <button onClick={() => removeLine(line.itemId)} className="opacity-0 group-hover:opacity-100 p-0.5 text-[#5e5e67] hover:text-[#ba1a1a] transition-opacity">
                                  <span className="material-symbols-outlined text-[15px]">close</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {discountOpen ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">add_circle</span>
                          <span className="text-[11.5px] text-[#5e5e67]">RM</span>
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="0.01"
                            value={discountInput}
                            onChange={(e) => setDiscountInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && applyDiscount()}
                            className="w-20 h-7 px-2 rounded-md border border-[#c8c5cb]/50 text-[12px] tabular-nums focus:outline-none focus:border-[#000000]"
                            placeholder="0.00"
                          />
                          <button onClick={applyDiscount} className="text-[11.5px] font-medium text-[#1a1c1f] hover:underline">Apply</button>
                          <button onClick={() => { setDiscountOpen(false); setDiscountInput(""); }} className="text-[11.5px] text-[#5e5e67] hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-0.5">
                          <button onClick={() => { setDiscountInput(discountCents ? (discountCents / 100).toFixed(2) : ""); setDiscountOpen(true); }} className="text-[11.5px] text-[#5e5e67] hover:text-[#1a1c1f] active:scale-[0.97] flex items-center gap-1 font-medium transition-colors">
                            <span className="material-symbols-outlined text-[15px]">add_circle</span>
                            <span>{discountCents > 0 ? `Discount: ${ringgit(discountCents)}` : "Custom Discount / Tip"}</span>
                          </button>
                          <button
                            onClick={toggleVoucher}
                            disabled={!giftAvailableCents}
                            className="text-[11.5px] text-[#5e5e67] hover:text-[#1a1c1f] active:scale-[0.97] flex items-center gap-1 font-medium transition-colors disabled:opacity-30"
                            title={giftAvailableCents ? `${partyName} has ${ringgit(giftAvailableCents)} gift credit` : "Attach a client with gift credit first"}
                          >
                            <span className="material-symbols-outlined text-[15px]">redeem</span>
                            <span>{voucherAppliedCents > 0 ? `Voucher: -${ringgit(voucherAppliedCents)}` : "Voucher"}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-[#c8c5cb]/20 space-y-2">
                      <div className="flex justify-between text-[13.5px] text-[#5e5e67]">
                        <span className="text-[11.5px] uppercase tracking-wider">Items Subtotal</span>
                        <span className="tabular-nums text-[#1a1c1f] font-medium">{ringgit(subtotalCents)}</span>
                      </div>
                      <div className="pt-2.5 mt-1 border-t border-[#c8c5cb]/30 flex justify-between items-baseline">
                        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Total Payable (MYR)</span>
                        <span className="text-[24px] font-bold text-[#1a1c1f] tabular-nums tracking-tight">{ringgit(netTotalCents)}</span>
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
                      {splitOpen && (
                        <div className="p-2.5 rounded-xl bg-[#f3f3f7] border border-[#c8c5cb]/20 space-y-2">
                          <div className="flex items-center justify-between text-[11.5px]">
                            <span className="text-[#5e5e67]">On {methodLabelOf(method)}</span>
                            <span className="tabular-nums font-semibold text-[#1a1c1f]">{ringgit(splitFirstCents)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select value={splitSecondMethod} onChange={(e) => setSplitSecondMethod(e.target.value as MethodKey)} className="h-7 px-1.5 rounded-md border border-[#c8c5cb]/50 text-[11.5px] bg-white">
                              {PAYMENT_METHODS.filter((m) => m.key !== method).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                            </select>
                            <span className="text-[11.5px] text-[#5e5e67]">RM</span>
                            <input
                              type="number" min="0" step="0.01" value={splitSecondInput}
                              onChange={(e) => setSplitSecondInput(e.target.value)}
                              className="w-20 h-7 px-2 rounded-md border border-[#c8c5cb]/50 text-[12px] tabular-nums focus:outline-none focus:border-[#000000]"
                              placeholder="0.00"
                            />
                          </div>
                          {!splitValid && <p className="text-[11px] text-[#ba1a1a]">Enter an amount less than the total.</p>}
                        </div>
                      )}
                    </div>

                    {errorMsg && (
                      <div className="p-2.5 rounded-lg bg-[#fdecea] border border-[#ba1a1a]/20 text-[12px] text-[#ba1a1a]">{errorMsg}</div>
                    )}

                    <div className="pt-1 space-y-2">
                      <button
                        onClick={charge}
                        disabled={cart.length === 0 || charging || !splitValid}
                        className="w-full h-11 rounded-xl bg-[#000000] hover:bg-neutral-900 text-[#ffffff] text-[13.5px] leading-5 font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[17px]">check</span>
                        <span>{charging ? "Charging…" : `Charge ${ringgit(netTotalCents)} & Print Receipt`}</span>
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setSplitOpen((v) => !v)} className={"h-8 px-1.5 rounded-lg active:scale-[0.97] border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors " + (splitOpen ? "bg-[#000000] text-[#ffffff] border-[#000000]" : "bg-[#f3f3f7] hover:bg-[#eeedf1] border-[#c8c5cb]/20 text-[#1a1c1f]")}>
                          <span className="material-symbols-outlined text-[13px]">call_split</span>
                          <span>Split Bill</span>
                        </button>
                        <button onClick={holdTicket} disabled={cart.length === 0} className="h-8 px-1.5 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] border border-[#c8c5cb]/20 text-[#1a1c1f] text-[11px] font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-30">
                          <span className="material-symbols-outlined text-[13px]">pause</span>
                          <span>Park Folio</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  )}

                  <div className="p-4 rounded-2xl bg-[#ffffff] shadow-sm border border-[#c8c5cb]/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#c8c5cb]/20">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Parked Tickets</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#eeedf1] px-2 py-0.5 rounded text-[#5e5e67] font-medium tabular-nums">{parked.length}</span>
                    </div>
                    {parked.length === 0 ? (
                      <p className="text-[12px] text-[#77767b] py-1">None held right now. On this till only -- a shared shelf across multiple registers isn&apos;t built yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {parked.map((f) => (
                          <div key={f.id} onClick={() => resumeTicket(f.id)} className="p-2.5 rounded-xl bg-[#f3f3f7] hover:bg-[#eeedf1] border border-[#c8c5cb]/20 transition-colors flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                              <div>
                                <div className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f]">{f.label}</div>
                                <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">{f.detail}</div>
                              </div>
                            </div>
                            <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(f.lines.reduce((s, l) => s + l.priceCents * l.qty, 0))}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
