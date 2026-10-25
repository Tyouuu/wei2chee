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
import { StylistClient, type StylistProfile, type CommissionTier } from "./stylist-client";

/**
 * Founder's own Stitch source for "Edit Stylist Profile & Commission Tier"
 * (Task 405), now reading real directory_entries instead of one hardcoded
 * stylist (Jasmine Teo, #ST-003) -- seventh page converted.
 *
 * ── The gap this page had that Clients didn't ───────────────────────────
 *
 * His source's own header already flagged this as showing "one specific
 * stylist... no separate roster/list page was given." Unlike Clients (a
 * real directory list next to a dossier), there's nothing here to click
 * between. Real staff counts at a salon are small, so rather than build a
 * second full directory-list panel, a `?staff=<id>` query param picks who
 * this page shows -- a real Next.js navigation, not a client-side toggle
 * over a giant prefetched dataset the way Clients handles it.
 *
 * ── Real, using the exact RPCs the live portal's own record page uses ───
 *
 * commission_tiers (the real stepped-rate table), staff_earnings (this
 * month's real attributed revenue + computed payout), staff_shifts +
 * who_is_clocked_in (real clock-in history, task 401), record_changes
 * (real last-modified/by-whom, same as the Audit Log conversion) --
 * nothing here is invented, it's the identical read path
 * app/[locale]/portal/[pageKey]/[recordId]/page.tsx already ships for
 * pageKey === "staff".
 *
 * ── Dropped, not faked ───────────────────────────────────────────────────
 *
 * Stock avatar photo (nothing uploads real stylist photos), the 3-pill
 * Employment Type selector and specialty tag chips (no such columns exist
 * -- status and note are free text, shown as real editable fields
 * instead), Assigned Station/Floor Bay + Turnover Buffer + Lunch Rest +
 * Retail Product Commission + Dispensary Wastage rules (no backing
 * anywhere), the weekly recurring shift template (replaced with real
 * recent staff_shifts rows -- what actually happened, not an invented
 * roster), and the entire Security & Permissions card (the 6 granular
 * toggles, the 4-level access dropdown) -- there's no real link anywhere
 * in this schema between a name on the staff roster and a specific login
 * account (a stylist can be on the roster with no login at all), and
 * guessing that link by comparing name-to-email-prefix would be exactly
 * the kind of no-reliable-signal identity guess task 89's rule forbids.
 * Client Retention % and Contract Renewal / View Contract PDF (nothing
 * tracks either) are dropped too.
 *
 * Save is real: it calls update_directory_entry with whatever the owner
 * typed. Archive is real: set_directory_archived, the same "tucked away,
 * never deleted" pattern this whole product uses everywhere else.
 */
export default async function SalonStylistProfilePreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ staff?: string }>;
}) {
  const { locale } = await params;
  const { staff: staffParam } = await searchParams;
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

  const { data: rosterRows } = await supabase
    .from("directory_entries")
    .select("id, name, phone, status")
    .eq("project_id", projectId)
    .eq("module_key", "staff")
    .is("archived_at", null)
    .order("name");
  const roster = (rosterRows ?? []) as { id: string; name: string; phone: string; status: string }[];

  const selectedId = roster.find((s) => s.id === staffParam)?.id ?? roster[0]?.id ?? null;

  if (!selectedId) {
    return (
      <>
        <MaterialSymbolsLink />
        <WorkAssistantPanel pageKey="staff" pageDescription="" pages={[]} />
        <StylistClient businessName={businessName} roster={[]} selectedId={null} profile={null} canSeeMoney={workspace.isOwner} />
      </>
    );
  }

  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
  const monthStartUtc = `${month}-01T00:00:00+08:00`;

  const [
    { data: staffRow },
    { data: tierRows },
    earningsRes,
    { data: clockedInRows },
    { data: shiftRows },
    { data: lineRows },
    { data: memberRows },
    changesRes,
  ] = await Promise.all([
    supabase.from("directory_entries").select("*").eq("id", selectedId).single(),
    supabase.from("commission_tiers").select("id, from_cents, percent").eq("party_id", selectedId).order("from_cents"),
    workspace.isOwner
      ? supabase.rpc("staff_earnings", { in_project_id: projectId, in_month: month })
      : Promise.resolve({ data: [] }),
    supabase.rpc("who_is_clocked_in", { in_project_id: projectId }),
    supabase
      .from("staff_shifts")
      .select("clock_in_at, clock_out_at")
      .eq("staff_id", selectedId)
      .order("clock_in_at", { ascending: false })
      .limit(10),
    supabase
      .from("appointment_lines")
      .select("price_cents, appointment_id, appointments!inner(status, starts_at, staff_id)")
      .eq("appointments.staff_id", selectedId)
      .eq("appointments.status", "done")
      .gte("appointments.starts_at", monthStartUtc),
    supabase.rpc("list_project_members"),
    supabase
      .from("record_changes")
      .select("changed_by, created_at, field, via_ai")
      .eq("entity", "directory")
      .eq("entity_id", selectedId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  type StaffRow = {
    id: string; name: string; phone: string; whatsapp: string; email: string;
    status: string; note: string; created_at: string;
  };
  const s = staffRow as StaffRow;

  type TierRow = { id: string; from_cents: number; percent: number };
  const tiers = ((tierRows ?? []) as TierRow[]).sort((a, b) => a.from_cents - b.from_cents);

  type EarningsRow = { party_id: string; earned_cents: number; commission_cents: number; rate_from: string | null };
  const myEarnings = ((earningsRes.data ?? []) as EarningsRow[]).find((r) => r.party_id === selectedId) ?? null;

  const clockedInIds = new Set(((clockedInRows ?? []) as { staff_id: string }[]).map((c) => c.staff_id));
  const isOnFloor = clockedInIds.has(selectedId);

  type LineRow = { price_cents: number | null; appointment_id: string };
  const lines = (lineRows ?? []) as LineRow[];
  const distinctAppts = new Set(lines.map((l) => l.appointment_id));
  const guestsServed = distinctAppts.size;
  const lineTotal = lines.reduce((sum, l) => sum + (l.price_cents ?? 0), 0);
  const avgTicketCents = guestsServed > 0 ? Math.round(lineTotal / guestsServed) : 0;

  const currentTier = (() => {
    if (!tiers.length || !myEarnings) return null;
    let best: TierRow | null = null;
    for (const t of tiers) {
      if (t.from_cents <= myEarnings.earned_cents) best = t;
    }
    return best;
  })();

  const commissionTiers: CommissionTier[] = tiers.map((t, i) => ({
    id: t.id,
    fromCents: t.from_cents,
    toCents: i + 1 < tiers.length ? tiers[i + 1].from_cents - 1 : null,
    percent: t.percent,
    current: currentTier?.id === t.id,
  }));

  // ⚠️ Deliberately NOT trying to match this roster row to a project_members
  // login by name -- there's no real foreign key between "a name on the
  // staff roster" and "a login account" anywhere in this schema (a
  // stylist can be on the roster with no login at all), and guessing the
  // link by comparing name-to-email-prefix is exactly the kind of
  // no-reliable-signal name matching this product's own rules forbid
  // (task 89: never guess an identity link to save someone a click). So
  // the "role/access level" section this page's source had is dropped
  // rather than backed by an invented match.
  type MemberRow = { user_id: string; email: string | null };
  const members = (memberRows ?? []) as MemberRow[];

  type ChangeRow = { changed_by: string | null; created_at: string; field: string; via_ai: boolean };
  const lastChange = ((changesRes.data ?? []) as ChangeRow[])[0] ?? null;
  const memberNames = Object.fromEntries(
    members.filter((m) => (m.email ?? "").includes("@")).map((m) => [m.user_id, (m.email ?? "").split("@")[0]]),
  );

  const shifts = ((shiftRows ?? []) as { clock_in_at: string; clock_out_at: string | null }[]).map((sh) => ({
    clockInAt: sh.clock_in_at,
    clockOutAt: sh.clock_out_at,
  }));

  const profile: StylistProfile = {
    id: s.id,
    name: s.name,
    phone: s.phone,
    whatsapp: s.whatsapp,
    email: s.email,
    status: s.status,
    note: s.note,
    createdAt: s.created_at,
    isOnFloor,
    guestsServedThisMonth: guestsServed,
    avgTicketCents,
    earnedCentsThisMonth: workspace.isOwner ? myEarnings?.earned_cents ?? 0 : null,
    commissionCentsThisMonth: workspace.isOwner ? myEarnings?.commission_cents ?? 0 : null,
    commissionTiers,
    recentShifts: shifts,
    lastModified: lastChange
      ? { at: lastChange.created_at, by: (lastChange.changed_by && memberNames[lastChange.changed_by]) || null, viaAi: lastChange.via_ai }
      : null,
  };

  const pageDescription = describeSalonClients(
    roster.map((s) => ({ id: s.id, name: s.name, phone: s.phone, status: s.status })),
  );

  return (
    <>
      <MaterialSymbolsLink />
      <WorkAssistantPanel pageKey="staff" pageDescription={pageDescription} pages={[]} />
      {/* key={selectedId}: forces a fresh mount when the stylist picker
          navigates to a different ?staff=<id>. Without it, this stays the
          SAME component instance across the navigation (only the route's
          search param changed, not the page/layout tree), so the form's
          useState lazy initializer -- which only runs once, on first mount
          -- keeps the PREVIOUS stylist's values while the read-only right
          column (fed straight from props, not local state) correctly
          shows the new one. Caught by looking at the actual screenshot:
          the two sides of the page disagreed about whose profile was open. */}
      <StylistClient key={selectedId} businessName={businessName} roster={roster} selectedId={selectedId} profile={profile} canSeeMoney={workspace.isOwner} />
    </>
  );
}
