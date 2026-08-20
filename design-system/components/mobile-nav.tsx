"use client"

import { useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

export type MobileNavItem = { href: string; label: string }

/**
 * Below the breakpoint where a full rail nav fits, everything collapses
 * into one hamburger panel — nav links, notifications, and anything else
 * `MobileNav` is handed via `extra`/`footer` — rather than being split
 * across several menus that each show their own copy of the same unread
 * indicator or account controls. One panel, not two competing ones.
 *
 * Ported and generalized from a real client codebase's `mobile-nav.tsx`.
 * The real source hard-baked one specific role-preview switcher (three
 * literal role names) and one specific credit-balance banner into this
 * component, both dropped here: neither is a generic navigation concern,
 * and a component meant to be copied into a different app shouldn't carry
 * another app's role system or business metric. Both are replaced by an
 * `extra` render slot rendered in the same position, so a consuming app can
 * put whatever app-specific control belongs there. `notifications: Notification[]`
 * (an app-specific data shape) is generalized to a plain `hasUnread`
 * boolean — this component only ever needed to know whether to show a dot.
 */
export function MobileNav({
  items,
  notificationsHref,
  hasUnread,
  accountHref,
  accountLabel = "账号设置",
  extra,
  footer,
}: {
  items: MobileNavItem[]
  notificationsHref: string
  hasUnread?: boolean
  accountHref: string
  accountLabel?: string
  /** Rendered between the nav links and the footer — e.g. an app-specific role switcher or a secondary action list. */
  extra?: ReactNode
  /** Rendered at the very bottom of the panel — e.g. the signed-in user's identity and a sign-out control. */
  footer?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close the panel on navigation. Adjusted during render (React's
  // supported pattern for "reset state when a prop changes") rather than in
  // an effect, so it doesn't trigger an extra commit-then-rerender pass.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  // Longest match wins. A prefix test alone would light up both a parent
  // route and a child route on the child route's own path, since one href
  // is a prefix of the other.
  function isActive(href: string) {
    const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`)
    return matches(href) && !items.some((o) => o.href !== href && o.href.startsWith(href) && matches(o.href))
  }

  const linkClass = (active: boolean) =>
    active
      ? "[border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] text-sm [font-weight:var(--fw-semibold)] [background-color:var(--color-paper)] [color:var(--color-on-dark)]"
      : "[border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] text-sm text-[color:var(--color-paper-dim)] transition-colors [font-weight:var(--fw-medium)] [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "关闭菜单" : "打开菜单"}
        aria-expanded={open}
        className="relative grid h-8 w-8 place-items-center [border-radius:var(--radius-md)] text-[color:var(--color-paper-dim)] transition-colors [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
      >
        {open ? (
          <X aria-hidden="true" className="h-4 w-4" />
        ) : (
          <>
            <Menu aria-hidden="true" className="h-4 w-4" />
            {hasUnread && (
              <span className="absolute right-1 top-1 h-[7px] w-[7px] rounded-full [background-color:var(--color-clay)]" />
            )}
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-0 top-[57px] z-40 max-h-[calc(100vh-57px)] overflow-y-auto border-b px-4 py-3 [box-shadow:var(--shadow-overlay)] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
          <nav className="flex flex-col gap-0.5">
            {items.map((item) => (
              <a key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={linkClass(isActive(item.href))}>
                {item.label}
              </a>
            ))}
            <a
              href={notificationsHref}
              className={`flex items-center gap-2 ${linkClass(isActive(notificationsHref))}`}
            >
              Notifications
              {hasUnread && <span className="h-[7px] w-[7px] shrink-0 rounded-full [background-color:var(--color-clay)]" />}
            </a>
            <a href={accountHref} className={linkClass(isActive(accountHref))}>
              {accountLabel}
            </a>
          </nav>

          {extra && <div className="mt-3 border-t pt-3 [border-color:var(--color-ink-800)]">{extra}</div>}

          {footer && <div className="mt-3 flex items-center justify-between border-t pt-3 [border-color:var(--color-ink-800)]">{footer}</div>}
        </div>
      )}
    </div>
  )
}
