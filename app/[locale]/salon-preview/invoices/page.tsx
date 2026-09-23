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
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";
import { InvoicesClient, type Invoice } from "./invoices-client";

/**
 * Founder's own Stitch source for "Invoice Dispatch & Tax Print Spooler"
 * (Task 405), now reading real ledger_entries instead of 6 sample
 * invoices -- third page converted in today's cutover.
 *
 * ── Real, and what's genuinely different this time ─────────────────────────
 *
 * This page's own header used to flag a real gap in the founder's own
 * source: clicking a different invoice row never updated the receipt
 * preview on the right, which always showed #INV-2024-1088 regardless.
 * That's fixed here, not because it was a "bug" to patch, but because
 * fixing it is the same act as making the data real: once each row is a
 * genuine ledger_entries record instead of a hardcoded array, the receipt
 * naturally follows whichever one is selected -- see invoices-client.tsx.
 *
 * Dropped, not faked: the itemised SST tax breakdown (SUBTOTAL / SST 6% /
 * TOTAL) and per-line service items. Neither exists in this product --
 * ledger_entries stores one amount per payment with no tax rate, and
 * e-Invoice/SST is explicitly a "build later" priority. See
 * invoices-client.tsx's header for the full reasoning, including why
 * "Pending Deposit" status was dropped along with it (a ledger_entries row
 * is by definition money that already arrived).
 */
export default async function SalonInvoicesPreview({
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

  const { data: ledgerRows } = await supabase
    .from("ledger_entries")
    .select("id, doc_no, party, party_id, amount_cents, method, entry_on, created_at, done_by, adjusts_id")
    .eq("project_id", projectId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (ledgerRows ?? []) as {
    id: string;
    doc_no: string;
    party: string;
    party_id: string | null;
    amount_cents: number;
    method: string;
    entry_on: string;
    created_at: string;
    done_by: string | null;
    adjusts_id: string | null;
  }[];

  // Refunded = a real reversal exists somewhere pointing its adjusts_id at
  // this row (the "correction is a new entry, never an edit" rule this
  // whole product follows for money).
  const { data: reversalRows } = rows.length
    ? await supabase
        .from("ledger_entries")
        .select("adjusts_id")
        .eq("project_id", projectId)
        .in("adjusts_id", rows.map((r) => r.id).filter((id): id is string => !!id))
    : { data: [] };
  const reversedIds = new Set(
    ((reversalRows ?? []) as { adjusts_id: string | null }[])
      .map((r) => r.adjusts_id)
      .filter((id): id is string => !!id),
  );

  const staffIds = [...new Set(rows.map((r) => r.done_by).filter((id): id is string => !!id))];
  const { data: staffRows } = staffIds.length
    ? await supabase.from("directory_entries").select("id, name, whatsapp").in("id", staffIds)
    : { data: [] };
  const staffById = new Map(
    ((staffRows ?? []) as { id: string; name: string; whatsapp: string | null }[]).map((s) => [s.id, s]),
  );

  const partyIds = [...new Set(rows.map((r) => r.party_id).filter((id): id is string => !!id))];
  const { data: partyRows } = partyIds.length
    ? await supabase.from("directory_entries").select("id, whatsapp").in("id", partyIds)
    : { data: [] };
  const partyById = new Map(
    ((partyRows ?? []) as { id: string; whatsapp: string | null }[]).map((p) => [p.id, p]),
  );

  const invoices: Invoice[] = rows
    .filter((r) => !r.adjusts_id) // a reversal entry itself isn't a customer-facing invoice
    .map((r) => ({
      id: r.id,
      docNo: r.doc_no,
      entryOn: r.entry_on,
      createdAt: r.created_at,
      party: r.party,
      phone: (r.party_id ? partyById.get(r.party_id)?.whatsapp : null) ?? null,
      staffName: r.done_by ? staffById.get(r.done_by)?.name ?? null : null,
      amountCents: Number(r.amount_cents),
      method: r.method,
      status: reversedIds.has(r.id) ? "refunded" : "settled",
    }));

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="invoices-and-terminal" businessName={businessName} subtitle="Operations" />
        <div className="pl-64 min-h-screen flex flex-col bg-[#f9f9fd]">
          <main className="flex-1 w-full p-8">
            <div className="flex flex-col w-full">
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
                    Invoice Dispatch &amp; Print
                  </h1>
                </div>
              </div>

              {invoices.length ? (
                <InvoicesClient invoices={invoices} businessName={businessName} />
              ) : (
                <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-10 text-center text-[13.5px] text-[#77767b]">
                  No payments recorded for this business yet.
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
