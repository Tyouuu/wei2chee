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
import { EodCashClient, type ClosingRecord, type SettlementRow, type PettyCashRow } from "./eod-client";

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
 * Lock the Day is real now (Task 415 item 2, 20260925010000): it freezes
 * what was on screen (the expected cash he compared against, the count, the
 * float, the checklist, the handover note) into day_closings, one live row
 * per day. A wrong count is reopened, never overwritten. Load the day and
 * the saved record is what you see; the note he leaves is what the morning
 * lead reads. Print Summary calls window.print(); Export CSV downloads.
 */
type ClosingRow = {
  id: string;
  closing_date: string;
  counts: Record<string, number>;
  counted_cents: number;
  float_cents: number;
  expected_cash_cents: number;
  gross_cents: number;
  outflows_cents: number;
  settlements: SettlementRow[];
  checklist: { label: string; done: boolean }[];
  note: string;
  variance_cents: number;
  net_deposit_cents: number;
  locked_at: string;
  locked_by_name: string;
  voided_at: string | null;
  void_reason: string;
};

const CLOSING_COLUMNS =
  "id, closing_date, counts, counted_cents, float_cents, expected_cash_cents, gross_cents, outflows_cents, settlements, checklist, note, variance_cents, net_deposit_cents, locked_at, locked_by_name, voided_at, void_reason";

// Formatted here, on the server, in Kuala Lumpur time: a client component
// formatting a timestamp would print the browser's zone and can differ from
// the server's render (hydration warning).
const dayFmt = new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", weekday: "short", day: "2-digit", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false });

function toClosing(r: ClosingRow): ClosingRecord {
  const counts: ClosingRecord["counts"] = {};
  for (const [note, qty] of Object.entries(r.counts ?? {})) {
    if (["100", "50", "20", "10", "5", "1"].includes(note)) counts[`c${note}` as keyof ClosingRecord["counts"]] = Number(qty);
  }
  return {
    id: r.id,
    dateLabel: dayFmt.format(new Date(`${r.closing_date}T12:00:00+08:00`)),
    lockedAtLabel: timeFmt.format(new Date(r.locked_at)),
    lockedByName: r.locked_by_name || "someone",
    counts,
    countedCents: Number(r.counted_cents),
    floatCents: Number(r.float_cents),
    expectedCashCents: Number(r.expected_cash_cents),
    grossCents: Number(r.gross_cents),
    outflowsCents: Number(r.outflows_cents),
    settlements: Array.isArray(r.settlements) ? r.settlements : [],
    checklist: Array.isArray(r.checklist) ? r.checklist : [],
    note: r.note ?? "",
    varianceCents: Number(r.variance_cents),
    netDepositCents: Number(r.net_deposit_cents),
  };
}

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
  let closing: ClosingRecord | null = null;
  let prefill: ClosingRecord | null = null;
  let history: ClosingRecord[] = [];

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

    // The saved closings (RLS: money-seers only, and this branch is the owner's).
    // Newest day first; a reopened one stays in the table, marked, and is used
    // only to pre-fill the count so a correction starts from what he entered.
    const { data: closingRows } = await supabase
      .from("day_closings")
      .select(CLOSING_COLUMNS)
      .eq("project_id", projectId)
      .order("closing_date", { ascending: false })
      .order("locked_at", { ascending: false })
      .limit(60);
    const saved = (closingRows ?? []) as ClosingRow[];
    const live = saved.filter((r) => !r.voided_at);
    const todayLive = live.find((r) => r.closing_date === todayStr);
    closing = todayLive ? toClosing(todayLive) : null;
    const reopened = saved
      .filter((r) => r.closing_date === todayStr && r.voided_at)
      .sort((a, b) => (b.voided_at ?? "").localeCompare(a.voided_at ?? ""))[0];
    prefill = !closing && reopened ? toClosing(reopened) : null;
    history = live.filter((r) => r.closing_date !== todayStr).slice(0, 8).map(toClosing);
  }

  return (
    <>
      <MaterialSymbolsLink />
      {/* Keyed by which saved record is showing: locking or reopening remounts
          the client, so its inputs start from the record, not from what was typed. */}
      <EodCashClient
        key={closing?.id ?? (prefill ? `re-${prefill.id}` : "open")}
        projectId={projectId}
        todayStr={todayStr}
        closing={closing}
        prefill={prefill}
        history={history}
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
