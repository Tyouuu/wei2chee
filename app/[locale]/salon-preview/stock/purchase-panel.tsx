"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { waLink } from "@/lib/portal/wa-link";
import { sentence } from "../side-panel";
import type { StockRow } from "./stock-table";

/**
 * The right-hand column of the Stock page: a real purchase order, and the
 * deliveries that are still on the way (Task 415). It replaces the founder's
 * sample "Draft PO" / "Delivery Inbound" cards, whose lines, supplier names
 * and "94.2% par" were all invented and whose two buttons did nothing.
 *
 * ── How the field does it (Fresha's "Create stock orders", read from its
 * help centre): choose a supplier, add products with an order quantity, send
 * it to the supplier, and later "Receive stock" -- enter what actually
 * arrived, and the product quantities go up by themselves. That is the same
 * three-step shape here, on the purchase module this product already has:
 *
 *   New supplier            add_directory_entry (module "suppliers")
 *   Save / Send a PO        add_pipeline_record ("purchases") + set_record_lines
 *   Receive what arrived    receive_purchase (writes the stock movements)
 *
 * so the numbers in the table on the left move because of what is done here,
 * not because this panel has its own copy of them.
 *
 * ── What is computed instead of typed ([重点 29]) ────────────────────────
 * The draft starts with every item that is at or under its reorder level
 * (and is not already on an open order), each at the quantity he ordered it
 * last time -- or, the first time, one reorder level's worth -- and at the
 * cost he has on file. Nothing is typed unless the item has never had a
 * price; then the price box is the one thing he has to fill.
 *
 * ── Things that are deliberately different from the sample ───────────────
 * - "Save PO Draft" is "Save Purchase Order": buying has three fixed stages
 *   everywhere in this product (Ordered, Received, Paid) and there is no
 *   draft stage, so a saved order is an order.
 * - A line always carries its own unit price. set_record_lines falls back to
 *   the item's SELLING price when a line has none; on a purchase order that
 *   would silently put what he charges his clients where what the supplier
 *   charges him belongs.
 * - "Par compliance" is "above reorder level": there is no par field, only
 *   the reorder level.
 * - WhatsApp opens a message that is already written; nothing is sent by us.
 */

export type SupplierRow = { id: string; name: string; whatsapp: string };
export type ReceiveLine = { id: string; description: string; unit: string; ordered: number; received: number };
export type OpenPo = {
  id: string;
  docNo: string;
  supplierName: string;
  whatsapp: string;
  issuedOn: string;
  totalCents: number | null;
  lines: ReceiveLine[];
};
export type LastOrder = { qty: number; priceCents: number | null };

type Edit = { qty?: number; price?: string };

const LABEL = "text-[11px] uppercase tracking-wider text-[#77767b] font-medium font-mono";
const INPUT =
  "h-8 rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] px-2.5 text-[12.5px] text-[#1a1c1f] outline-none focus:border-[#000000] transition-colors placeholder:text-[#5e5e67]/70";

function ringgit(cents: number): string {
  return `RM ${(cents / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function parseMoney(text: string): number | null {
  const t = text.replace(/RM|,|\s/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400e3);
}
function ago(issuedOn: string, today: string): string {
  const d = daysBetween(issuedOn, today);
  if (d <= 0) return "Ordered today";
  if (d === 1) return "Ordered yesterday";
  return `Ordered ${d} days ago`;
}

export function PurchasePanel({
  businessName,
  projectId,
  rows,
  suppliers,
  openPos,
  lastByItem,
  lastSupplierId,
  onOrderIds,
  today,
}: {
  businessName: string;
  projectId: string;
  rows: StockRow[];
  suppliers: SupplierRow[];
  openPos: OpenPo[];
  lastByItem: Record<string, LastOrder>;
  lastSupplierId: string | null;
  onOrderIds: string[];
  today: string;
}) {
  const router = useRouter();
  const onOrder = useMemo(() => new Set(onOrderIds), [onOrderIds]);

  // ── the draft ───────────────────────────────────────────────────────────
  // The draft is DERIVED from what is low and not yet ordered, plus whatever
  // he has changed (edits), removed, or added by hand. Nothing is copied into
  // state up front, so once an order is saved and the page refreshes, the
  // items that just went on order drop out of the suggestion by themselves.
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ docNo: string; supplier: string; totalCents: number; link: string | null } | null>(null);
  const draftKey = useRef<string | null>(null);
  const created = useRef<{ id: string; docNo: string } | null>(null);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.itemId, r])), [rows]);

  const suggestedIds = useMemo(
    () =>
      rows
        .filter((r) => r.reorderAt != null && r.onHand <= r.reorderAt && !onOrder.has(r.itemId) && !removed.includes(r.itemId))
        .map((r) => r.itemId),
    [rows, onOrder, removed],
  );
  const lineIds = useMemo(() => [...suggestedIds, ...added.filter((id) => !suggestedIds.includes(id) && rowById.has(id))], [suggestedIds, added, rowById]);

  const lines = lineIds.map((id) => {
    const r = rowById.get(id)!;
    const last = lastByItem[id];
    const defaultQty = last?.qty ?? Math.max(1, Math.ceil(r.reorderAt ?? 1));
    const cost = r.costCents ?? last?.priceCents ?? null;
    const e = edits[id] ?? {};
    const priceText = e.price ?? (cost != null ? (cost / 100).toFixed(2) : "");
    const priceCents = parseMoney(priceText);
    const qty = e.qty ?? defaultQty;
    return { row: r, qty, priceText, priceCents, lineCents: priceCents != null ? Math.round(qty * priceCents) : null };
  });
  const totalCents = lines.reduce((s, l) => s + (l.lineCents ?? 0), 0);

  const supplierList = suppliers;
  // With no supplier on file yet, or the last one is gone, the "new supplier"
  // boxes are what he needs, so they are open from the start.
  const chosen = supplierId || (lastSupplierId && suppliers.some((s) => s.id === lastSupplierId) ? lastSupplierId : suppliers.length === 1 ? suppliers[0].id : "");
  const creatingSupplier = chosen === "__new" || (suppliers.length === 0 && !chosen);
  const supplier = suppliers.find((s) => s.id === chosen) ?? null;
  const whatsappRaw = creatingSupplier ? newWhatsapp : supplier?.whatsapp ?? "";
  const canWhatsapp = waLink(whatsappRaw) !== null;

  const setQty = (id: string, qty: number) => setEdits((p) => ({ ...p, [id]: { ...p[id], qty: Math.max(1, qty) } }));
  const setPrice = (id: string, price: string) => setEdits((p) => ({ ...p, [id]: { ...p[id], price } }));
  const drop = (id: string) => {
    setAdded((p) => p.filter((x) => x !== id));
    setRemoved((p) => [...p, id]);
  };

  const addable = rows.filter((r) => !lineIds.includes(r.itemId));

  const message = (docNo: string, supplierName: string) =>
    [
      `Hi ${supplierName}, purchase order ${docNo} from ${businessName}:`,
      ...lines.map((l) => `- ${l.qty} x ${l.row.name}${l.row.unit ? ` (${l.row.unit})` : ""} @ ${ringgit(l.priceCents ?? 0)}`),
      `Total ${ringgit(totalCents)}.`,
      "Please confirm availability and the delivery date. Thank you!",
    ].join("\n");

  const save = async (sendWhatsapp: boolean) => {
    if (busy) return;
    setSaved(null);
    if (lines.length === 0) return setError("Add at least one item to order.");
    const noPrice = lines.find((l) => l.priceCents == null);
    if (noPrice) return setError(`What does ${noPrice.row.name} cost per ${noPrice.row.unit || "unit"}? Enter a price.`);
    if (creatingSupplier ? !newName.trim() : !supplier) return setError("Choose who this order is for.");

    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();

    // 1. The supplier -- one already on file by that name is reused, so a
    //    second "Ah Seng" is not made by typing him twice.
    let sid = supplier?.id ?? "";
    let sname = supplier?.name ?? "";
    let swhatsapp = supplier?.whatsapp ?? "";
    if (creatingSupplier) {
      const same = suppliers.find((s) => s.name.trim().toLowerCase() === newName.trim().toLowerCase());
      if (same) {
        sid = same.id;
        sname = same.name;
        swhatsapp = same.whatsapp || newWhatsapp.trim();
      } else {
        const { data, error: e1 } = await supabase.rpc("add_directory_entry", {
          in_project_id: projectId,
          in_module_key: "suppliers",
          in_name: newName.trim(),
          in_kind: "company",
          in_whatsapp: newWhatsapp.trim(),
          in_idempotency_key: crypto.randomUUID(),
        });
        if (e1) {
          setBusy(false);
          return setError(sentence(e1.message));
        }
        sid = (data as { id: string }).id;
        sname = newName.trim();
        swhatsapp = newWhatsapp.trim();
      }
    }

    // 2. The order. One key per draft, so pressing twice makes one order; and
    //    if the lines fail below, pressing again re-sends the lines to the
    //    same order instead of opening a second empty one.
    if (!draftKey.current) draftKey.current = crypto.randomUUID();
    if (!created.current) {
      const { data, error: e2 } = await supabase.rpc("add_pipeline_record", {
        in_project_id: projectId,
        in_module_key: "purchases",
        in_party: sname,
        in_party_id: sid,
        in_idempotency_key: draftKey.current,
      });
      if (e2) {
        setBusy(false);
        return setError(sentence(e2.message));
      }
      const rec = data as { id: string; doc_no: string };
      created.current = { id: rec.id, docNo: rec.doc_no };
    }

    // 3. The lines. Every line names the item it is for and carries its own
    //    unit price (see the header: never let the selling price stand in).
    const { error: e3 } = await supabase.rpc("set_record_lines", {
      in_record_id: created.current.id,
      in_lines: lines.map((l) => ({
        description: l.row.name,
        qty: l.qty,
        unit: l.row.unit,
        unit_price_cents: l.priceCents,
        item_id: l.row.itemId,
      })),
    });
    if (e3) {
      setBusy(false);
      return setError(`${created.current.docNo} was opened but its lines were not saved. ${sentence(e3.message)} Press again to retry.`);
    }

    const docNo = created.current.docNo;
    const link = waLink(swhatsapp, message(docNo, sname));
    setSaved({ docNo, supplier: sname, totalCents, link });
    if (sendWhatsapp && link) window.open(link, "_blank", "noopener");

    // A fresh draft: what was just ordered is no longer suggested.
    created.current = null;
    draftKey.current = null;
    setEdits({});
    setRemoved([]);
    setAdded([]);
    setSupplierId(sid);
    setNewName("");
    setNewWhatsapp("");
    setBusy(false);
    router.refresh();
  };

  // ── deliveries on the way ───────────────────────────────────────────────
  const [openId, setOpenId] = useState<string | null>(null);
  const [got, setGot] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const receiveKey = useRef<string | null>(null);

  const startReceive = (po: OpenPo) => {
    if (openId === po.id) return setOpenId(null);
    setOpenId(po.id);
    setReceiveError(null);
    receiveKey.current = null;
    setGot(Object.fromEntries(po.lines.map((l) => [l.id, String(Math.max(0, l.ordered - l.received))])));
  };

  const confirmReceipt = async (po: OpenPo) => {
    if (receiving) return;
    const said = po.lines
      .map((l) => ({ line_id: l.id, qty: Number(got[l.id] ?? 0) }))
      .filter((x) => Number.isFinite(x.qty) && x.qty > 0);
    if (said.length === 0) return setReceiveError("Enter how many of something arrived.");
    if (!receiveKey.current) receiveKey.current = crypto.randomUUID();
    setReceiving(true);
    setReceiveError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: err } = await supabase.rpc("receive_purchase", {
      in_record_id: po.id,
      in_received: said,
      in_idempotency_key: receiveKey.current,
    });
    setReceiving(false);
    if (err) return setReceiveError(sentence(err.message));
    const r = ((data as { moved: number; short: number; stage: string }[]) ?? [])[0];
    setFlash(
      `${po.docNo}: ${r?.moved ?? 0} line${(r?.moved ?? 0) === 1 ? "" : "s"} added to stock${r && r.short > 0 ? ` · ${r.short} still short` : ""}.`,
    );
    setOpenId(null);
    router.refresh();
  };

  const withLevel = rows.filter((r) => r.reorderAt != null);
  const above = withLevel.filter((r) => r.onHand > (r.reorderAt ?? 0)).length;
  const pct = withLevel.length ? Math.round((above / withLevel.length) * 100) : 0;

  return (
    <>
      <div className="bg-[#ffffff] rounded-xl shadow-sm p-5 border border-[#c8c5cb]/30 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e8e8ec]">
          <div className="flex flex-col">
            <span className={LABEL}>NEW PURCHASE ORDER</span>
            <h2 className="text-[15px] font-semibold text-[#1a1c1f]">Quick Purchase Order</h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-[#e8e8ec] text-[#5e5e67] font-mono text-[11px] font-semibold">
            {lines.length} Line Item{lines.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Supplier */}
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Supplier</span>
          {suppliers.length > 0 && (
            <select aria-label="Supplier" value={creatingSupplier ? "__new" : chosen} onChange={(e) => setSupplierId(e.target.value)} className={INPUT}>
              <option value="" disabled>
                Choose a supplier…
              </option>
              {supplierList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__new">＋ New supplier…</option>
            </select>
          )}
          {creatingSupplier && (
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="New supplier name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Supplier name" className={INPUT} />
              <input aria-label="New supplier WhatsApp" type="tel" value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} placeholder="WhatsApp (optional)" className={INPUT} />
            </div>
          )}
        </div>

        {/* Lines */}
        {lines.length === 0 ? (
          <p data-testid="po-empty" className="text-[13px] text-[#77767b] py-3 text-center">
            Nothing is running low. Add an item below to order it anyway.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[#e8e8ec]">
            {lines.map((l) => (
              <div key={l.row.itemId} data-testid="po-line" className="py-3 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[#1a1c1f] font-medium text-[13px] truncate">{l.row.name}</span>
                    <span className="text-[11px] text-[#77767b] font-mono">
                      {l.row.onHand} on hand{l.row.reorderAt != null ? ` · reorder at ${l.row.reorderAt}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[13px] font-semibold text-[#1a1c1f] tabular-nums">{l.lineCents != null ? ringgit(l.lineCents) : "—"}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${l.row.name}`}
                      onClick={() => drop(l.row.itemId)}
                      className="h-6 w-6 rounded hover:bg-[#f3f3f7] text-[#77767b] hover:text-[#1a1c1f] flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center gap-1.5 bg-[#f3f3f7] px-2 h-8 rounded-lg border border-[#e8e8ec]">
                    <button
                      type="button"
                      aria-label={`Fewer ${l.row.name}`}
                      onClick={() => setQty(l.row.itemId, l.qty - 1)}
                      className="text-[#77767b] hover:text-[#1a1c1f] active:scale-[0.97] transition-transform text-[14px] w-4"
                    >
                      −
                    </button>
                    <span data-testid="po-qty" className="font-mono text-[12px] font-semibold text-[#1a1c1f] px-1 tabular-nums">
                      {l.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`More ${l.row.name}`}
                      onClick={() => setQty(l.row.itemId, l.qty + 1)}
                      className="text-[#77767b] hover:text-[#1a1c1f] active:scale-[0.97] transition-transform text-[14px] w-4"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[11.5px] text-[#77767b] font-mono">{l.row.unit || "unit"} ×</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#77767b] font-mono">RM</span>
                    <input
                      aria-label={`Price of ${l.row.name}`}
                      inputMode="decimal"
                      value={l.priceText}
                      placeholder="price"
                      onChange={(e) => {
                        setPrice(l.row.itemId, e.target.value);
                        setError(null);
                      }}
                      className={INPUT + " w-[84px] pl-7 text-right font-mono tabular-nums"}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {addable.length > 0 && (
          <select
            aria-label="Add an item"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              setRemoved((p) => p.filter((x) => x !== id));
              setAdded((p) => (p.includes(id) ? p : [...p, id]));
            }}
            className={INPUT + " text-[#47464b]"}
          >
            <option value="">＋ Add another item…</option>
            {addable.map((r) => (
              <option key={r.itemId} value={r.itemId}>
                {r.name}
                {onOrder.has(r.itemId) ? " (already on order)" : ""}
              </option>
            ))}
          </select>
        )}

        <div className="p-3.5 bg-[#f3f3f7] rounded-lg flex items-center justify-between border border-[#e8e8ec]">
          <span className="text-[11px] text-[#77767b] uppercase font-mono font-medium">Order Total</span>
          <span data-testid="po-total" className="font-mono font-bold text-[#1a1c1f] text-[17px] tabular-nums">
            {ringgit(totalCents)}
          </span>
        </div>

        {error && (
          <p role="alert" data-testid="po-error" className="text-[12.5px] text-[#ba1a1a]">
            {error}
          </p>
        )}

        {saved && (
          <div data-testid="po-saved" className="p-3 rounded-lg bg-[#f3f3f7] border border-[#e8e8ec] text-[12.5px] text-[#1a1c1f] flex flex-col gap-1">
            <span>
              <strong className="font-semibold">{saved.docNo}</strong> saved for {saved.supplier} · {ringgit(saved.totalCents)}
            </span>
            {saved.link && (
              <a href={saved.link} target="_blank" rel="noreferrer" className="font-mono text-[11.5px] font-medium text-[#000000] underline underline-offset-2">
                Open the WhatsApp message
              </a>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={busy || !canWhatsapp || lines.length === 0}
            onClick={() => save(true)}
            className="w-full h-10 bg-[#000000] text-[#ffffff] rounded-lg text-[13px] font-semibold shadow-sm hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[17px]">send</span>
            <span>{busy ? "Saving…" : "Send WhatsApp PO to Supplier"}</span>
          </button>
          {!canWhatsapp && (
            <span data-testid="po-no-whatsapp" className="text-[11.5px] text-[#77767b] text-center">
              {creatingSupplier ? "Enter the supplier's WhatsApp number to send it this way." : `${supplier ? supplier.name : "This supplier"} has no WhatsApp number on file.`}
            </span>
          )}
          <button
            type="button"
            disabled={busy || lines.length === 0}
            onClick={() => save(false)}
            className="w-full h-8 bg-[#f3f3f7] text-[#47464b] rounded-lg text-[11.5px] font-medium hover:bg-[#eeedf1] active:scale-[0.98] transition-colors flex items-center justify-center gap-1.5 border border-[#e8e8ec] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">save</span>
            <span>Save Purchase Order</span>
          </button>
        </div>
      </div>

      <div className="bg-[#ffffff] rounded-xl shadow-sm p-5 border border-[#c8c5cb]/30 flex flex-col gap-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#e8e8ec]">
          <div className="flex items-center gap-2">
            <span className={"w-2 h-2 rounded-full " + (openPos.length ? "bg-emerald-500 animate-pulse" : "bg-[#c8c5cb]")} />
            <span className="text-[11.5px] text-[#1a1c1f] uppercase tracking-wider font-semibold">Delivery Inbound</span>
          </div>
          <span className="font-mono text-[11px] text-[#77767b] font-medium">
            {openPos.length} Open Order{openPos.length === 1 ? "" : "s"}
          </span>
        </div>

        {flash && (
          <p data-testid="po-flash" className="text-[12.5px] text-[#1a1c1f] bg-[#f3f3f7] rounded-lg px-3 py-2">
            {flash}
          </p>
        )}

        {openPos.length === 0 ? (
          <p className="text-[13px] text-[#77767b] py-2 text-center">Nothing is on the way.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {openPos.map((po) => {
              const waiting = po.lines.filter((l) => l.ordered - l.received > 0);
              const link = waLink(po.whatsapp, `Hi ${po.supplierName}, checking on purchase order ${po.docNo} from ${businessName}. Do you have a delivery date for us? Thank you!`);
              return (
                <div key={po.id} data-testid="po-open" className="p-3 rounded-lg bg-[#f3f3f7] border border-[#e8e8ec] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[13px] text-[#1a1c1f] truncate">{po.supplierName || "Supplier"}</span>
                    <span className="px-2 py-0.5 rounded bg-[#e2e2e6] font-mono text-[11px] font-semibold text-[#1a1c1f] shrink-0">{ago(po.issuedOn, today)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-[#77767b]">
                    <span>
                      {po.lines.length} line{po.lines.length === 1 ? "" : "s"}
                      {po.totalCents != null ? ` · ${ringgit(po.totalCents)}` : ""}
                    </span>
                    <span className="font-mono text-[#1a1c1f] font-medium">{po.docNo}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    {waiting.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => startReceive(po)}
                        className="h-7 px-2.5 rounded-lg bg-[#000000] text-[#ffffff] text-[11.5px] font-medium hover:bg-neutral-800 active:scale-[0.97] transition-colors"
                      >
                        {openId === po.id ? "Hide" : "Receive"}
                      </button>
                    ) : (
                      <span className="text-[11.5px] text-[#77767b]">No lines on this order.</span>
                    )}
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer" className="h-7 px-2.5 rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] hover:bg-[#eeedf1] text-[11.5px] font-medium text-[#1a1c1f] flex items-center transition-colors">
                        Chase on WhatsApp
                      </a>
                    )}
                  </div>
                  {openId === po.id && (
                    <div className="flex flex-col gap-2 pt-2 mt-1 border-t border-[#e2e2e6]">
                      <span className="text-[11.5px] text-[#47464b]">How many of each arrived?</span>
                      {waiting.map((l) => (
                        <label key={l.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[#1a1c1f]">{l.description}</span>
                            <span className="block text-[11px] font-mono text-[#77767b]">
                              ordered {l.ordered}
                              {l.received > 0 ? ` · ${l.received} in already` : ""} {l.unit}
                            </span>
                          </span>
                          <input
                            type="number"
                            min={0}
                            aria-label={`Arrived ${l.description}`}
                            value={got[l.id] ?? ""}
                            onChange={(e) => {
                              setGot((p) => ({ ...p, [l.id]: e.target.value }));
                              setReceiveError(null);
                            }}
                            className={INPUT + " w-[72px] text-right font-mono tabular-nums"}
                          />
                        </label>
                      ))}
                      {receiveError && (
                        <p role="alert" data-testid="po-receive-error" className="text-[12px] text-[#ba1a1a]">
                          {receiveError}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={receiving}
                        onClick={() => confirmReceipt(po)}
                        className="h-8 rounded-lg bg-[#000000] text-[#ffffff] text-[12px] font-semibold hover:bg-neutral-800 active:scale-[0.98] transition-colors disabled:opacity-50"
                      >
                        {receiving ? "Adding to stock…" : "Confirm Receipt"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {withLevel.length > 0 && (
          <div className="pt-2 border-t border-[#e8e8ec] flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-[#77767b] uppercase text-[11px]">Above reorder level</span>
              <span data-testid="po-par" className="font-mono font-bold text-[#1a1c1f] text-[12px]">
                {above} of {withLevel.length} · {pct}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#e8e8ec] rounded-full overflow-hidden flex">
              <div className="bg-[#000000] h-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
