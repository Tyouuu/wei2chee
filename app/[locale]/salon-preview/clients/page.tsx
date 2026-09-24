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
import { ClientsClient, type ClientRow } from "./clients-client";

/**
 * Founder's own Stitch source for "Clients & Folios" (Task 405), now
 * reading real directory_entries instead of 8 hand-written sample clients
 * -- sixth page converted, and the first to fix the "hardcoded to one
 * selected example" gap flagged across this whole cutover (Clients,
 * Stylists, Packages all shared it): the right-side dossier always showed
 * Datin Nora Al-Habshee regardless of which row was clicked, because
 * nothing in the source wired a click to a selection.
 *
 * ── What's real, what's dropped ─────────────────────────────────────────
 *
 * Real: the directory itself, phone/whatsapp, status (his own free-text
 * word, shown as a tag exactly as typed rather than one of 4 invented
 * tiers), lifetime spend (ledger_entries, reversal-aware -- owner only,
 * same sees_money gate the record detail page already uses), visit count
 * and average return cycle (party_visits, task 362's real RPC), active
 * prepaid packages (package_balance view, task 351/[319] -- no price shown
 * because that view deliberately has none), and visit history (real
 * completed appointments with real appointment_lines totals).
 *
 * Dropped, not faked: "Hair Profile & Texture" / "Hospitality &amp;
 * Service" / patch-test safety cards, per-visit invoice numbers, and the
 * prepaid package's "Remaining Value: RM X" line -- nothing in the schema
 * tracks any of these (package_balance's own comment: price is
 * deliberately not on that view). A client's free-text `note` (task 377's
 * "colour formula on the customer's own note field") is shown verbatim
 * when present, replacing the invented "Latest Technical Formula" card
 * rather than trying to parse a formula out of it.
 *
 * Every remaining button that has no real backend yet (Book Next, Edit
 * Profile, Redeem Session, +Bill Product, the dossier's two "View Full ..."
 * links) gets the same honest not-wired alert this whole cutover has used
 * throughout, rather than staying a dead click. Export CSV is real: it
 * downloads the currently-filtered list client-side, since nothing more
 * than what's already fetched is needed to make that genuinely work.
 */
export default async function SalonClientsPreview({
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

  const { data: customerRows } = await supabase
    .from("directory_entries")
    .select("id, kind, name, phone, whatsapp, address, region, status, note")
    .eq("project_id", projectId)
    .eq("module_key", "customers")
    .is("archived_at", null)
    .order("name")
    .limit(300);

  type CustomerRow = {
    id: string;
    kind: "person" | "company";
    name: string;
    phone: string;
    whatsapp: string;
    address: string;
    region: string;
    status: string;
    note: string;
  };
  const customers = (customerRows ?? []) as CustomerRow[];
  const ids = customers.map((c) => c.id);

  const [visitsRes, ledgerRes, packagesRes, apptRes] = await Promise.all([
    supabase.rpc("party_visits", { in_project_id: projectId, in_party_id: null }),
    workspace.isOwner && ids.length
      ? supabase
          .from("ledger_entries")
          .select("id, party_id, direction, amount_cents, adjusts_id")
          .eq("project_id", projectId)
          .eq("direction", "in")
          .in("party_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("package_balance")
          .select("package_id, party_id, name, sessions_total, sessions_used, sessions_left, sold_on, expires_on, expired, archived_at")
          .eq("project_id", projectId)
          .in("party_id", ids)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("appointments")
          .select("id, starts_at, ends_at, party_id, service, staff_id, status")
          .eq("project_id", projectId)
          .eq("module_key", "bookings")
          .eq("status", "done")
          .in("party_id", ids)
          .order("starts_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  type VisitStat = {
    party_id: string;
    visits: number;
    last_on: string | null;
    usual_gap_days: number | null;
  };
  const visitByParty = new Map(
    ((visitsRes.data ?? []) as VisitStat[]).map((v) => [v.party_id, v]),
  );

  // Reversal-aware lifetime spend: a reversed "in" entry is excluded, same
  // technique as the Invoices conversion -- a corrected payment shouldn't
  // count twice, or once for money that was given back.
  type LedgerRow = { id: string; party_id: string; direction: "in" | "out"; amount_cents: number; adjusts_id: string | null };
  const ledgerRows = (ledgerRes.data ?? []) as LedgerRow[];
  const reversedIds = new Set(
    ledgerRows.map((r) => r.adjusts_id).filter((id): id is string => !!id),
  );
  const spendByParty = new Map<string, number>();
  for (const r of ledgerRows) {
    if (reversedIds.has(r.id)) continue;
    spendByParty.set(r.party_id, (spendByParty.get(r.party_id) ?? 0) + Number(r.amount_cents));
  }

  type PackageRow = {
    package_id: string;
    party_id: string;
    name: string;
    sessions_total: number;
    sessions_used: number;
    sessions_left: number;
    sold_on: string;
    expires_on: string | null;
    expired: boolean;
  };
  const packagesByParty = new Map<string, PackageRow[]>();
  for (const p of (packagesRes.data ?? []) as PackageRow[]) {
    const list = packagesByParty.get(p.party_id) ?? [];
    list.push(p);
    packagesByParty.set(p.party_id, list);
  }

  type ApptRow = { id: string; starts_at: string; ends_at: string; party_id: string; service: string; staff_id: string | null; status: string };
  const apptRows = (apptRes.data ?? []) as ApptRow[];
  const apptIds = apptRows.map((a) => a.id);

  const [linesRes, staffRes] = await Promise.all([
    apptIds.length
      ? supabase
          .from("appointment_lines")
          .select("appointment_id, price_cents")
          .in("appointment_id", apptIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", projectId)
      .eq("module_key", "staff"),
  ]);

  const amountByAppt = new Map<string, number>();
  for (const l of (linesRes.data ?? []) as { appointment_id: string; price_cents: number | null }[]) {
    if (l.price_cents == null) continue;
    amountByAppt.set(l.appointment_id, (amountByAppt.get(l.appointment_id) ?? 0) + Number(l.price_cents));
  }
  const staffNameById = new Map(
    ((staffRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  const visitsByParty = new Map<string, ClientRow["visitHistory"]>();
  const primaryStylistByParty = new Map<string, string>();
  const timeFmt = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const dateFmt = (iso: string) =>
    new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

  for (const a of apptRows) {
    const list = visitsByParty.get(a.party_id) ?? [];
    const staffName = a.staff_id ? staffNameById.get(a.staff_id) ?? null : null;
    list.push({
      id: a.id,
      date: dateFmt(a.starts_at),
      time: `${timeFmt(a.starts_at)} - ${timeFmt(a.ends_at)}`,
      service: a.service || "(No service noted)",
      staffName,
      amountCents: amountByAppt.get(a.id) ?? null,
    });
    visitsByParty.set(a.party_id, list);
    // Most recent staff who served her -- appointments already sorted desc,
    // so the first one seen per party is the most recent.
    if (staffName && !primaryStylistByParty.has(a.party_id)) {
      primaryStylistByParty.set(a.party_id, staffName);
    }
  }

  const initialsOf = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  const clients: ClientRow[] = customers.map((c) => {
    const v = visitByParty.get(c.id);
    const packages = (packagesByParty.get(c.id) ?? []).filter((p) => !p.expired);
    return {
      id: c.id,
      name: c.name,
      initials: initialsOf(c.name),
      kind: c.kind,
      status: c.status.trim(),
      phone: c.phone,
      whatsapp: c.whatsapp,
      address: c.address,
      region: c.region,
      note: c.note,
      visits: v?.visits ?? 0,
      lastOn: v?.last_on ?? null,
      usualGapDays: v?.usual_gap_days ?? null,
      lifetimeSpendCents: workspace.isOwner ? spendByParty.get(c.id) ?? 0 : null,
      activePackages: packages.map((p) => ({
        id: p.package_id,
        name: p.name,
        sessionsUsed: p.sessions_used,
        sessionsTotal: p.sessions_total,
        sessionsLeft: p.sessions_left,
        soldOn: p.sold_on,
        expiresOn: p.expires_on,
      })),
      visitHistory: visitsByParty.get(c.id) ?? [],
      primaryStylist: primaryStylistByParty.get(c.id) ?? null,
      searchText: `${c.name} ${c.phone} ${c.whatsapp}`.toLowerCase(),
    };
  });

  return (
    <>
      <MaterialSymbolsLink />
      {/* ?client=<id> is how Reports & Rankings' "View profile" arrow lands on
          one person. An id that isn't in this list falls back to the first
          client, same as no param. */}
      <ClientsClient
        businessName={businessName}
        clients={clients}
        canSeeMoney={workspace.isOwner}
        initialSelectedId={clients.find((c) => c.id === clientParam)?.id ?? null}
      />
    </>
  );
}
