import Link from "next/link";

/**
 * The founder's own Stitch-generated shell for the salon redesign (Task 405),
 * ported literally -- same class names translated to arbitrary Tailwind
 * values, same structure, same copy. This is a SALES DEMO, not the live
 * per-customer render: it lives outside /portal (no login required) because
 * its job is to be shown cold to a prospect standing in his salon, not to be
 * a real account's actual system.
 *
 * His four sources so far don't agree on this sidebar's exact styling (icon
 * set, header layout, footer treatment) -- each page export drifted a little
 * on its own. A real product needs ONE sidebar, not four near-duplicates, so
 * this follows the most recent/most detailed source (Clients & Profiles,
 * 2026-09-23) and the earlier three pages inherit the update rather than
 * keeping their own slightly different look.
 *
 * Four of the five rows under Management have no page behind them yet.
 * Rather than link them to nothing (this repo's own record-table.tsx bans
 * exactly that: a button that does nothing when pressed), they render as
 * plain inert rows so the sidebar still reads complete without a single
 * fake link in it.
 */
export type SalonNavKey =
  | "overview"
  | "appointments-and-flow"
  | "register-and-checkout"
  | "clients-and-profiles"
  | "salon-stock-and-orders";

const DAILY_OPS: { key: SalonNavKey; href: string; icon: string; label: string }[] = [
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
];

const MANAGEMENT: { key: SalonNavKey | null; href: string; icon: string; label: string }[] = [
  { key: "salon-stock-and-orders", href: "/en/salon-preview/stock", icon: "inventory_2", label: "Salon Stock & Orders" },
  { key: null, href: "", icon: "content_cut", label: "Stylists & Commission" },
  { key: null, href: "", icon: "payments", label: "End of Day Cash" },
  { key: null, href: "", icon: "receipt_long", label: "Invoices & Terminal" },
  { key: null, href: "", icon: "verified_user", label: "System Audit Log" },
];

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

export function SalonSidebar({ active }: { active: SalonNavKey }) {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#ffffff] z-40 flex flex-col justify-between border-r border-[#c8c5cb]/30">
      <div className="flex flex-col">
        <div className="p-5 flex flex-col gap-1">
          <span className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f] tracking-tight uppercase">
            Wei Hair Studio
          </span>
          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#77767b] uppercase tracking-wider font-mono">
            Operations OS · Bangsar
          </span>
        </div>
        <div className="py-4 px-3 space-y-6 overflow-y-auto">
          <div className="space-y-1">
            <div className="px-3 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase mb-2">
              Daily Operations
            </div>
            <nav className="space-y-0.5">
              {DAILY_OPS.map((item) =>
                item.href ? (
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
                      <span>{item.label}</span>
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
                    <span>{item.label}</span>
                  </div>
                ),
              )}
            </nav>
          </div>
          <div className="space-y-1">
            <div className="px-3 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase mb-2">
              Management
            </div>
            <nav className="space-y-0.5">
              {MANAGEMENT.map((item) =>
                item.href ? (
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
                      <span>{item.label}</span>
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
                    <span>{item.label}</span>
                  </div>
                ),
              )}
            </nav>
          </div>
        </div>
      </div>
      <div className="p-3 bg-[#ffffff]">
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#f3f3f7]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center">
              <span className="text-[11.5px] leading-4 tracking-[0.04em] text-[#ffffff] font-semibold">WL</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13.5px] leading-5 font-semibold text-[#1a1c1f] leading-tight">Wei Lin</span>
              <span className="text-[11.5px] leading-4 tracking-[0.04em] text-[#77767b] leading-tight">
                Floor Lead &amp; Director
              </span>
            </div>
          </div>
          <span className="text-[#77767b] hover:text-[#1a1c1f] transition-colors p-1">
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
