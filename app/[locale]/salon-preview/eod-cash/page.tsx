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
import { EodCashClient, type SettlementRow, type PettyCashRow } from "./eod-client";

/**
 * Founder's own Stitch source for "End of Day Cash & Register
 * Reconciliation" (Task 405), now reading today's real ledger_entries
 * instead of hardcoded denomination counts and a fixed 3-gateway
 * settlement list -- tenth page converted.
 *
 * ── What's real ──────────────────────────────────────────────────────────
 *
 * "Payment Channel & EDC Settlements" is real, grouped by
 * ledger_entries.method exactly as it was typed (free text, not an enum --
 * see the table's own comment) -- so this shows whatever payment methods
 * were actually used today, not a fixed Maybank/DuitNow/Cash trio. Petty
 * Cash Payouts is real: today's direction='out' entries. Total Shift
 * Gross and Expected Cash in Drawer are real sums.
 *
 * ── Where the schema runs out, and what happens there ───────────────────
 *
 * There's no cash-vs-card distinction anywhere in this schema -- method is
 * whatever the owner typed. "Expected Cash" here matches entries whose
 * method contains "cash" (case-insensitive); anything else counts as
 * non-cash settlement. That's a best-effort read of free text, not a
 * guarantee -- disclosed in the UI rather than presented as exact.
 *
 * The denomination counter starts at zero (not the source's fabricated
 * 8/10/4/8/3/5) -- a reconciliation tool that starts from "nothing counted
 * yet" is the honest state. Float Retention is a real editable input
 * defaulting to 0, not a fixed invented RM350 -- nothing here knows this
 * business's actual float practice.
 *
 * Closing Checklist, Handover Note, and Lock Drawer stay exactly what the
 * source's own header already admitted they were: local-only, nothing
 * persisted (no shift-closing table exists, and that's genuinely new
 * functional-foundation work, out of this pass's lane) -- kept as honest
 * same-session tools rather than removed, since a real till count doesn't
 * need a database to be useful in the moment. Print Summary now really
 * calls window.print(); Export Shift PDF and Lock Drawer's "transmitted"
 * wording are softened/alerted rather than implying a save that doesn't
 * happen.
 */
export default async function SalonEodCashPreview({
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

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const dayLabel = new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur", weekday: "long", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(`${todayStr}T12:00:00+08:00`));

  let settlements: SettlementRow[] = [];
  let pettyCash: PettyCashRow[] = [];
  let totalGrossCents = 0;
  let expectedCashCents = 0;

  if (workspace.isOwner) {
    const { data: rows } = await supabase
      .from("ledger_entries")
      .select("id, direction, amount_cents, method, party, note, adjusts_id")
      .eq("project_id", projectId)
      .eq("entry_on", todayStr);

    type Row = { id: string; direction: "in" | "out"; amount_cents: number; method: string; party: string; note: string; adjusts_id: string | null };
    const all = (rows ?? []) as Row[];
    const reversedIds = new Set(all.map((r) => r.adjusts_id).filter((id): id is string => !!id));
    const inRows = all.filter((r) => r.direction === "in" && !reversedIds.has(r.id));
    const outRows = all.filter((r) => r.direction === "out" && !reversedIds.has(r.id));

    const byMethod = new Map<string, { count: number; totalCents: number }>();
    for (const r of inRows) {
      const key = (r.method || "Unspecified").trim();
      const entry = byMethod.get(key) ?? { count: 0, totalCents: 0 };
      entry.count += 1;
      entry.totalCents += Number(r.amount_cents);
      byMethod.set(key, entry);
    }
    settlements = [...byMethod].map(([method, v]) => ({
      method,
      count: v.count,
      totalCents: v.totalCents,
      isCash: /cash/i.test(method),
    }));

    pettyCash = outRows.map((r) => ({
      id: r.id,
      name: r.party || r.note || "Expense",
      note: r.note,
      amountCents: Number(r.amount_cents),
    }));

    totalGrossCents = inRows.reduce((s, r) => s + Number(r.amount_cents), 0);
    expectedCashCents = settlements.filter((s) => s.isCash).reduce((s, r) => s + r.totalCents, 0);
  }

  return (
    <>
      <MaterialSymbolsLink />
      <EodCashClient
        businessName={businessName}
        dayLabel={dayLabel}
        canSeeMoney={workspace.isOwner}
        leadName={user.email?.split("@")[0] ?? "Owner"}
        settlements={settlements}
        pettyCash={pettyCash}
        totalGrossCents={totalGrossCents}
        expectedCashCents={expectedCashCents}
      />
    </>
  );
}
