"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronDown, Bell } from "lucide-react"
import { IconSettings } from "./rail-icons"

export type RailItem = {
  href: string
  label: string
  group: string
  /** Rendered before the label — supply one of `rail-icons.tsx`'s icons, or any other node. */
  icon?: ReactNode
  badge?: number
}

type Panel = "profile" | null

// localStorage-backed store for which nav groups are folded, read through
// useSyncExternalStore. Module scope so the snapshot functions keep a
// stable identity across renders — passing fresh closures on every render
// would resubscribe every time. The `storage` event covers other tabs; the
// custom event covers this one, which `storage` deliberately doesn't fire
// for.
const COLLAPSED_KEY = "design-system-rail-collapsed-groups"
const COLLAPSED_EVENT = "design-system-rail-collapsed-change"

function subscribeToCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function getCollapsedSnapshot(): string {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) ?? ""
  } catch {
    return ""
  }
}

// Nothing folded on the server, so the first paint matches a fresh visitor.
function getCollapsedServerSnapshot(): string {
  return ""
}

/**
 * The primary desktop navigation: a fixed-width sidebar, nav items grouped
 * under fold-able labels, and a footer holding notifications, an account
 * link, and the current user's identity.
 *
 * Groups can fold — measured against a real 720px-tall laptop viewport,
 * a rail with more than about a dozen destinations puts several of them
 * below the fold, permanently requiring a scroll to reach. Folding a group
 * you aren't working in today gets that space back without removing
 * anything. The group holding the current page never folds, so navigating
 * inside a folded group never hides the very item you just landed on.
 *
 * `useSyncExternalStore` rather than reading localStorage into state inside
 * an effect: localStorage doesn't exist on the server, so a lazy
 * initializer would render a different tree on each side and trip
 * hydration, and setting state from an effect just to sync in an external
 * value is exactly the pattern React's own set-state-in-effect guidance
 * warns against. This is the shape the API exists for — a server snapshot,
 * a client snapshot, and a subscription.
 *
 * Ported and generalized from a real client codebase's `rail-nav.tsx`. Two
 * pieces of that source were app-specific business logic rather than
 * generic navigation and are dropped here: a credit-balance banner tied to
 * one particular billing model (replaced by a generic `topSlot`), and a
 * "preview as another role" switcher hardcoding that app's three literal
 * role names (replaced by a generic `profileMenu` slot — any app-specific
 * control, role-switching or otherwise, can be rendered there instead). The
 * real source also looked up each item's icon from an internal map keyed by
 * that app's own route paths; here each `RailItem` carries its own `icon`
 * instead, so this file has no baked-in knowledge of any app's routes.
 */
export function RailNav({
  brand,
  items,
  notificationsHref,
  hasUnread,
  accountHref,
  accountLabel = "账号设置",
  user,
  profileMenu,
  topSlot,
}: {
  brand: { href: string; label: string; icon?: ReactNode }
  items: RailItem[]
  notificationsHref: string
  hasUnread?: boolean
  accountHref: string
  accountLabel?: string
  user: { name: string; roleLabel?: string }
  /** Dropdown content shown when the profile row is clicked — e.g. a role switcher, a sign-out link. Omit to render the profile row as a static, non-interactive summary. */
  profileMenu?: ReactNode
  /** Rendered under the brand mark — a place for one glanceable, app-specific summary (a plan tier, a balance, a status). Omit if there's nothing that belongs there. */
  topSlot?: ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState<Panel>(null)

  const collapsedRaw = useSyncExternalStore(subscribeToCollapsed, getCollapsedSnapshot, getCollapsedServerSnapshot)
  const collapsed = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(collapsedRaw || "[]")
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [collapsedRaw])

  function toggleGroup(group: string) {
    const next = collapsed.includes(group) ? collapsed.filter((g) => g !== group) : [...collapsed, group]
    try {
      window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next))
    } catch {
      // A blocked or full localStorage must not take the navigation with
      // it. Without the write the store never changes and the group stays
      // as it was, which is the right failure: nothing is hidden.
    }
    window.dispatchEvent(new Event(COLLAPSED_EVENT))
  }

  const wrapRef = useRef<HTMLDivElement>(null)
  const profileTriggerRef = useRef<HTMLButtonElement>(null)

  // Close whatever panel is open on navigation — clicking a nav link is a
  // click "inside" the rail (the outside-click handler below only closes on
  // clicks outside the whole aside), and a layout component like this one
  // persists across route changes rather than remounting.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(null)
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  function closeProfilePanel() {
    setOpen(null)
    profileTriggerRef.current?.focus()
  }

  const groups = new Map<string, RailItem[]>()
  for (const item of items) {
    const list = groups.get(item.group) ?? []
    list.push(item)
    groups.set(item.group, list)
  }

  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

  return (
    // aria-label because a page can hold more than one <aside> (a detail
    // page might put its own summary column in one), and two unlabelled
    // complementary landmarks are indistinguishable to a screen reader.
    // Naming this one names the one that appears on every page, so a page
    // only ever has to label its own.
    <aside
      className="flex h-screen w-[220px] shrink-0 flex-col border-r [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
      aria-label="侧边导航"
      ref={wrapRef}
    >
      <Link href={brand.href} className="flex items-center [gap:var(--gap-inline)] px-1.5 pb-3 pt-1.5">
        {brand.icon}
        <span className="overflow-hidden whitespace-nowrap text-base tracking-tight text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
          {brand.label}
        </span>
      </Link>

      {topSlot}

      {/* flex-1 + overflow-y-auto: the aside itself is a fixed h-screen
          column with no scroll of its own, so once the nav groups plus the
          footer below together outgrow the viewport, whatever didn't fit
          would simply be cut off past the bottom edge with no way to reach
          it. This section scrolls on its own when it needs to, while the
          footer (notifications, account, profile) stays pinned and always
          reachable. */}
      <div className="flex-1 overflow-y-auto">
        {[...groups.entries()].map(([group, groupItems]) => {
          // A group of one is not worth a disclosure — the chevron would be
          // the only thing it hides.
          const collapsible = groupItems.length > 1
          // The group holding the current page never collapses.
          const holdsCurrent = groupItems.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
          const openGroup = !collapsible || holdsCurrent || !collapsed.includes(group)
          return (
            <div key={group}>
              {collapsible ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-micro)] uppercase tracking-[0.07em] text-[color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)] hover:text-[color:var(--color-paper)]"
                  aria-expanded={openGroup}
                  aria-controls={`rail-group-${group}`}
                  onClick={() => toggleGroup(group)}
                  title={holdsCurrent ? `${group} — holds the page you're on` : undefined}
                >
                  <span>{group}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 shrink-0 transition-transform [transition-duration:var(--dur-fast)] ${openGroup ? "" : "-rotate-90"}`}
                  />
                </button>
              ) : (
                <div className="[padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-micro)] uppercase tracking-[0.07em] text-[color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
                  {group}
                </div>
              )}
              <div id={`rail-group-${group}`} hidden={!openGroup}>
                {groupItems.map((item) => {
                  // Longest match wins. A prefix test alone would light up
                  // both a parent item and a child item on the child's own
                  // path, since one href is a prefix of the other — the
                  // rule is "this item is active only if no other item
                  // matches this path more specifically."
                  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
                  const active = matches(item.href) && !items.some((o) => o.href !== item.href && o.href.startsWith(item.href) && matches(o.href))
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center [gap:var(--gap-inline)] [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] transition-colors [transition-duration:var(--dur-fast)] ${
                        active
                          ? "text-[color:var(--color-paper)] [background-color:var(--color-ink-850)] [font-weight:var(--fw-semibold)]"
                          : "text-[color:var(--color-paper-dim)] [font-weight:var(--fw-medium)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
                      }`}
                    >
                      {item.icon}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 [font-size:var(--text-micro)] [background-color:var(--color-clay-bright)] [color:var(--color-on-dark)] [font-weight:var(--fw-semibold)]">
                          {item.badge}
                        </span>
                      )}
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="shrink-0 border-t pt-2 [border-color:var(--color-ink-800)]">
        <Link
          href={notificationsHref}
          className={`flex items-center [gap:var(--gap-inline)] [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] transition-colors [transition-duration:var(--dur-fast)] ${
            pathname === notificationsHref
              ? "text-[color:var(--color-paper)] [background-color:var(--color-ink-850)] [font-weight:var(--fw-semibold)]"
              : "text-[color:var(--color-paper-dim)] [font-weight:var(--fw-medium)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
          }`}
        >
          <span className="relative">
            <Bell aria-hidden="true" className="h-[18px] w-[18px]" />
            {hasUnread && (
              <span className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full border-[1.5px] [border-color:var(--color-ink-900)] [background-color:var(--color-clay)]" />
            )}
          </span>
          <span className="flex-1 truncate">通知</span>
        </Link>

        <Link
          href={accountHref}
          className={`flex items-center [gap:var(--gap-inline)] [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] transition-colors [transition-duration:var(--dur-fast)] ${
            pathname === accountHref
              ? "text-[color:var(--color-paper)] [background-color:var(--color-ink-850)] [font-weight:var(--fw-semibold)]"
              : "text-[color:var(--color-paper-dim)] [font-weight:var(--fw-medium)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
          }`}
        >
          <IconSettings className="h-[18px] w-[18px]" />
          <span className="flex-1 truncate">{accountLabel}</span>
        </Link>

        {profileMenu ? (
          <div className="relative" onKeyDown={(e) => e.key === "Escape" && closeProfilePanel()}>
            <button
              ref={profileTriggerRef}
              type="button"
              className="flex w-full items-center [gap:var(--gap-inline)] [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] text-[color:var(--color-paper-dim)] transition-colors [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
              onClick={() => setOpen((p) => (p === "profile" ? null : "profile"))}
              aria-haspopup="true"
              aria-expanded={open === "profile"}
            >
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center [border-radius:var(--radius-sm)] [font-size:var(--text-xs)] text-[color:var(--color-paper)] [background-color:var(--color-ink-800)] [font-weight:var(--fw-semibold)]">
                {initials}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-left leading-tight">
                <span className="block truncate">{user.name}</span>
                {user.roleLabel && <span className="block [font-size:var(--text-xs)] normal-case text-[color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">{user.roleLabel}</span>}
              </span>
            </button>
            {open === "profile" && (
              // Approximate positioning: opens upward from a footer item,
              // since it's pinned to the bottom of the viewport. The real
              // source rendered this panel via a shared `.dropdown-panel-
              // rail` class whose own CSS wasn't available to port (see
              // this design system's other components for the same gap) —
              // this reconstructs the same "small panel beside its
              // trigger" affordance from this file's own token classes.
              <div className="absolute bottom-full left-0 z-20 mb-1.5 w-56 [border-radius:var(--radius-lg)] border p-1.5 [box-shadow:var(--shadow-raised)] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
                {profileMenu}
              </div>
            )}
          </div>
        ) : (
          <div className="flex cursor-default items-center [gap:var(--gap-inline)] [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] text-[color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center [border-radius:var(--radius-sm)] [font-size:var(--text-xs)] text-[color:var(--color-paper)] [background-color:var(--color-ink-800)] [font-weight:var(--fw-semibold)]">
              {initials}
            </span>
            <span className="min-w-0 flex-1 overflow-hidden text-left leading-tight">
              <span className="block truncate">{user.name}</span>
              {user.roleLabel && <span className="block [font-size:var(--text-xs)] normal-case text-[color:var(--color-paper-dim)]">{user.roleLabel}</span>}
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
