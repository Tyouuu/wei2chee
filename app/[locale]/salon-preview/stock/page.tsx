import { redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import {
  displayBusinessName,
  type BusinessContext,
} from "@/lib/templates/industry-template";
import { todayMYT } from "@/lib/portal/record-validity";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";
import { StockTable, type StockRow } from "./stock-table";
import { PurchasePanel, type LastOrder, type OpenPo, type SupplierRow } from "./purchase-panel";

/* `Date.now()` directly inside a component body trips react-hooks/purity --
 * see the same note in ../overview/page.tsx. Only ever called with a fixed
 * literal (30) here, never the live clock read inline. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);
}

/**
 * Founder's own Stitch source for "Salon Stock & Inventory" (Task 405),
 * now reading real stock_on_hand instead of the 6 sample rows he designed
 * with -- second page converted in today's cutover, after Overview.
 *
 * ── WHAT'S REAL, WHAT'S DROPPED (same discipline as Overview's header) ────
 *
 * Real: SKU, name, location, on-hand quantity (stock_on_hand, the same
 * derived view Overview's low-stock card already reads), reorder threshold,
 * cost, and a genuine 30-day "moved out" total from stock_moves.
 *
 * Dropped, not faked:
 *   - the 6 category pills (Bleach & Lighteners, Demi & Permanent Color...)
 *     -- catalog_items has no category/group column. See stock-table.tsx's
 *     own header for why inventing one would be fabricating a taxonomy.
 *   - the "Par: 10" reference number on each row -- no such field exists;
 *     `reorder_at` is shown instead, labelled as what it actually is.
 *   - "shade" tags (Ash Brown, Toner, Blonde) -- replaced with a real
 *     status tag (In Stock / Low / Deficit) derived from on_hand vs
 *     reorder_at, the same three-way split Overview's KPI card uses.
 *   - numbered page 2/3/24 buttons -- they went nowhere in the sample and
 *     this session doesn't ship buttons that do nothing.
 *
 * The right-hand column (Task 415) is now a real purchase order and real
 * deliveries: see purchase-panel.tsx. This page reads the suppliers, the
 * open purchase orders with their lines and what has already arrived, and
 * what he ordered last time (to prefill quantities and prices).
 */
export default async function SalonStockPreview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);

  const workspace = await loadWorkspace();
  if (!workspace) redirect(`/${locale}/login`);
  const projectId = workspace.projectId;

  const supabase = await createSessionSupabaseClient();

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessName = displayBusinessName(
    (context as BusinessContext | null) ?? {},
  );

  const [{ data: stockRows }, { data: itemRows }] = await Promise.all([
    // A priced service ("Precision Cut", unit "service") lives in the same
    // catalog so the Register can ring it up, but it has no shelf and no count:
    // listing it here would show "0 service" rows among the tubes and bottles.
    supabase
      .from("stock_on_hand")
      .select("item_id, name, unit, location, reorder_at, on_hand")
      .eq("project_id", projectId)
      .neq("unit", "service")
      .order("name"),
    supabase
      .from("catalog_items")
      .select("id, sku, cost_cents")
      .eq("project_id", projectId)
      .is("archived_at", null),
  ]);

  const items = (itemRows ?? []) as {
    id: string;
    sku: string | null;
    cost_cents: number | null;
  }[];
  const itemById = new Map(items.map((i) => [i.id, i]));

  const itemIds = items.map((i) => i.id);
  const since = daysAgo(30);
  const { data: moveRows } = itemIds.length
    ? await supabase
        .from("stock_moves")
        .select("item_id, qty")
        .in("item_id", itemIds)
        .eq("direction", "out")
        .gte("moved_on", since)
    : { data: [] };
  const outByItem = new Map<string, number>();
  for (const m of (moveRows ?? []) as { item_id: string; qty: number }[]) {
    outByItem.set(m.item_id, (outByItem.get(m.item_id) ?? 0) + Number(m.qty));
  }

  const rows: StockRow[] = ((stockRows ?? []) as {
    item_id: string;
    name: string;
    unit: string;
    location: string;
    reorder_at: number | null;
    on_hand: number;
  }[]).map((r) => ({
    itemId: r.item_id,
    sku: itemById.get(r.item_id)?.sku ?? null,
    name: r.name,
    location: r.location,
    unit: r.unit || "unit",
    onHand: Number(r.on_hand),
    reorderAt: r.reorder_at != null ? Number(r.reorder_at) : null,
    costCents: itemById.get(r.item_id)?.cost_cents ?? null,
    velocityOutLast30d: outByItem.get(r.item_id) ?? 0,
    onOrder: false,
  }));

  // ── purchase orders: suppliers, what is on the way, what was ordered before
  const [{ data: supplierRows }, { data: poRows }] = await Promise.all([
    supabase
      .from("directory_entries")
      .select("id, name, whatsapp")
      .eq("project_id", projectId)
      .eq("module_key", "suppliers")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("pipeline_records")
      .select("id, doc_no, party, party_id, amount_cents, stage, issued_on, created_at")
      .eq("project_id", projectId)
      .eq("module_key", "purchases")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const suppliers: SupplierRow[] = ((supplierRows ?? []) as { id: string; name: string; whatsapp: string | null }[]).map((s) => ({
    id: s.id,
    name: s.name,
    whatsapp: s.whatsapp ?? "",
  }));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const pos = (poRows ?? []) as {
    id: string;
    doc_no: string;
    party: string;
    party_id: string | null;
    amount_cents: number | null;
    stage: string;
    issued_on: string | null;
    created_at: string;
  }[];
  const poIds = pos.map((p) => p.id);
  const { data: lineRows } = poIds.length
    ? await supabase
        .from("record_lines")
        .select("id, record_id, description, qty, unit, unit_price_cents, item_id, sort_order")
        .in("record_id", poIds)
        .order("sort_order")
    : { data: [] };
  type Line = { id: string; record_id: string; description: string; qty: number | null; unit: string; unit_price_cents: number | null; item_id: string | null };
  const lines = (lineRows ?? []) as Line[];
  const lineIds = lines.map((l) => l.id);
  const { data: arrivedRows } = lineIds.length
    ? await supabase.from("stock_moves").select("line_id, qty").eq("direction", "in").in("line_id", lineIds)
    : { data: [] };
  const arrivedByLine = new Map<string, number>();
  for (const m of (arrivedRows ?? []) as { line_id: string; qty: number }[]) {
    arrivedByLine.set(m.line_id, (arrivedByLine.get(m.line_id) ?? 0) + Number(m.qty));
  }
  const linesByPo = new Map<string, Line[]>();
  for (const l of lines) {
    const list = linesByPo.get(l.record_id) ?? [];
    list.push(l);
    linesByPo.set(l.record_id, list);
  }
  // Received or Paid is done; everything else is still on the way. (Both
  // languages: the stage word follows the project's system language.)
  const DONE = new Set(["Received", "Paid", "到货了", "付清了"]);
  const openPos: OpenPo[] = pos
    .filter((p) => !DONE.has((p.stage ?? "").trim()))
    .map((p) => ({
      id: p.id,
      docNo: p.doc_no,
      supplierName: p.party || (p.party_id ? supplierById.get(p.party_id)?.name ?? "" : ""),
      whatsapp: p.party_id ? supplierById.get(p.party_id)?.whatsapp ?? "" : "",
      issuedOn: p.issued_on ?? p.created_at.slice(0, 10),
      totalCents: p.amount_cents != null ? Number(p.amount_cents) : null,
      lines: (linesByPo.get(p.id) ?? []).map((l) => ({
        id: l.id,
        description: l.description,
        unit: l.unit,
        ordered: Number(l.qty ?? 0),
        received: arrivedByLine.get(l.id) ?? 0,
      })),
    }));
  const onOrderIds = new Set<string>();
  for (const p of openPos) {
    for (const l of linesByPo.get(p.id) ?? []) {
      if (l.item_id && Number(l.qty ?? 0) - (arrivedByLine.get(l.id) ?? 0) > 0) onOrderIds.add(l.item_id);
    }
  }
  // Most recent first, so the first time an item shows up is its latest order.
  const lastByItem: Record<string, LastOrder> = {};
  for (const p of pos) {
    for (const l of linesByPo.get(p.id) ?? []) {
      if (l.item_id && !(l.item_id in lastByItem) && Number(l.qty ?? 0) > 0) {
        lastByItem[l.item_id] = { qty: Number(l.qty), priceCents: l.unit_price_cents != null ? Number(l.unit_price_cents) : null };
      }
    }
  }
  const tableRows: StockRow[] = rows.map((r) => ({ ...r, onOrder: onOrderIds.has(r.itemId) }));
  const lastSupplierId = pos.find((p) => p.party_id && supplierById.has(p.party_id))?.party_id ?? null;

  const dayLabel = todayMYT();
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="salon-stock-and-orders" businessName={businessName} subtitle="Operations" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full min-h-screen bg-[#f9f9fd]">
            <div className="flex flex-col w-full">
              <div className="px-8 py-7 flex flex-col gap-6 max-w-[1560px] mx-auto w-full">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#e8e8ec]">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#77767b]">
                      <span>OPERATIONS</span>
                      <span className="text-[#c8c5cb]">/</span>
                      <span className="text-[#1a1c1f] font-semibold">{businessName.toUpperCase()}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                        Salon Stock &amp; Inventory
                      </h1>
                    </div>
                    <p className="text-[13.5px] leading-5 text-[#77767b]">
                      {dayLabel} · {rows.length} {rows.length === 1 ? "SKU" : "SKUs"} tracked
                    </p>
                  </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  {/* LEFT: real table */}
                  <section className="xl:col-span-8 flex flex-col gap-4">
                    {rows.length ? (
                      <StockTable rows={tableRows} totalCount={tableRows.length} />
                    ) : (
                      <div className="bg-[#ffffff] rounded-xl shadow-sm border border-[#c8c5cb]/30 p-10 text-center text-[13.5px] text-[#77767b]">
                        No stock items recorded for this business yet.
                      </div>
                    )}
                  </section>

                  {/* RIGHT: a real purchase order + what is on the way */}
                  <aside className="xl:col-span-4 flex flex-col gap-5">
                    <PurchasePanel
                      businessName={businessName}
                      projectId={projectId}
                      rows={tableRows}
                      suppliers={suppliers}
                      openPos={openPos}
                      lastByItem={lastByItem}
                      lastSupplierId={lastSupplierId}
                      onOrderIds={[...onOrderIds]}
                      today={todayStr}
                    />
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
