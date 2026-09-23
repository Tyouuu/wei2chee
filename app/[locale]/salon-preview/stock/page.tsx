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
import { DraftPoPanel } from "./draft-po-panel";

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
 * NOT converted this pass, left as the founder's own local-state sample
 * (disclosed in the original file, unchanged): the "Draft PO" line-item
 * stepper and "Delivery Inbound" panel on the right. A real purchase-order
 * module exists (pipeline_records with module_key "purchases",
 * receive_purchase()) and could power this -- wiring a real "create PO"
 * write flow is a separate, larger piece than a read-only data swap and
 * would need its own pass rather than being folded into this one.
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
    supabase
      .from("stock_on_hand")
      .select("item_id, name, unit, location, reorder_at, on_hand")
      .eq("project_id", projectId)
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
  }));

  const dayLabel = todayMYT();

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
                      <StockTable rows={rows} totalCount={rows.length} />
                    ) : (
                      <div className="bg-[#ffffff] rounded-xl shadow-sm border border-[#c8c5cb]/30 p-10 text-center text-[13.5px] text-[#77767b]">
                        No stock items recorded for this business yet.
                      </div>
                    )}
                  </section>

                  {/* RIGHT: Draft PO + Delivery -- unchanged sample content,
                      see this file's header and draft-po-panel.tsx's own. */}
                  <aside className="xl:col-span-4 flex flex-col gap-5">
                    <DraftPoPanel />
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
