import Link from "next/link";

/**
 * The founder's own Stitch-generated shell for the salon redesign (Task 405),
 * ported literally -- same class names translated to arbitrary Tailwind
 * values, same structure, same copy. This is a SALES DEMO, not the live
 * per-customer render: it lives outside /portal (no login required) because
 * its job is to be shown cold to a prospect standing in his salon, not to be
 * a real account's actual system.
 *
 * Two of the eight nav rows (Register & Checkout, Clients & Formulas) and all
 * five under Management have no page behind them yet -- Task 405 flagged
 * Register & Checkout and the Floor Timeline gantt as needing new backend
 * work, and this shell was built before the other three. Rather than link
 * them to nothing (this repo's own record-table.tsx bans exactly that: a
 * button that does nothing when pressed), they render as plain inert rows so
 * the sidebar still reads complete without a single fake link in it.
 */
export type SalonNavKey =
  | "overview"
  | "appointments-and-flow"
  | "register-and-checkout"
  | "clients-and-formulas";

const DAILY_OPS: { key: SalonNavKey; href: string; icon: string; label: string }[] = [
  { key: "overview", href: "/en/salon-preview/overview", icon: "dashboard", label: "Overview" },
  {
    key: "appointments-and-flow",
    href: "/en/salon-preview/schedule",
    icon: "calendar_today",
    label: "Appointments & Flow",
  },
  {
    key: "register-and-checkout",
    href: "",
    icon: "point_of_sale",
    label: "Register & Checkout",
  },
  {
    key: "clients-and-formulas",
    href: "",
    icon: "person_search",
    label: "Clients & Formulas",
  },
];

const MANAGEMENT: { icon: string; label: string }[] = [
  { icon: "inventory_2", label: "Salon Stock & Orders" },
  { icon: "badge", label: "Stylists & Commission" },
  { icon: "payments", label: "End of Day Cash" },
  { icon: "receipt_long", label: "Invoices & Terminal" },
  { icon: "history", label: "System Audit Log" },
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
        <div className="px-5 py-4 border-b border-[#c8c5cb]/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#000000] text-[18px]">content_cut</span>
            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#000000]">
              Wei Hair Studio
            </span>
          </div>
          <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] tracking-tight mt-0.5 pl-6">
            OPERATIONS OS
          </div>
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
                      "flex items-center gap-3 px-3 py-2 rounded text-[13.5px] leading-5 font-normal transition-colors " +
                      (item.key === active
                        ? "bg-[#000000] text-[#ffffff] font-medium"
                        : "text-[#47464b] hover:bg-[#eeedf1] hover:text-[#1a1c1f]")
                    }
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span>{item.label}</span>
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
              {MANAGEMENT.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-3 py-2 rounded text-[13.5px] leading-5 font-normal text-[#5e5e67]/50 cursor-default select-none"
                  title="Not built yet"
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </nav>
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-[#c8c5cb]/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center">
            <span className="text-[11.5px] leading-4 tracking-[0.04em] text-[#ffffff] font-semibold">WL</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[13.5px] leading-5 font-semibold text-[#000000] leading-tight">Wei Lin</span>
            <span className="text-[11.5px] leading-4 tracking-[0.04em] text-[#5e5e67] leading-none">
              Floor Lead &amp; Director
            </span>
          </div>
        </div>
        <span className="p-1.5 rounded text-[#47464b] flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </span>
      </div>
    </aside>
  );
}
