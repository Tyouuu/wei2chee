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
import { WorkAssistantPanel } from "../work-assistant-panel";
import { describeSalonClients } from "@/lib/portal/salon-work-describe";
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
 * Every button is wired (Task 415): New Client Folio -> add_directory_entry,
 * Edit Profile -> update_directory_entry, Book Next -> add_appointment
 * (starting from her last service, usual stylist and time of day),
 * Redeem Session -> use_package_session, "Charge in Register" and "All
 * invoices" open those pages with her already selected. The "Prescribed
 * Homecare Regulars" card is gone: nothing records which product a payment
 * was for (a register sale is one amount), so it could only ever say "none",
 * which is a claim the data cannot back. In its place, "Recent Payments" --
 * her real last five payments, owner only. Export CSV downloads the
 * currently-filtered list client-side.
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
          .select("id, party_id, direction, amount_cents, adjusts_id, doc_no, method, entry_on, created_at")
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
  type LedgerRow = { id: string; party_id: string; direction: "in" | "out"; amount_cents: number; adjusts_id: string | null; doc_no: string; method: string; entry_on: string; created_at: string };
  const ledgerRows = (ledgerRes.data ?? []) as LedgerRow[];
  const reversedIds = new Set(
    ledgerRows.map((r) => r.adjusts_id).filter((id): id is string => !!id),
  );
  const spendByParty = new Map<string, number>();
  const paymentsByParty = new Map<string, LedgerRow[]>();
  for (const r of ledgerRows) {
    if (reversedIds.has(r.id)) continue;
    spendByParty.set(r.party_id, (spendByParty.get(r.party_id) ?? 0) + Number(r.amount_cents));
    // A reversal line is not a payment she made; only the real ones are listed.
    if (!r.adjusts_id) {
      const list = paymentsByParty.get(r.party_id) ?? [];
      list.push(r);
      paymentsByParty.set(r.party_id, list);
    }
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

  const [linesRes, staffRes, upcomingRes] = await Promise.all([
    apptIds.length
      ? supabase
          .from("appointment_lines")
          .select("appointment_id, price_cents")
          .in("appointment_id", apptIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("directory_entries")
      .select("id, name, archived_at")
      .eq("project_id", projectId)
      .eq("module_key", "staff"),
    ids.length
      ? supabase
          .from("appointments")
          .select("id, starts_at, ends_at, party_id, service, staff_id")
          .eq("project_id", projectId)
          .eq("module_key", "bookings")
          .eq("status", "booked")
          .is("archived_at", null)
          .gte("starts_at", new Date().toISOString())
          .in("party_id", ids)
          .order("starts_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const amountByAppt = new Map<string, number>();
  for (const l of (linesRes.data ?? []) as { appointment_id: string; price_cents: number | null }[]) {
    if (l.price_cents == null) continue;
    amountByAppt.set(l.appointment_id, (amountByAppt.get(l.appointment_id) ?? 0) + Number(l.price_cents));
  }
  const staffRows = (staffRes.data ?? []) as { id: string; name: string; archived_at: string | null }[];
  const staffNameById = new Map(staffRows.map((s) => [s.id, s.name]));
  // Only people still working here can be picked for a new booking; the name
  // map above keeps the retired ones so an old visit still says who did it.
  const staffList = staffRows.filter((s) => !s.archived_at).map((s) => ({ id: s.id, name: s.name }));

  const visitsByParty = new Map<string, ClientRow["visitHistory"]>();
  const primaryStylistByParty = new Map<string, string>();
  const primaryStylistIdByParty = new Map<string, string>();
  const lastVisitByParty = new Map<string, NonNullable<ClientRow["lastVisit"]>>();
  const nextBookingByParty = new Map<string, NonNullable<ClientRow["nextBooking"]>>();
  const weekdayFmt = (iso: string) =>
    new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
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
      if (a.staff_id) primaryStylistIdByParty.set(a.party_id, a.staff_id);
    }
    // The first row per party is her most recent completed visit: what a
    // rebooking starts from (same service, same time of day, same length).
    if (!lastVisitByParty.has(a.party_id)) {
      const minutes = Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000);
      lastVisitByParty.set(a.party_id, {
        service: a.service,
        startTime: timeFmt(a.starts_at),
        minutes: minutes >= 15 && minutes <= 480 ? minutes : 60,
      });
    }
  }
  type UpcomingRow = { id: string; starts_at: string; ends_at: string; party_id: string; service: string; staff_id: string | null };
  for (const u of (upcomingRes.data ?? []) as UpcomingRow[]) {
    // Ordered soonest first, so the first one seen per party is her next.
    if (nextBookingByParty.has(u.party_id)) continue;
    nextBookingByParty.set(u.party_id, {
      dateLabel: weekdayFmt(u.starts_at),
      timeLabel: `${timeFmt(u.starts_at)} - ${timeFmt(u.ends_at)}`,
      service: u.service,
      staffName: u.staff_id ? staffNameById.get(u.staff_id) ?? null : null,
    });
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
      primaryStylistId: primaryStylistIdByParty.get(c.id) ?? null,
      lastVisit: lastVisitByParty.get(c.id) ?? null,
      nextBooking: nextBookingByParty.get(c.id) ?? null,
      // Owner only, like the lifetime spend above: it is her money.
      recentPayments: workspace.isOwner
        ? [...(paymentsByParty.get(c.id) ?? [])]
            // The day the money came in (entry_on), not the day it was typed
            // in: a payment recorded today for last Tuesday belongs to Tuesday.
            .sort((x, y) => y.entry_on.localeCompare(x.entry_on) || y.created_at.localeCompare(x.created_at))
            .slice(0, 5)
            .map((p) => ({ id: p.id, docNo: p.doc_no, dateLabel: dateFmt(p.entry_on), method: p.method, amountCents: Number(p.amount_cents) }))
        : [],
      searchText: `${c.name} ${c.phone} ${c.whatsapp}`.toLowerCase(),
    };
  });

  // ── 给助手看的那一份：这一页真的客户，真的编号 ───────────────────────
  // 跟 Schedule 那次同一条规矩（task 432）：候选清单只服务"动已有一行"的
  // 那几支（remember / grant_credit / use_credit / add_treatment_note），
  // "开新的"（add_directory_entry 等）不需要先看到任何东西。
  const pageDescription = describeSalonClients(
    clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone, status: c.status })),
  );

  return (
    <>
      <MaterialSymbolsLink />
      <WorkAssistantPanel pageKey="customers" pageDescription={pageDescription} pages={[]} />
      {/* ?client=<id> is how Reports & Rankings' "View profile" arrow lands on
          one person. An id that isn't in this list falls back to the first
          client, same as no param. */}
      <ClientsClient
        businessName={businessName}
        clients={clients}
        canSeeMoney={workspace.isOwner}
        locale={locale}
        projectId={projectId}
        staff={staffList}
        initialSelectedId={clients.find((c) => c.id === clientParam)?.id ?? null}
      />
    </>
  );
}
