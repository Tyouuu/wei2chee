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
import {
  MembershipsClient,
  type MembershipData,
  type MemberRow,
  type PlanCard,
} from "./memberships-client";

/**
 * Founder's own Stitch source for "Memberships & VIP Passes" (Task 413),
 * reading the real memberships and membership_payments tables instead of the
 * source's hand-written 47 subscribers -- thirteenth page converted, and the
 * one that gives the greyed "Memberships & Loyalty" sidebar row its page.
 *
 * ── Real ─────────────────────────────────────────────────────────────────
 *
 * Every number here is read from memberships (who · which plan · monthly fee
 * · started · next due · cancelled) and membership_payments (one row each
 * time a fee was actually collected). Both tables are readable only by
 * sees_money, so this is an owner page, same as End of Day Cash and Reports.
 *
 * The writes are the three functions the tables already have:
 * add_membership, collect_membership_fee (with an idempotency key, so
 * pressing "Collect" twice collects once) and set_membership_archived.
 *
 * ── Plans are derived, not stored ────────────────────────────────────────
 *
 * There is no plans table: a plan is just the name typed on each membership.
 * The three plan cards are therefore memberships grouped by plan name
 * (case-insensitive) -- how many members, the monthly fee, what has been
 * collected, who is overdue. "Most Popular" is put on the plan with the most
 * active members, but only when there are at least two plans and the top one
 * is not tied.
 *
 * ── Dropped or made honest, not faked ────────────────────────────────────
 *
 * - "Auto-Debit Collection 98.2%" and "1 retry pending": there is no payment
 *   gateway; fees are collected by hand (the migration says so). Replaced by
 *   what was really collected this month and how many members are overdue.
 * - Plan caps (24 / 30), per-plan perk lists, Edit Plan, "Auto-debited on
 *   1st": there is no capacity, no perks column, no plan row to edit.
 * - Payment method (Visa •••• 4182): the fee's ledger row records no method
 *   and there is nowhere a card number could come from. Replaced by "Last
 *   paid".
 * - Paused: only cancelled exists (archived_at).
 * - "Tokenized PCI-DSS gateway auto-sync": false. Says what is true instead.
 * - "Avg Plan Retention" becomes "Avg membership length": start date to
 *   cancel date (or today), across every membership.
 */

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await build(from, from + 999);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

type Membership = {
  id: string;
  party_id: string;
  plan_name: string;
  monthly_fee_cents: number;
  started_on: string;
  next_due_on: string;
  archived_at: string | null;
};
type Payment = { membership_id: string; amount_cents: number; paid_on: string };

const DAY_MS = 86_400_000;
const dayNum = (s: string) => Math.floor(new Date(`${s}T00:00:00Z`).getTime() / DAY_MS);

export default async function SalonMembershipsPreview({
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
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  const empty: MembershipData = {
    businessName,
    projectId,
    todayStr,
    kpi: { active: 0, newThisMonth: 0, monthlyCents: 0, collectedThisMonthCents: 0, overdue: 0, avgMonths: null },
    plans: [],
    rows: [],
    customers: [],
    planSuggestions: [],
    payments: [],
  };

  if (!workspace.isOwner) {
    return (
      <>
        <MaterialSymbolsLink />
        <MembershipsClient canSeeMoney={false} data={empty} />
      </>
    );
  }

  const [memberships, payments, customers] = await Promise.all([
    fetchAll<Membership>((from, to) =>
      supabase
        .from("memberships")
        .select("id, party_id, plan_name, monthly_fee_cents, started_on, next_due_on, archived_at")
        .eq("project_id", projectId)
        .order("next_due_on")
        .range(from, to),
    ),
    fetchAll<Payment>((from, to) =>
      supabase
        .from("membership_payments")
        .select("membership_id, amount_cents, paid_on")
        .eq("project_id", projectId)
        .order("paid_on")
        .range(from, to),
    ),
    fetchAll<{ id: string; name: string; phone: string; whatsapp: string }>((from, to) =>
      supabase
        .from("directory_entries")
        .select("id, name, phone, whatsapp")
        .eq("project_id", projectId)
        .eq("module_key", "customers")
        .is("archived_at", null)
        .order("name")
        .range(from, to),
    ),
  ]);

  const dir = new Map(customers.map((c) => [c.id, c]));
  const paidBy = new Map<string, { cents: number; last: string | null; count: number }>();
  for (const p of payments) {
    const acc = paidBy.get(p.membership_id) ?? { cents: 0, last: null, count: 0 };
    acc.cents += Number(p.amount_cents);
    acc.count += 1;
    if (!acc.last || p.paid_on > acc.last) acc.last = p.paid_on;
    paidBy.set(p.membership_id, acc);
  }

  const rows: MemberRow[] = memberships.map((m) => {
    const d = dir.get(m.party_id);
    const paid = paidBy.get(m.id);
    const archived = m.archived_at != null;
    return {
      id: m.id,
      partyId: m.party_id,
      name: d?.name ?? "Unknown client",
      phone: d?.phone || d?.whatsapp || "",
      plan: m.plan_name || "Membership",
      feeCents: Number(m.monthly_fee_cents),
      startedOn: m.started_on,
      nextDueOn: m.next_due_on,
      archived,
      overdue: !archived && m.next_due_on < todayStr,
      paidCents: paid?.cents ?? 0,
      paymentCount: paid?.count ?? 0,
      lastPaidOn: paid?.last ?? null,
    };
  });
  // Cancelled last; among the rest, whoever is due soonest (= most overdue) first.
  rows.sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      a.nextDueOn.localeCompare(b.nextDueOn) ||
      a.name.localeCompare(b.name),
  );

  const active = rows.filter((r) => !r.archived);
  const collectedThisMonthCents = payments
    .filter((p) => p.paid_on >= monthStart && p.paid_on <= todayStr)
    .reduce((s, p) => s + Number(p.amount_cents), 0);

  const monthsOf = memberships.map((m) => {
    const end = m.archived_at ? m.archived_at.slice(0, 10) : todayStr;
    return Math.max(0, dayNum(end) - dayNum(m.started_on)) / 30.4375;
  });

  // ── Plans: memberships grouped by the name typed on them ───────────────
  const groups = new Map<string, MemberRow[]>();
  const shownName = new Map<string, string>();
  for (const r of active) {
    const key = r.plan.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), r]);
    if (!shownName.has(key)) shownName.set(key, r.plan.trim());
  }
  const plans: PlanCard[] = [...groups.entries()]
    .map(([key, members]) => {
      const fees = members.map((m) => m.feeCents);
      const due = [...members].sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn))[0];
      return {
        name: shownName.get(key) ?? key,
        clients: members.length,
        minFeeCents: Math.min(...fees),
        maxFeeCents: Math.max(...fees),
        collectedCents: members.reduce((s, m) => s + m.paidCents, 0),
        overdue: members.filter((m) => m.overdue).length,
        nextDue: due ? { on: due.nextDueOn, name: due.name } : null,
        popular: false,
      };
    })
    .sort((a, b) => b.clients - a.clients || a.name.localeCompare(b.name));
  if (plans.length >= 2 && plans[0].clients > plans[1].clients) plans[0].popular = true;

  // Suggestions for the "new membership" form: every plan name ever used,
  // with the fee it was last set up at.
  const lastFee = new Map<string, { name: string; feeCents: number }>();
  for (const m of memberships) {
    lastFee.set(m.plan_name.trim().toLowerCase(), { name: m.plan_name.trim(), feeCents: Number(m.monthly_fee_cents) });
  }

  const nameOf = new Map(memberships.map((m) => [m.id, m]));
  const data: MembershipData = {
    ...empty,
    kpi: {
      active: active.length,
      newThisMonth: active.filter((r) => r.startedOn >= monthStart).length,
      monthlyCents: active.reduce((s, r) => s + r.feeCents, 0),
      collectedThisMonthCents,
      overdue: active.filter((r) => r.overdue).length,
      avgMonths: monthsOf.length > 0 ? monthsOf.reduce((s, x) => s + x, 0) / monthsOf.length : null,
    },
    plans,
    rows,
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
    planSuggestions: [...lastFee.values()].filter((p) => p.name).sort((a, b) => a.name.localeCompare(b.name)),
    payments: payments
      .map((p) => {
        const m = nameOf.get(p.membership_id);
        const d = m ? dir.get(m.party_id) : undefined;
        return { paidOn: p.paid_on, name: d?.name ?? "", plan: m?.plan_name ?? "", amountCents: Number(p.amount_cents) };
      })
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn)),
  };

  return (
    <>
      <MaterialSymbolsLink />
      <MembershipsClient canSeeMoney data={data} />
    </>
  );
}
