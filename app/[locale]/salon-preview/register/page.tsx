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
 * terminal, Task 405) -- eleventh and last page touched in this cutover.
 *
 * ── Corrected 2026-09-24: most of this WAS wireable without new schema ──
 *
 * The first pass here called this a Lookbook-style case (no real backing,
 * so leave it sample + honest alerts). The founder pushed back -- rightly.
 * Re-reading the real database showed almost none of it actually needed a
 * new table: the "cart" a customer builds up before paying is naturally
 * client-side state, not something that needs to survive a server restart,
 * and *charging* it is exactly the same real add_ledger_entry() every
 * other page here already calls (Overview, End of Day Cash). So:
 *
 *   - Cart lines, quantities, discount            -- plain client state
 *   - Attach a real client                        -- real directory_entries
 *   - Charge                                      -- real add_ledger_entry(),
 *                                                     shows up on Overview
 *                                                     and End of Day Cash
 *                                                     immediately
 *   - Voucher                                     -- real credit_of() /
 *                                                     use_credit(), the same
 *                                                     stored-credit feature
 *                                                     Clients already reads
 *   - Split Bill                                  -- two real
 *                                                     add_ledger_entry()
 *                                                     calls, one per method
 *   - Print Receipt                               -- a real printable receipt
 *                                                     block marked
 *                                                     data-print-sheet, the
 *                                                     same convention the
 *                                                     quotation page's paper
 *                                                     already uses (see
 *                                                     document-preview.tsx
 *                                                     and globals.css'
 *                                                     @media print rule) --
 *                                                     not a bare
 *                                                     window.print() on the
 *                                                     whole POS screen,
 *                                                     which would print the
 *                                                     sidebar and catalog
 *                                                     grid along with it
 *                                                     (task 139's exact
 *                                                     "toner-eating" bug)
 *   - Hold / Park a ticket                        -- real, but sessionStorage
 *                                                     only (this browser tab,
 *                                                     not shared across a
 *                                                     second till -- a real
 *                                                     shared "parked tickets"
 *                                                     shelf would need its
 *                                                     own small table; see
 *                                                     Task 411 in the task
 *                                                     log for that spec)
 *
 * Only two things stay honestly unreal, because nothing in this system
 * backs them at all: Scan SKU (no barcode/camera integration anywhere) and
 * WhatsApp receipt (blocked on a real WhatsApp number, same as every other
 * WhatsApp button in this codebase -- Task 11). "Prepaid Pass" as a
 * settlement method records the sale like any other method but does NOT
 * deduct a package session -- that would need this screen to know which
 * cart line maps to which package, a real but separate piece of work,
 * flagged rather than faked.
 *
 * ── Who can press Charge (Task 411, settled 2026-09-24) ──────────────────
 *
 * add_ledger_entry() used to gate on `projects.account_id = auth.uid()`, so
 * only the account owner's own login could record a payment and a cashier
 * logged in as staff got a raw "not your project" from the database. The
 * founder decided staff must be able to charge, and migration 20260924020000
 * widened the one gate to works_here() -- for customer payments only.
 * Money going out (expenses, suppliers, commission) and reversing a payment
 * stay the owner's. Guard: `npm run check:ledger-staff`; the staff-at-the-till
 * path is the last section of scripts/shoot-register-cart-real.mjs. The
 * "Shift Takings" figure in the top bar stays owner-only on purpose -- letting
 * the cashier ring up a sale is not letting them read the day's money.
 */
export default async function SalonRegisterPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { locale } = await params;
  const { client: clientParam } = await searchParams;
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

  const { data: customerRows } = await supabase
    .from("directory_entries")
    .select("id, name")
    .eq("project_id", projectId)
    .eq("module_key", "customers")
    .is("archived_at", null)
    .order("name")
    .limit(300);
  const customers = ((customerRows ?? []) as { id: string; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <>
      <MaterialSymbolsLink />
      <RegisterClient
        businessName={businessName}
        leadName={user.email?.split("@")[0] ?? "Owner"}
        projectId={projectId}
        catalog={catalog}
        customers={customers}
        canSeeMoney={workspace.isOwner}
        shiftTakingsCents={shiftTakingsCents}
        settledCount={settledCount}
        totalCount={totalCount}
        initialClientId={clientParam ?? null}
      />
    </>
  );
}
