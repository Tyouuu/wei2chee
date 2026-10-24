"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { salonRowVisible, SALON_NAV, type SalonNavContext } from "@/lib/portal/salon-nav";

/**
 * The founder's own Stitch-generated shell for the salon redesign (Task 405),
 * ported literally -- same class names translated to arbitrary Tailwind
 * values, same structure, same copy. This is a SALES DEMO, not the live
 * per-customer render: it lives outside /portal (no login required) because
 * its job is to be shown cold to a prospect standing in his salon, not to be
 * a real account's actual system.
 *
 * His sources so far don't agree on this sidebar's exact styling (icon set,
 * header layout, footer treatment) -- each page export drifted a little on
 * its own. A real product needs ONE sidebar, not N near-duplicates, so this
 * follows the most recent/most detailed source as of the LAST time this file
 * changed (Clients & Profiles, 2026-09-23) rather than every page's own look.
 *
 * The Lookbook & Formulas source (also 2026-09-23, pasted later the same
 * day) drifted again on its own -- a logo icon next to the studio name, a
 * few different Material Symbol choices ("grid_view" vs "dashboard", "group"
 * vs "person", "badge" vs "content_cut" for Stylists). Not re-chased here:
 * re-litigating pixel-level icon choices every time a new page arrives is a
 * "精修" (refine) task, not a "抄源代码" (copy the source) task -- this repo
 * is still explicitly in the first phase. Only the one real, structural
 * difference (a new nav item) was added.
 *
 * The Stylist Profile source (also 2026-09-23) came with the SAME sidebar
 * as Lookbook -- "badge" for Stylists, "account_balance_wallet" for End of
 * Day Cash, "Stylists & Staff" not "Stylists & Commission". Two independent
 * sources agreeing looked like convergence, so those two icon choices were
 * adopted here at the time.
 *
 * Then the End of Day Cash source (also 2026-09-23, later the same day)
 * came with ITS OWN copy of the sidebar, and it disagreed with both of the
 * above: "groups" for Stylists (not "badge"), "calendar_today" for
 * Appointments (not "schedule"), "person_outline" for Clients (not
 * "group"), and "payments" for its own End of Day Cash row (not
 * "account_balance_wallet"). Three sources, three different answers -- this
 * confirms it was never convergence, just noise. Landed on a firmer rule
 * instead of re-guessing each time: A PAGE'S OWN SOURCE IS AUTHORITATIVE FOR
 * ITS OWN ROW ONLY. The Stylists row keeps "badge" (from the Stylist page's
 * own source). The End of Day Cash row below uses "payments" (from the End
 * of Day Cash page's own source, not the incidental copy embedded in
 * someone else's paste). Nobody chases the rest -- Invoices & Terminal and
 * System Audit Log stay whatever they were until each gets its own source.
 *
 * The Invoices & Terminal source (also 2026-09-23) reshuffled the icons yet
 * a FOURTH way -- "content_cut" for Stylists (back to the very first
 * choice), "calculate" for End of Day Cash (a third answer for that row),
 * "credit_card" for Register. Its own row ("receipt_long" for Invoices &
 * Terminal) happened to already match what was here, so nothing needed
 * changing there. Not chased further -- see the paragraph above; this is
 * the fourth independent data point for the same conclusion.
 *
 * The System Audit Log source (also 2026-09-23) came with its own icon for
 * its own row -- "manage_history" (was "verified_user") -- adopted per the
 * same rule. Its embedded sidebar copy also renamed Overview's icon to
 * "space_dashboard" and Clients & Profiles to "badge" (both yet more new
 * answers); left untouched, same reasoning as above.
 *
 * The Packages & Prepaid source (also 2026-09-23) added TWO new rows that
 * didn't exist before -- "Packages & Prepaid" (first in Management, its own
 * icon "confirmation_number" adopted for its own row) and "Tenant Settings"
 * (last in Management, no page yet -- inert, same as the others were before
 * their sources arrived). Its embedded sidebar copy once again disagreed
 * with the icons End of Day Cash / Invoices & Terminal / System Audit Log
 * picked for themselves in THEIR OWN sources; left untouched, same rule.
 *
 * The Reports & Rankings source (2026-09-24) added two more rows: "Memberships
 * & Loyalty" (no page yet -- inert like Tenant Settings until its own source
 * arrives) and "Reports & Rankings" itself (between Stylists and End of Day
 * Cash, as that source ordered them). Its embedded sidebar had no icons at
 * all, so the two icons here are this file's own picks.
 *
 * The Memberships & VIP Passes source (2026-09-24, right after) gave that
 * greyed row its page, and its own icon ("loyalty") and its own label
 * ("Memberships") are adopted for its own row under the same rule. The
 * longer "Memberships & Loyalty" (from the Reports source) wrapped onto two
 * lines in the active pill, next to the chevron. Its embedded sidebar was a
 * different one again (a "Wei OS" header, a command-jump box, renamed rows)
 * and is not followed.
 *
 * 2026-09-25 (task 419): the sidebar went from fourteen rows to twelve after
 * reading how Fresha, Vagaro, Booksy, Timely, Mangomint, Boulevard and the
 * Malaysian systems (Tunai, Ebteq, Aoikumo) lay theirs out: the "Memberships"
 * row folded into "Packages & Plans" (one place for money paid ahead,
 * two pages joined by <PrepaidTabs/>), and "System Audit Log" left the menu
 * for Tenant Settings -> Team & Access. Both pages keep their own routes.
 *
 * Every row has a real page behind it.
 */
export type SalonNavKey =
  | "overview"
  | "appointments-and-flow"
  | "register-and-checkout"
  | "clients-and-profiles"
  | "lookbook-and-formulas"
  | "packages-and-prepaid"
  | "salon-stock-and-orders"
  | "stylists-and-staff"
  | "reports-and-rankings"
  | "end-of-day-cash"
  | "invoices-and-terminal"
  | "more-tools"
  | "tenant-settings";

export const DAILY_OPS: { key: SalonNavKey; href: string; icon: string; label: string }[] = [
  { key: "overview", href: "/en/salon-preview/overview", icon: "dashboard", label: "Overview" },
  {
    key: "appointments-and-flow",
    href: "/en/salon-preview/schedule",
    icon: "schedule",
    label: "Appointments & Flow",
  },
  {
    key: "register-and-checkout",
    href: "/en/salon-preview/register",
    icon: "point_of_sale",
    label: "Register & Checkout",
  },
  {
    key: "clients-and-profiles",
    href: "/en/salon-preview/clients",
    icon: "person",
    label: "Clients & Profiles",
  },
  {
    key: "lookbook-and-formulas",
    href: "/en/salon-preview/lookbook",
    icon: "palette",
    label: "Lookbook & Formulas",
  },
];

export const MANAGEMENT: { key: SalonNavKey | null; href: string; icon: string; label: string }[] = [
  { key: "packages-and-prepaid", href: "/en/salon-preview/packages", icon: "confirmation_number", label: "Packages & Plans" },
  { key: "salon-stock-and-orders", href: "/en/salon-preview/stock", icon: "inventory_2", label: "Salon Stock & Orders" },
  { key: "stylists-and-staff", href: "/en/salon-preview/stylists", icon: "badge", label: "Stylists & Staff" },
  { key: "reports-and-rankings", href: "/en/salon-preview/reports", icon: "leaderboard", label: "Reports & Rankings" },
  { key: "end-of-day-cash", href: "/en/salon-preview/eod-cash", icon: "payments", label: "End of Day Cash" },
  { key: "invoices-and-terminal", href: "/en/salon-preview/invoices", icon: "receipt_long", label: "Invoices & Terminal" },
  // The door to what only the platform's classic layout has (consent forms, treatments, reviews...)
  // and to the platform itself. One row, so the sidebar does not grow by nine (task 421).
  { key: "more-tools", href: "/en/salon-preview/tools", icon: "apps", label: "More Tools" },
  { key: "tenant-settings", href: "/en/salon-preview/settings", icon: "tune", label: "Tenant Settings" },
];

/**
 * Who is looking, and which pages their business keeps. Filled in once by
 * salon-preview/layout.tsx (a server component that can ask the database), so
 * the sidebar draws the right rows on the first paint instead of drawing all of
 * them and then taking some away. Null = nobody known: draw everything.
 */
export type SalonViewer = SalonNavContext & { viewerName: string };
const SalonViewerContext = createContext<SalonViewer | null>(null);
export function SalonViewerProvider({ value, children }: { value: SalonViewer | null; children: React.ReactNode }) {
  return <SalonViewerContext.Provider value={value}>{children}</SalonViewerContext.Provider>;
}

/**
 * The word this business's own owner (or her assistant, via rename_project_page)
 * put on this row's page, if she ever bothered -- same read the old shell's
 * pageLabel() does, so a rename shows up here too instead of only there
 * (task 426). A `SalonNavKey` maps to a single real page_key for every row
 * that stands on exactly one page; a row backed by several (Packages & Plans)
 * or none (More Tools, Tenant Settings) has nothing of its own to rename, so
 * it keeps the fixed word.
 */
function rowLabel(viewer: SalonViewer | null, navKey: string, fallback: string): string {
  const pageKey = SALON_NAV[navKey]?.needs.length === 1 ? SALON_NAV[navKey].needs[0] : null;
  const own = pageKey ? viewer?.pageTitles?.[pageKey]?.trim() : undefined;
  return own || fallback;
}

/**
 * The two halves of the "Packages & Plans" sidebar row: a pass or prepaid
 * balance, and a monthly membership. Two pages, one place. The Memberships tab
 * collects money, so a cashier is not shown it (and a lone tab is not a strip).
 */
export function PrepaidTabs({ active }: { active: "packages" | "memberships" }) {
  const viewer = useContext(SalonViewerContext);
  const label = (key: string, fallback: string) => rowLabel(viewer, key, fallback);
  // Memberships retired from the UI (founder's call, 2026-10 simplification
  // pass): it was a page built on a plan "grouped out of clients' own names,
  // not a real table" (task413's own words) -- exactly the kind of
  // match-the-big-guys complexity the founder wants cut first. The
  // Memberships tab/page/route still exist; nothing links to them any more.
  // Packages & Prepaid stays, it's what a salon actually sells.
  const tabs = [
    { key: "packages", href: "/en/salon-preview/packages", label: label("packages", "Packages & Prepaid") },
  ];
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Packages and memberships" className="flex flex-wrap items-center gap-2 pb-5 print:hidden">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={
            "px-3.5 py-1.5 rounded-lg text-[13.5px] leading-5 font-medium transition-colors " +
            (t.key === active ? "bg-[#000000] text-[#ffffff] shadow-sm" : "text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1]")
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function MaterialSymbolsLink() {
  // Material Symbols has no next/font/google entry; App Router hoists and
  // dedupes a <link> rendered from a component across both preview pages on
  // its own, so this is not the single-page-only font this rule warns about.
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
      rel="stylesheet"
    />
  );
}

/**
 * Who is signed in, at the foot of the sidebar. It used to be the founder's own
 * demo person ("Wei Lin, Floor Lead & Director") for every login, so a
 * cashier saw a director's name. Now it is the real account: the name before
 * the @ of the email (there is no display-name field anywhere in the product to
 * read instead), and Owner or Staff from the same my_workspace() the server
 * pages use, handed down by salon-preview/layout.tsx. With nobody known the
 * avatar is a dot and the name is blank rather than the wrong person.
 */
function SidebarWho() {
  const viewer = useContext(SalonViewerContext);
  const who = viewer ? { name: viewer.viewerName, role: viewer.isOwner ? "Owner" : "Staff" } : null;
  const initials = who?.name ? who.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() : "·";
  return (
    <div data-testid="sidebar-who" className="flex items-center gap-3 p-2 rounded-lg bg-[#f3f3f7]">
      <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center shrink-0">
        <span className="text-[11.5px] leading-4 tracking-[0.04em] text-[#ffffff] font-semibold">{initials}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[13.5px] leading-5 font-semibold text-[#1a1c1f] leading-tight truncate">{who?.name ?? ""}</span>
        <span className="text-[11.5px] leading-4 tracking-[0.04em] text-[#77767b] leading-tight">{who?.role ?? ""}</span>
      </div>
    </div>
  );
}

export function SalonSidebar({
  active,
  businessName,
  subtitle,
}: {
  active: SalonNavKey;
  /** The real signed-in business's name, for a page that's been converted
   *  off sample data. Defaults to the founder's own demo name so the pages
   *  not converted yet (still pure Stitch samples) render unchanged. */
  businessName?: string;
  subtitle?: string;
}) {
  const viewer = useContext(SalonViewerContext);
  const dailyRows = DAILY_OPS.filter((r) => salonRowVisible(r.key, viewer, active));
  // Every row carries a key now (Tenant Settings has its page); null stays allowed for a row with none.
  const managementRows = MANAGEMENT.filter((r) => r.key === null || salonRowVisible(r.key, viewer, active));
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#ffffff] z-40 flex flex-col justify-between border-r border-[#c8c5cb]/30">
      <div className="flex flex-col">
        <div className="p-5 flex flex-col gap-1">
          <span className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tracking-tight uppercase">
            {businessName ?? "Wei Hair Studio"}
          </span>
          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#77767b] uppercase tracking-wider font-mono">
            {subtitle ?? "Operations OS · Bangsar"}
          </span>
        </div>
        <div className="py-4 px-3 space-y-6 overflow-y-auto">
          <div className="space-y-1">
            <div className="px-3 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase mb-2">
              Daily Operations
            </div>
            <nav className="space-y-0.5">
              {dailyRows.map((item) => {
                const label = rowLabel(viewer, item.key, item.label);
                return item.href ? (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={
                      "flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-[13.5px] leading-5 font-normal transition-colors " +
                      (item.key === active
                        ? "bg-[#000000] text-[#ffffff] font-medium shadow-sm"
                        : "text-[#47464b] hover:bg-[#eeedf1] hover:text-[#1a1c1f]")
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      <span>{label}</span>
                    </div>
                    {item.key === active && <span className="material-symbols-outlined text-[14px]">chevron_right</span>}
                  </Link>
                ) : (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 px-3 py-2 rounded text-[13.5px] leading-5 font-normal text-[#5e5e67]/50 cursor-default select-none"
                    title="Coming after Overview and Appointments are signed off"
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span>{label}</span>
                  </div>
                );
              })}
            </nav>
          </div>
          <div className="space-y-1">
            <div className="px-3 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase mb-2">
              Management
            </div>
            <nav className="space-y-0.5">
              {managementRows.map((item) => {
                const label = item.key ? rowLabel(viewer, item.key, item.label) : item.label;
                return item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={
                      "flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-[13.5px] leading-5 font-normal transition-colors " +
                      (item.key === active
                        ? "bg-[#000000] text-[#ffffff] font-medium shadow-sm"
                        : "text-[#47464b] hover:bg-[#eeedf1] hover:text-[#1a1c1f]")
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      <span>{label}</span>
                    </div>
                    {item.key === active && <span className="material-symbols-outlined text-[14px]">chevron_right</span>}
                  </Link>
                ) : (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] leading-5 font-normal text-[#5e5e67]/50 cursor-default select-none"
                    title="Not built yet"
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span>{label}</span>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
      <div className="p-3 bg-[#ffffff]">
        <SidebarWho />
      </div>
    </aside>
  );
}
