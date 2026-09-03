"use client"

import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { IconSettings, railIcon } from "./rail-icons"
import { NavAxisContext } from "./nav-axis"
import { useSystemWords } from "@/design-system/system-lang-context"

export type RailItem = {
  href: string
  label: string
  group: string
  /** Rendered before the label — supply one of `rail-icons.tsx`'s icons, or any other node. */
  icon?: ReactNode
  /** Serialisable alternative to `icon`, resolved through `RAIL_ICONS`. Exists
   *  because a Puck-generated nav is plain JSON and cannot carry a node; a
   *  hand-written app should keep using `icon`. `icon` wins if both are set. */
  iconName?: string
  badge?: number
}

/**
 * A row in the rail's footer — notifications, settings, whatever else a
 * particular business's system needs down there.
 *
 * `href` is optional on purpose. In the portal these rows are part of the
 * system the customer is DESIGNING, and the screens behind them do not exist
 * yet; the old code pointed both at "#", which rendered a real link that went
 * nowhere. A row with no href renders as a non-interactive row instead, so it
 * still shows what the built system will have without pretending to be
 * clickable.
 */
export type RailUtilityItem = {
  label: string
  href?: string
  /** Resolved through `RAIL_ICONS`, same as `RailItem.iconName`. */
  iconName?: string
  /** Draws the unread pip. Only meaningful on a notifications-style row. */
  showUnreadDot?: boolean
}

/**
 * HOW DENSE THE NAVIGATION IS. Three of them, and they are genuinely three
 * designs rather than one design with a colour picker on it.
 *
 * They compose with SystemShell's `nav` axis and `navTone`, so three densities
 * x two axes x two grounds is twelve navigations from three orthogonal
 * choices — rather than twelve variants to write and maintain.
 *
 * WHY THIS EXISTS: the founder pressed the sidebar in the editor, expected to
 * be offered another one, and there was nothing to offer —
 * 「我按这个sidebar 就是我要换那个sidebar啦 可是我现在没有别的sidebar给客户换啊」.
 * Measured at the time: of nineteen registered blocks, ONE had a genuine look
 * option (TrendChart's bar/line/area). Every other field was content. A system
 * designer that cannot change how anything looks is a form, not a designer.
 *
 * The four are chosen to answer four different businesses, not four moods:
 *
 *   full     The default. 228px, grouped sections, icon + label, a monogram
 *            tile. Right for a system with eight or more pages in real groups.
 *   compact  64px, icons only, label on hover. Buys ~165px back for the working
 *            area, which is the difference between a seven-column table fitting
 *            and not. Right for table-heavy operations.
 *   quiet    220px, no icons and no monogram — type, hairlines and one active
 *            rule. Right for a business whose pages have no natural icons
 *            (「三房翻新」has no glyph) and where a row of generic squares reads
 *            as decoration.
 */
export type RailVariant = "full" | "compact" | "quiet" | "tree" | "action"

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
  actionLabel,
  actionHref,
  items,
  utilityItems,
  notificationsHref,
  hasUnread,
  accountHref,
  accountLabel,
  user,
  profileMenu,
  topSlot,
  variant = "full",
}: {
  brand: { href: string; label: string; icon?: ReactNode }
  items: RailItem[]
  /** The footer row. Supply this and it replaces the notifications/account
   *  pair below entirely — which is the point: in a system the customer is
   *  designing, "does this business need a notifications screen" is their call,
   *  not the template's. Omit it and the legacy two are rendered, so every
   *  existing caller keeps working. */
  utilityItems?: RailUtilityItem[]
  notificationsHref?: string
  hasUnread?: boolean
  accountHref?: string
  accountLabel?: string
  user: { name: string; roleLabel?: string }
  /** Dropdown content shown when the profile row is clicked — e.g. a role switcher, a sign-out link. Omit to render the profile row as a static, non-interactive summary. */
  profileMenu?: ReactNode
  /** Rendered under the brand mark — a place for one glanceable, app-specific summary (a plan tier, a balance, a status). Omit if there's nothing that belongs there. */
  topSlot?: ReactNode
  /** Which of the five navigations to draw. See `RailVariant`. */
  variant?: RailVariant
  /**
   * The one thing this business does most, as a filled button at the TOP of the
   * rail -- above the navigation, not inside it.
   *
   * Only `action` draws it, and the reason it is a rail variant rather than a
   * block the customer could drop on the page is that its position is the whole
   * idea: measured on arhamkhnz/next-shadcn-admin-dashboard (2026-08-26), the
   * first thing under the brand is a black full-width 「Quick Create」, before
   * any destination. A navigation is a list of places; this says the system
   * expects you to have come to DO something, and it says it before offering
   * anywhere to go.
   *
   * Ignored by the other four variants on purpose: on `compact` there is no
   * width for a word, and on `quiet` a filled block is the one object that
   * variant exists to not have.
   */
  actionLabel?: string
  actionHref?: string
}) {
  const w = useSystemWords()
  const pathname = usePathname()
  const [open, setOpen] = useState<Panel>(null)

  // The legacy pair, expressed in the new shape. Keeping the old props working
  // costs three lines and means this generalisation isn't a breaking change for
  // any hand-written app that mounts this rail.
  const utility: RailUtilityItem[] = utilityItems ?? [
    { label: w.notifications, href: notificationsHref, iconName: "notifications", showUnreadDot: hasUnread },
    { label: accountLabel ?? w.account, href: accountHref, iconName: "account" },
  ]

  const axis = useContext(NavAxisContext)
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

  // The four variants expressed as data rather than as four copies of the
  // markup. Everything below reads from here, so a fifth variant is a row in
  // this object plus whatever it genuinely draws differently -- not another
  // 200-line branch of the same tree.
  // Read, not chosen. See NavAxisContext in system-shell.tsx for why putting
  // this on the rail as a fourth variant was a trap rather than an option.
  const isTop = axis === "top"
  const isCompact = variant === "compact"
  const isQuiet = variant === "quiet"
  /**
   * 树 -- Ant Design Pro's rail, and the shape a Chinese-speaking SME owner
   * has already been using for years (Autocount, 进销存, 车行系统 all draw it).
   *
   * The difference from `full` is not density, it is what a GROUP is. In
   * `full` a group is an uppercase micro label -- a caption over a list. Here
   * it is a row you press, set in the same size as its items, with the chevron
   * on the right and the items indented under a guide line. One reads as a
   * section heading; the other reads as a folder. That is a structural
   * difference a palette cannot repaint, which is the whole reason this axis
   * gained a fourth option on 2026-08-25.
   */
  const isTree = variant === "tree"
  const isAction = variant === "action"
  const showIcons = !isQuiet
  const showLabels = !isCompact

  const shell = isTop
    ? "flex w-full shrink-0 items-center gap-3 border-b [padding-inline:14px] [padding-block:8px] [background-color:var(--color-nav-bg)] [border-color:var(--color-nav-border)]"
    : `flex shrink-0 border-r [padding-block:10px] [background-color:var(--color-nav-bg)] [border-color:var(--color-nav-border)] w-full flex-row items-center gap-1 overflow-x-auto border-b border-r-0 @3xl:h-full @3xl:min-h-full @3xl:flex-col @3xl:items-stretch @3xl:overflow-x-visible @3xl:border-r @3xl:border-b-0 ${
        isCompact
          ? "@3xl:w-[76px] [padding-inline:6px]"
          : isQuiet
            ? "@3xl:w-[220px] [padding-inline:12px]"
            // A tree spends 18px on the indent, so it needs them back.
            : isTree
              ? "@3xl:w-[240px] [padding-inline:8px]"
              : "@3xl:w-[228px] [padding-inline:10px]"
      }`

  return (
    // aria-label because a page can hold more than one <aside> (a detail
    // page might put its own summary column in one), and two unlabelled
    // complementary landmarks are indistinguishable to a screen reader.
    // Naming this one names the one that appears on every page, so a page
    // only ever has to label its own.
    // The rail is the one dark surface in every register — see the NAVIGATION
    // GROUND block in design-system/tokens/ledger.css for why, and why the
    // colours are tokens rather than literals here. `min-h-full` rather than
    // the old `h-screen`: inside Puck's canvas iframe the two coincide, but on
    // a page taller than the viewport `h-screen` stops the rail partway down
    // and leaves a bright strip under it.
    // `data-nav` is what the print layer selects on (app/globals.css, PAPER).
    // It states the fact -- this element is the navigation -- rather than
    // relying on `aside`, which a detail page may legitimately use for its own
    // summary column and which must still print.
    <aside data-nav={isTop ? "top" : "side"} className={shell} aria-label={isTop ? w.topNav : w.sideNav} ref={wrapRef}>
      {/* The brand block. A monogram tile carrying the register's own nav
          accent gives the rail one saturated anchor point — without it a dark
          column of grey text reads as unfinished rather than as chrome. */}
      <Link
        href={brand.href}
        title={isCompact ? brand.label : undefined}
        className={`flex items-center gap-2.5 [border-radius:var(--radius-md)] transition-colors [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-nav-hover)] ${
          isTop ? "shrink-0 px-2 py-1.5" : isCompact ? "mb-2 justify-center px-1 py-2" : "mb-2 px-2 py-2.5"
        }`}
      >
        {/* QUIET DROPS THE MONOGRAM TILE. It is the rail's one saturated
            anchor, which is exactly what that variant is for a business that
            does not want. The name is set in the display face instead, so the
            block still reads as a brand rather than as a first nav item. */}
        {isQuiet ? null : (
          brand.icon ?? (
            <span
              aria-hidden="true"
              className="grid h-7 w-7 shrink-0 place-items-center [border-radius:var(--radius-sm)] [background-color:var(--color-nav-accent)] [color:var(--color-nav-bg)] [font-size:var(--text-sm)] [font-weight:var(--fw-display)]"
            >
              {brand.label.trim().charAt(0) || "·"}
            </span>
          )
        )}
        {showLabels && (
          <span className="min-w-0 flex-1 leading-tight">
            <span
              className={`block truncate text-[color:var(--color-nav-fg)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] ${
                isQuiet ? "[font-family:var(--font-display)] [letter-spacing:var(--tracking-title)]" : ""
              }`}
            >
              {brand.label}
            </span>
            {/* Not on the topbar: a two-line brand block in a 40px-tall bar is
                what sets that bar's height, and it doubles it to say a word
                the customer already knows. */}
            {!isTop && !isQuiet && (
              <span className="block truncate text-[color:var(--color-nav-fg-dim)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)]">
                {w.operationsSystem}
              </span>
            )}
          </span>
        )}
      </Link>

      {/*
        THE PRIMARY ACTION, IF THIS RAIL HAS ONE. See `actionLabel`.

        Not on the topbar: a full-width filled block in a 40px-tall bar is the
        bar. On a top axis the same intent is already carried by PageHeader's
        own action button, which sits where the eye is.
      */}
      {isAction && actionLabel && !isTop ? (
        <Link
          href={actionHref || "#"}
          className="mb-3 flex items-center justify-center gap-1.5 [border-radius:var(--radius-control)] px-3 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] transition-opacity [transition-duration:var(--dur-fast)] hover:opacity-90"
          style={{
            height: "var(--control-h)",
            backgroundColor: "var(--color-nav-accent)",
            color: "var(--color-nav-bg)",
          }}
        >
          <span aria-hidden className="[font-size:var(--text-base)] leading-none">
            +
          </span>
          <span className="truncate">{actionLabel}</span>
        </Link>
      ) : null}

      {topSlot}

      {/* flex-1 + overflow-y-auto: the aside itself is a fixed h-screen
          column with no scroll of its own, so once the nav groups plus the
          footer below together outgrow the viewport, whatever didn't fit
          would simply be cut off past the bottom edge with no way to reach
          it. This section scrolls on its own when it needs to, while the
          footer (notifications, account, profile) stays pinned and always
          reachable. */}
      <div className={isTop ? "flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" : "flex min-w-0 flex-1 items-center gap-1 overflow-x-auto @3xl:block @3xl:overflow-y-auto"}>
        {[...groups.entries()].map(([group, groupItems]) => {
          // A group of one is not worth a disclosure — the chevron would be
          // the only thing it hides.
          const collapsible = groupItems.length > 1
          // The group holding the current page never collapses.
          const holdsCurrent = groupItems.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
          const openGroup = !collapsible || holdsCurrent || !collapsed.includes(group)
          // An unnamed group is a caller saying "these items need no heading" —
          // the generated systems pass one empty-named group holding four or
          // five links, where a section header would be organising nothing.
          // Rendering the label anyway drew an empty uppercase row with a lone
          // chevron beside it, which read as a broken control.
          // A 64px column and a 40px bar have nowhere to put an uppercase
          // section label, and on the topbar the groups run inline anyway, so
          // a heading between them would read as another nav item.
          const named = group.trim().length > 0 && !isCompact && !isTop
          return (
            <div key={group} className={isTop ? "flex shrink-0 items-center gap-1" : "flex shrink-0 items-center gap-1 @3xl:block"}>
              {!named ? null : collapsible ? (
                <button
                  type="button"
                  className={
                    isTree
                      ? "flex w-full items-center justify-between gap-2 [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:calc(var(--pad-control-y)*1.4)] [font-size:var(--text-sm)] text-[color:var(--color-nav-fg)] [font-weight:var(--fw-medium)] hover:[background-color:var(--color-nav-hover)]"
                      : "flex w-full items-center justify-between gap-2 [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-micro)] uppercase tracking-[0.07em] text-[color:var(--color-nav-fg-dim)] [font-weight:var(--fw-semibold)] hover:text-[color:var(--color-nav-fg)]"
                  }
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
                <div
                  className={
                    isTree
                      ? "[padding-inline:var(--pad-control-x)] [padding-block:calc(var(--pad-control-y)*1.4)] [font-size:var(--text-sm)] text-[color:var(--color-nav-fg)] [font-weight:var(--fw-medium)]"
                      : "[padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-micro)] uppercase tracking-[0.07em] text-[color:var(--color-nav-fg-dim)] [font-weight:var(--fw-semibold)]"
                  }
                >
                  {group}
                </div>
              )}
              <div
                id={`rail-group-${group}`}
                hidden={!openGroup}
                className={
                  isTop
                    ? "flex items-center gap-1"
                    : // The guide line is what makes an indent read as
                      // CONTAINMENT rather than as a margin somebody got wrong.
                      // Only under a named group: indenting items that hang off
                      // nothing would be an indent with no parent.
                      isTree && named
                      ? "ms-[13px] ps-[9px] [border-inline-start:var(--hairline)_solid_var(--color-nav-border)]"
                      : undefined
                }
              >
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
                      /*
                        THE WORD IS DRAWN, NOT PUT IN A TOOLTIP.

                        This rail used to be icons and a `title` attribute, and
                        the founder's own rejection list already said why that
                        is wrong -- when we judged Durable's icon-only rail on
                        2026-08-25 the verdict was 「给五十岁的车厂老板，没有字的
                        图标＝死掉的按钮」. Then three of our own registers (台账,
                        夜, 玻璃) shipped exactly that. Photographed side by side
                        with the benchmark on 2026-08-26 it is the first thing
                        that reads as unfinished: six grey glyphs and no way to
                        know which one is 报价单.

                        A tooltip is not the answer. It needs a mouse, it needs
                        a second of hovering, and the person this product is for
                        is on a phone half the time. So the label goes under the
                        icon in micro type. The rail grows from 64 to 76px --
                        five per cent of the page -- and stops being a puzzle.
                      */
                      title={isCompact ? item.label : undefined}
                      className={`relative flex items-center [font-size:var(--text-sm)] transition-colors [transition-duration:var(--dur-fast)] ${
                        isCompact
                          ? "h-auto w-full flex-col justify-center gap-1 py-1.5 [border-radius:var(--radius-md)]"
                          : isTop
                            ? "shrink-0 gap-2 [border-radius:var(--radius-md)] px-2.5 py-1.5"
                            : isQuiet
                              ? "gap-2.5 py-[7px] pl-3 pr-2"
                              : "gap-2.5 [border-radius:var(--radius-md)] py-2 pl-2.5 pr-2"
                      } ${
                        active
                          ? // QUIET STATES THE ACTIVE ROW WITH INK AND A RULE,
                            // not a filled pill. A filled row is the loudest
                            // thing on a rail; the whole point of this variant
                            // is that nothing on it is loud.
                            isQuiet
                            ? "text-[color:var(--color-nav-fg)] [font-weight:var(--fw-semibold)]"
                            : "text-[color:var(--color-nav-fg)] [background-color:var(--color-nav-active)] [font-weight:var(--fw-semibold)]"
                          : "text-[color:var(--color-nav-fg-dim)] [font-weight:var(--fw-medium)] hover:[background-color:var(--color-nav-hover)] hover:text-[color:var(--color-nav-fg)]"
                      }`}
                    >
                      {/* Colour alone carried the active state before, which on
                          a dark ground is a small step between two greys. This
                          is a second, non-colour channel for the same fact —
                          a bar down the left of a column, a rule under the tab
                          on a horizontal bar, which is where each of those
                          shapes conventionally puts it. */}
                      {active && (
                        <span
                          aria-hidden="true"
                          className={
                            isTop
                              ? "absolute inset-x-2 -bottom-[9px] h-[2px] rounded-full [background-color:var(--color-nav-accent)]"
                              : isCompact
                                ? "absolute -left-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full [background-color:var(--color-nav-accent)]"
                                : "absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full [background-color:var(--color-nav-accent)]"
                          }
                        />
                      )}
                      {showIcons && (
                        <span className="shrink-0 opacity-90">
                          {item.icon ?? railIcon(item.iconName, isCompact ? "h-5 w-5" : "h-[17px] w-[17px]")}
                        </span>
                      )}
                      {showLabels && <span className={isTop ? "truncate" : "flex-1 truncate"}>{item.label}</span>}
                      {isCompact && (
                        <span className="w-full truncate text-center [font-size:var(--text-micro)] [line-height:1.1]">
                          {item.label}
                        </span>
                      )}
                      {item.badge != null && item.badge > 0 && (
                        <span
                          className={`grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 [font-size:var(--text-micro)] [background-color:var(--color-clay-bright)] [color:var(--color-on-dark)] [font-weight:var(--fw-semibold)] ${
                            isCompact ? "absolute -right-0.5 -top-0.5" : ""
                          }`}
                        >
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

      <div
        className={
          isTop
            ? "flex shrink-0 items-center gap-1 border-l pl-3 [border-color:var(--color-nav-border)]"
            : "shrink-0 border-t pt-2 [border-color:var(--color-nav-border)]"
        }
      >
        {utility.map((util, i) => {
          const icon = railIcon(util.iconName, "h-[18px] w-[18px]") ?? (
            <IconSettings className="h-[18px] w-[18px]" />
          )
          const body = (
            <>
              <span className="relative">
                {icon}
                {util.showUnreadDot && (
                  <span className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full border-[1.5px] [border-color:var(--color-nav-bg)] [background-color:var(--color-nav-accent)]" />
                )}
              </span>
              {showLabels && !isTop && <span className="flex-1 truncate">{util.label}</span>}
            </>
          )
          // The compact rail and the topbar both drop the label here, so the
          // row has to stop being a row: a full-width control holding one
          // 18px glyph reads as a mis-rendered button. Square, centred, and
          // the label moves to `title`.
          const base = `flex items-center transition-colors [transition-duration:var(--dur-fast)] [font-size:var(--text-sm)] [border-radius:var(--radius-md)] ${
            isCompact || isTop
              ? "h-9 w-9 shrink-0 justify-center"
              : "[gap:var(--gap-inline)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)]"
          }`

          // No href, or the placeholder one: this row is part of the system
          // being designed and has nowhere real to go yet. Rendered as a plain
          // row rather than a <Link href="#">, which was a link that visibly
          // did nothing when clicked.
          if (!util.href || util.href === "#") {
            return (
              <div
                key={`${util.label}-${i}`}
                title={
                  isCompact || isTop
                    ? w.notYetLive(util.label)
                    : w.notYetLive()
                }
                className={`${base} cursor-default text-[color:var(--color-nav-fg-dim)] [font-weight:var(--fw-medium)]`}
              >
                {body}
              </div>
            )
          }

          return (
            <Link
              key={`${util.label}-${i}`}
              href={util.href}
              title={isCompact || isTop ? util.label : undefined}
              className={`${base} ${
                pathname === util.href
                  ? "text-[color:var(--color-nav-fg)] [background-color:var(--color-nav-hover)] [font-weight:var(--fw-semibold)]"
                  : "text-[color:var(--color-nav-fg-dim)] [font-weight:var(--fw-medium)] hover:[background-color:var(--color-nav-hover)] hover:text-[color:var(--color-nav-fg)]"
              }`}
            >
              {body}
            </Link>
          )
        })}

        {profileMenu ? (
          <div className="relative" onKeyDown={(e) => e.key === "Escape" && closeProfilePanel()}>
            <button
              ref={profileTriggerRef}
              type="button"
              title={showLabels ? undefined : user.name}
              className={`flex items-center [border-radius:var(--radius-md)] [font-size:var(--text-sm)] text-[color:var(--color-nav-fg-dim)] transition-colors [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-nav-hover)] hover:text-[color:var(--color-nav-fg)] ${
                isCompact || isTop
                  ? "h-9 w-9 shrink-0 justify-center"
                  : "w-full [gap:var(--gap-inline)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)]"
              }`}
              onClick={() => setOpen((p) => (p === "profile" ? null : "profile"))}
              aria-haspopup="true"
              aria-expanded={open === "profile"}
            >
              {/* 🔴 圆的，不是方的（2026-09-03）。尺子加了组件清单之后第一次报出来：
                 **六个参考页每一个都有一颗圆头像，我们六套一个都没有。**
                 我们本来就画了这个字章，只是它是方角的 26px —— 画面上它不读作
                 「一个人」。改成圆的、大一点，跟参考同一个东西。 */}
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full [font-size:var(--text-xs)] text-[color:var(--color-nav-fg)] [background-color:var(--color-nav-border)] [font-weight:var(--fw-semibold)]">
                {initials}
              </span>
              {showLabels && !isTop && (
                <span className="min-w-0 flex-1 overflow-hidden text-left leading-tight">
                  <span className="block truncate">{user.name}</span>
                  {user.roleLabel && <span className="block [font-size:var(--text-xs)] normal-case text-[color:var(--color-nav-fg-dim)] [font-weight:var(--fw-medium)]">{user.roleLabel}</span>}
                </span>
              )}
            </button>
            {open === "profile" && (
              // Approximate positioning: opens upward from a footer item,
              // since it's pinned to the bottom of the viewport. The real
              // source rendered this panel via a shared `.dropdown-panel-
              // rail` class whose own CSS wasn't available to port (see
              // this design system's other components for the same gap) —
              // this reconstructs the same "small panel beside its
              // trigger" affordance from this file's own token classes.
              <div
                className={`absolute z-20 w-56 [border-radius:var(--radius-lg)] border p-1.5 [box-shadow:var(--shadow-overlay)] [background-color:var(--color-nav-bg-deep)] [border-color:var(--color-nav-border)] ${
                  // Upward from a pinned footer, downward from a bar at the
                  // top of the page. Opening upward on the topbar would put
                  // the panel off the top of the window.
                  isTop ? "right-0 top-full mt-1.5" : "bottom-full left-0 mb-1.5"
                }`}
              >
                {profileMenu}
              </div>
            )}
          </div>
        ) : (
          <div
            title={showLabels ? undefined : user.name}
            className={`flex cursor-default items-center [border-radius:var(--radius-md)] [font-size:var(--text-sm)] text-[color:var(--color-nav-fg-dim)] [font-weight:var(--fw-medium)] ${
              isCompact || isTop
                ? "h-9 w-9 shrink-0 justify-center"
                : "[gap:var(--gap-inline)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)]"
            }`}
          >
            {/* 🔴 圆的，不是方的（2026-09-03）。尺子加了组件清单之后第一次报出来：
                 **六个参考页每一个都有一颗圆头像，我们六套一个都没有。**
                 我们本来就画了这个字章，只是它是方角的 26px —— 画面上它不读作
                 「一个人」。改成圆的、大一点，跟参考同一个东西。 */}
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full [font-size:var(--text-xs)] text-[color:var(--color-nav-fg)] [background-color:var(--color-nav-border)] [font-weight:var(--fw-semibold)]">
              {initials}
            </span>
            {showLabels && !isTop && (
              <span className="min-w-0 flex-1 overflow-hidden text-left leading-tight">
                <span className="block truncate">{user.name}</span>
                {user.roleLabel && <span className="block [font-size:var(--text-xs)] normal-case text-[color:var(--color-nav-fg-dim)]">{user.roleLabel}</span>}
              </span>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
