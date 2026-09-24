import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { MaterialSymbolsLink } from "../salon-shell";
import {
  SettingsClient,
  type BranchRow,
  type MemberRow,
  type SettingsValues,
} from "./settings-client";

/**
 * Founder's own Stitch source for "Store Settings & Multi-Branch Tenant"
 * (Task 415 item 3), wired to what the product really keeps.
 *
 * ── What is real, and where it comes from ───────────────────────────────
 * Brand name and owner name (update_business_identity) · the site address
 * (projects.site_slug, set_my_site_slug) and whether it is published · the
 * branches (add_branch, set_branch_active) · who works here
 * (list_project_members, add_project_member, set_member_active) · which pages
 * this business keeps (project_pages, add_project_page / remove_project_page:
 * the same set the sidebar reads, so a switch here moves a sidebar row) · the
 * no-show deposit rule (booking_rules) and the loyalty card (loyalty_rules).
 * Nothing here is new backend.
 *
 * ── What the design had and this page does not draw ─────────────────────
 * Nothing in the database answers these, and a switch that stores nothing is
 * a lie in a settings page:
 *   · "Legal entity & SST identifier" and the SST 6% switch: no field holds
 *     them and nothing computes tax yet (e-Invoice is queued, and it wants the
 *     shop's own tax number, address and SST registration designed together).
 *   · The WhatsApp automations tab and the Connected Hardware tab: no
 *     WhatsApp connection and no device is stored anywhere.
 *   · A branch's address, bay and basin counts and "lead": a branch is a name
 *     and whether it is open, on purpose.
 * The two tabs are replaced by the two things the product does have rules for:
 * who works here (the design's "Staff RBAC") and the booking and loyalty rules.
 *
 * Owner only: these are the owner's decisions, and every write below is
 * refused by the database for anyone else.
 */
export default async function SalonSettingsPreview({
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

  if (!workspace.isOwner) {
    return (
      <>
        <MaterialSymbolsLink />
        <SettingsClient owner={false} projectId={projectId} ownerEmail={user.email ?? ""} values={null} branches={[]} members={[]} siteBase="" />
      </>
    );
  }

  const [ctxRes, projectRes, pagesRes, branchRes, memberRes, bookingRes, loyaltyRes] = await Promise.all([
    supabase.rpc("get_my_business_context"),
    supabase.from("projects").select("site_slug, site_published").eq("id", projectId).maybeSingle(),
    supabase.from("project_pages").select("page_key").eq("project_id", projectId),
    supabase.from("branches").select("id, name, active, created_at").eq("project_id", projectId).order("sort_order").order("created_at"),
    supabase.rpc("list_project_members"),
    supabase.from("booking_rules").select("no_show_deposit_after, default_deposit_cents").eq("project_id", projectId).maybeSingle(),
    supabase.from("loyalty_rules").select("stamps_needed").eq("project_id", projectId).maybeSingle(),
  ]);

  const identity = ((ctxRes.data as { identity?: { business_name?: string | null; owner_name?: string | null } } | null)?.identity) ?? {};
  const project = (projectRes.data ?? {}) as { site_slug?: string | null; site_published?: boolean };
  const pageKeys = ((pagesRes.data ?? []) as { page_key: string }[]).map((p) => p.page_key);
  const booking = (bookingRes.data ?? null) as { no_show_deposit_after: number | null; default_deposit_cents: number | null } | null;
  const loyalty = (loyaltyRes.data ?? null) as { stamps_needed: number | null } | null;

  const values: SettingsValues = {
    businessName: identity.business_name ?? "",
    ownerName: identity.owner_name ?? "",
    siteSlug: project.site_slug ?? "",
    sitePublished: !!project.site_published,
    keepsBookings: pageKeys.includes("bookings"),
    keepsStock: pageKeys.includes("inventory"),
    keepsStaff: pageKeys.includes("staff"),
    noShowAfter: booking?.no_show_deposit_after == null ? "" : String(booking.no_show_deposit_after),
    depositRm: booking?.default_deposit_cents == null ? "" : String(booking.default_deposit_cents / 100),
    stampsNeeded: loyalty?.stamps_needed == null ? "" : String(loyalty.stamps_needed),
  };

  const openedFmt = new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" });
  const branches: BranchRow[] = ((branchRes.data ?? []) as { id: string; name: string; active: boolean; created_at: string }[]).map((b) => ({
    id: b.id,
    name: b.name,
    active: b.active,
    openedLabel: openedFmt.format(new Date(b.created_at)),
  }));

  const members: MemberRow[] = ((memberRes.data ?? []) as { user_id: string; email: string; role: string; active: boolean; created_at: string }[]).map((m) => ({
    userId: m.user_id,
    email: m.email,
    role: m.role,
    active: m.active,
    addedLabel: openedFmt.format(new Date(m.created_at)),
  }));

  // The public address of the site is <this host>/s/<slug>; shown as the prefix
  // of the address field so he sees what he is naming.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const siteBase = host ? `${proto}://${host}/s/` : "/s/";

  return (
    <>
      <MaterialSymbolsLink />
      <SettingsClient
        owner
        projectId={projectId}
        ownerEmail={user.email ?? ""}
        values={values}
        branches={branches}
        members={members}
        siteBase={siteBase}
      />
    </>
  );
}
