/**
 * Rail-nav icons — one per nav destination, 24×24 viewBox to match the
 * rail's sizing. All use `stroke="currentColor"`, so each one inherits
 * whatever text color its wrapper sets — no color of its own, token-driven
 * or otherwise, which is what lets `RailNav` recolor the active item's icon
 * for free by recoloring the `<a>` around it.
 *
 * Ported and generalized from a real client codebase's `rail-icons.tsx`.
 */
type IconProps = { className?: string }

export function IconGrid({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconUsersRail({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function IconUserPlus({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  )
}

export function IconReceipt({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 12v6M9 15h6" />
    </svg>
  )
}

export function IconList({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  )
}

export function IconTruckRail({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  )
}

export function IconChart({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19V10M12 19V5M20 19v-7" />
    </svg>
  )
}

export function IconReconcile({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function IconShoppingBag({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

// The "add to" sibling of IconShoppingBag — the bag with its handle replaced
// by a plus, the same relationship IconLayersPlus has to IconLayers and
// IconUserPlus has to IconUsersRail.
export function IconShoppingBagPlus({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" />
      <path d="M12 12v6" />
      <path d="M9 15h6" />
    </svg>
  )
}

export function IconLayers({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

// The "add to" sibling of IconLayers, the way IconUserPlus is the sibling of
// IconUsersRail. The top sheet is replaced by a plus so the pair reads as
// "the stack" and "add to the stack" rather than as two unrelated marks.
export function IconLayersPlus({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 12l10 5 4-2" />
      <path d="M18 15v6" />
      <path d="M15 18h6" />
    </svg>
  )
}

export function IconSettings({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

export function IconShield({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
    </svg>
  )
}

// A lanyard badge — the card an ID/access badge is printed on, distinct
// from a person silhouette (already used for a couple of the other rail
// destinations in most navs this ships alongside, where a third human
// shape would be the least distinguishable icon in the rail).
export function IconBadge({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* the clip it hangs from */}
      <path d="M10 2.5h4v3h-4z" />
      {/* the card */}
      <rect x="4" y="5.5" width="16" height="16" rx="2.5" />
      {/* whoever it belongs to */}
      <circle cx="12" cy="12" r="2.4" />
      <path d="M8.2 18.4a3.9 3.9 0 0 1 7.6 0" />
    </svg>
  )
}

// A tray with something dropping into it — a queue of items that arrived
// from outside and are waiting on someone. Deliberately not an envelope, so
// it reads as a queue of work rather than as a message inbox.
export function IconInbox({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* arriving */}
      <path d="M12 3v6.5" />
      <path d="M9.2 7l2.8 2.8L14.8 7" />
      {/* the tray */}
      <path d="M3 13h4.5l1.4 2.4h6.2L16.5 13H21" />
      <path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </svg>
  )
}

export function IconBell({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 9a6 6 0 1 0-12 0c0 4.2-1.2 5.6-2 6.4h16c-.8-.8-2-2.2-2-6.4" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" />
    </svg>
  )
}

export function IconLifebuoy({ className = "h-[18px] w-[18px]" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
    </svg>
  )
}

/**
 * Name → icon, for callers that can only carry a STRING rather than a node.
 *
 * WHY IT EXISTS: `RailItem.icon` is a `ReactNode`, which is the right shape
 * for a hand-written app but is unrepresentable in Puck's field data — a
 * generated system page stores its nav as plain JSON, so it can name an icon
 * and nothing more. Without this the entire rail rendered as unadorned text
 * links, which was the single loudest "this is a wireframe, not a product"
 * signal in the editor (docs/portal-editor-known-issues.md, issue 4).
 *
 * Keys are this product's own page keys plus the two footer destinations, so
 * `lib/templates/industry-template.ts` can name one directly. Unknown names
 * resolve to `null` and the item renders text-only, exactly as before.
 */
export const RAIL_ICONS: Record<string, (p: IconProps) => React.JSX.Element> = {
  dashboard: IconGrid,
  customers: IconUsersRail,
  quotations: IconReceipt,
  projects: IconLayers,
  payments: IconReconcile,
  bookings: IconBadge,
  orders: IconShoppingBag,
  inbox: IconInbox,
  settings: IconSettings,
  // The module catalogue grew past the original seven page types
  // (lib/portal/module-catalog.ts). These are aliases onto the existing set
  // rather than nine new drawings: a rail is read by shape at 16px, and nine
  // more one-off glyphs would make it harder to scan, not easier. Where two
  // modules genuinely mean the same kind of thing to the eye -- a list of
  // people, a stack of paper -- they should look the same.
  tasks: IconLayers,
  reconciliation: IconReconcile,
  commission: IconReceipt,
  expenses: IconReceipt,
  reports: IconLayers,
  ranking: IconBadge,
  suppliers: IconUsersRail,
  staff: IconUsersRail,
  inventory: IconShoppingBag,
  // Footer rows (RailUtilityItem). Named by what they ARE rather than by a
  // route key, because unlike the nav items above these are not pages.
  notifications: IconBell,
  account: IconSettings,
  support: IconLifebuoy,
}

export function railIcon(name: string | undefined, className?: string) {
  if (!name) return null
  const Icon = RAIL_ICONS[name]
  return Icon ? <Icon className={className} /> : null
}
