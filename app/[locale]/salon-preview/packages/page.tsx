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
import { PackagesClient, type PackageRow, type PunchHistoryEntry } from "./packages-client";

/**
 * Founder's own Stitch source for "Packages & Prepaid Balance Ledger"
 * (Task 405), now reading real service_packages instead of 6 hand-written
 * sample cards -- eighth page converted.
 *
 * ── Real, using package_balance (task 351/[319]'s real view) ────────────
 *
 * sessions_used/sessions_left/expired are computed at read time from
 * package_uses, not stored -- see the view's own comment. Guest identity
 * comes from a real join to directory_entries. Redeem is real:
 * use_package_session, with a real staff picker from the real roster.
 * Audit trail is real package_uses rows, each with a real, already-shipped
 * undo (undo_package_use) rather than a one-way "confirmed & logged" state
 * that never reverts (his source's own redeem button never went back to
 * idle either -- but that was because nothing was wired, not a deliberate
 * one-way design).
 *
 * ── Dropped, not faked ───────────────────────────────────────────────────
 *
 * The 3 category tabs (Scalp & Spa Series / Color Refresh Pass / Cash
 * Wallet Store-Value) -- service_packages has no category column, only a
 * free-text name. The "Cash Wallet Store-Value" row itself (Rachel Soo's
 * percentage-balance card) is a different real feature entirely (stored
 * credit, task 334/400's grant_credit/use_credit/credit_of) with no
 * session count and no expiry -- mixing it into a punch-card table would
 * mean inventing a session count for money that was never sold as
 * sessions. This page stays session-based packages only; stored credit
 * already has its own real display on the Clients page.
 *
 * "Prepaid Liability" is real where it can be: service_packages.entry_id
 * links to the ledger_entries payment that funded it (deliberately no
 * price lives on the package itself, see the table's own comment), so
 * liability = sum of that linked payment for every package that still has
 * sessions left, owner-only like every other money figure. "Redeemed
 * (MTD) ... RM value drawn" drops the RM figure -- there's no reliable
 * per-session price to multiply by. Station/Bay picker dropped (no real
 * room/station concept exists anywhere in this schema).
 */
export default async function SalonPackagesPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ package?: string }>;
}) {
  const { locale } = await params;
  const { package: packageParam } = await searchParams;
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

  const { data: balanceRows } = await supabase
    .from("package_balance")
    .select("package_id, party_id, name, sessions_total, sessions_used, sessions_left, sold_on, expires_on, expired, archived_at")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("expires_on", { ascending: true, nullsFirst: false });

  type BalanceRow = {
    package_id: string; party_id: string; name: string;
    sessions_total: number; sessions_used: number; sessions_left: number;
    sold_on: string; expires_on: string | null; expired: boolean;
  };
  const balances = (balanceRows ?? []) as BalanceRow[];
  const partyIds = [...new Set(balances.map((b) => b.party_id))];

  const [{ data: partyRows }, { data: staffRows }] = await Promise.all([
    partyIds.length
      ? supabase.from("directory_entries").select("id, name, phone, whatsapp").in("id", partyIds)
      : Promise.resolve({ data: [] }),
    supabase.from("directory_entries").select("id, name").eq("project_id", projectId).eq("module_key", "staff").is("archived_at", null).order("name"),
  ]);
  const partyById = new Map(((partyRows ?? []) as { id: string; name: string; phone: string; whatsapp: string }[]).map((p) => [p.id, p]));
  const staff = ((staffRows ?? []) as { id: string; name: string }[]);

  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 86400000);

  const packages: PackageRow[] = balances.map((b) => {
    const party = partyById.get(b.party_id);
    const expiring = !b.expired && !!b.expires_on && new Date(b.expires_on) <= in30Days;
    return {
      id: b.package_id,
      partyId: b.party_id,
      guest: party?.name ?? "(Unknown guest)",
      phone: party?.phone ?? "",
      whatsapp: party?.whatsapp ?? "",
      name: b.name,
      sessionsTotal: b.sessions_total,
      sessionsUsed: b.sessions_used,
      sessionsLeft: b.sessions_left,
      soldOn: b.sold_on,
      expiresOn: b.expires_on,
      status: b.sessions_left <= 0 ? "depleted" : expiring ? "expiring" : "active",
    };
  });

  const selectedId = packages.find((p) => p.id === packageParam)?.id ?? packages[0]?.id ?? null;

  let selectedDetail: { history: PunchHistoryEntry[] } | null = null;
  let liabilityCents: number | null = null;
  let redeemedThisMonth = 0;

  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const monthStart = `${month}-01`;

  const [usesRes, entryLinkRes] = await Promise.all([
    balances.length
      ? supabase
          .from("package_uses")
          .select("id, package_id, used_on, staff_id, note, created_at")
          .in("package_id", balances.map((b) => b.package_id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    workspace.isOwner && balances.length
      ? supabase.from("service_packages").select("id, entry_id").in("id", balances.map((b) => b.package_id)).not("entry_id", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  type UseRow = { id: string; package_id: string; used_on: string; staff_id: string | null; note: string; created_at: string };
  const allUses = (usesRes.data ?? []) as UseRow[];
  redeemedThisMonth = allUses.filter((u) => u.used_on >= monthStart).length;

  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  if (selectedId) {
    const mine = allUses.filter((u) => u.package_id === selectedId);
    selectedDetail = {
      history: mine.map((u) => ({
        id: u.id,
        usedOn: u.used_on,
        staffName: u.staff_id ? staffNameById.get(u.staff_id) ?? null : null,
        note: u.note,
      })),
    };
  }

  if (workspace.isOwner) {
    const links = (entryLinkRes.data ?? []) as { id: string; entry_id: string }[];
    const entryIds = links.map((l) => l.entry_id);
    if (entryIds.length) {
      const { data: entryRows } = await supabase.from("ledger_entries").select("id, amount_cents").in("id", entryIds);
      const amountByEntry = new Map(((entryRows ?? []) as { id: string; amount_cents: number }[]).map((e) => [e.id, e.amount_cents]));
      const entryByPackage = new Map(links.map((l) => [l.id, l.entry_id]));
      liabilityCents = balances
        .filter((b) => b.sessions_left > 0)
        .reduce((sum, b) => {
          const entryId = entryByPackage.get(b.package_id);
          return sum + (entryId ? Number(amountByEntry.get(entryId) ?? 0) : 0);
        }, 0);
    } else {
      liabilityCents = 0;
    }
  }

  const activeCardCount = packages.filter((p) => p.status !== "depleted").length;
  const expiringCount = packages.filter((p) => p.status === "expiring").length;
  const uniqueGuestCount = new Set(packages.filter((p) => p.status !== "depleted").map((p) => p.partyId)).size;

  return (
    <>
      <MaterialSymbolsLink />
      <PackagesClient
        key={selectedId ?? "none"}
        businessName={businessName}
        packages={packages}
        selectedId={selectedId}
        selectedHistory={selectedDetail?.history ?? []}
        staff={staff}
        canSeeMoney={workspace.isOwner}
        liabilityCents={liabilityCents}
        activeCardCount={activeCardCount}
        uniqueGuestCount={uniqueGuestCount}
        expiringCount={expiringCount}
        redeemedThisMonth={redeemedThisMonth}
      />
    </>
  );
}
