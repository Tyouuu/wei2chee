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
import { MaterialSymbolsLink } from "../salon-shell";
import { RegisterClient, type CatalogRow } from "./register-client";

/**
 * Founder's own Stitch source for "Register & Checkout" (the POS
 * terminal, Task 405) -- eleventh and last page touched in this cutover,
 * and like Lookbook, not a full data conversion.
 *
 * ── Why the checkout half stays sample content ──────────────────────────
 *
 * Task 405 flagged this page from the start as needing genuinely new
 * backend: a cart/active-folio concept, line-item building, discount and
 * tax rules, split payment, parked tickets. None of that exists anywhere
 * in this schema -- there's no "in-progress sale" entity at all, only
 * finished ledger_entries after a payment is recorded. Building that would
 * be a real checkout feature (new tables, new RPCs), not a screen wired to
 * something that already exists -- out of this pass's lane, same reasoning
 * as Lookbook. The right-hand folio panel stays clearly-labelled sample
 * content instead of quietly implying it's a real open ticket.
 *
 * ── What IS real here ────────────────────────────────────────────────────
 *
 * The catalog grid on the left is real: it now reads catalog_items (the
 * same real services/products the Stock page shows) instead of 9
 * hardcoded cards, with real names, prices, and SKUs. Category tabs are
 * dropped -- catalog_items has no category column, same constraint
 * Lookbook and Packages hit. The top status bar's "Shift Takings" and
 * "Settled" counts are real (today's ledger total and completed vs total
 * appointments, the same figures Overview and End of Day Cash already
 * compute) -- "Drawer" balance is dropped, nothing tracks a float. Every
 * button with no real destination -- the item "+" adder, Hold/Clear
 * Folio, Change Client, discount/voucher, Charge, WhatsApp/Split/Park,
 * parked folio rows -- gets the same honest not-wired alert this cutover
 * uses throughout, rather than staying completely dead.
 */
export default async function SalonRegisterPreview({
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

  const { data: itemRows } = await supabase
    .from("catalog_items")
    .select("id, name, unit, sku, price_cents")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("name")
    .limit(60);

  const catalog: CatalogRow[] = ((itemRows ?? []) as { id: string; name: string; unit: string; sku: string; price_cents: number | null }[]).map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    sku: i.sku,
    priceCents: i.price_cents,
  }));

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());

  let shiftTakingsCents: number | null = null;
  let settledCount = 0;
  let totalCount = 0;

  if (workspace.isOwner) {
    const { data: ledgerRows } = await supabase
      .from("ledger_entries")
      .select("amount_cents, adjusts_id")
      .eq("project_id", projectId)
      .eq("direction", "in")
      .eq("entry_on", todayStr);
    type L = { amount_cents: number; adjusts_id: string | null };
    const rows = (ledgerRows ?? []) as L[];
    shiftTakingsCents = rows.filter((r) => !r.adjusts_id).reduce((s, r) => s + Number(r.amount_cents), 0);
  }

  const dayStartUtc = `${todayStr}T00:00:00+08:00`;
  const dayEndUtc = `${todayStr}T23:59:59.999+08:00`;
  const { data: apptRows } = await supabase
    .from("appointments")
    .select("status")
    .eq("project_id", projectId)
    .eq("module_key", "bookings")
    .is("archived_at", null)
    .gte("starts_at", dayStartUtc)
    .lte("starts_at", dayEndUtc);
  const appts = (apptRows ?? []) as { status: string }[];
  totalCount = appts.filter((a) => a.status !== "cancelled").length;
  settledCount = appts.filter((a) => a.status === "done").length;

  return (
    <>
      <MaterialSymbolsLink />
      <RegisterClient
        businessName={businessName}
        leadName={user.email?.split("@")[0] ?? "Owner"}
        catalog={catalog}
        canSeeMoney={workspace.isOwner}
        shiftTakingsCents={shiftTakingsCents}
        settledCount={settledCount}
        totalCount={totalCount}
      />
    </>
  );
}
