"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

/**
 * A bounded-height scroll viewport for wide, tall tables — not a table
 * component itself. Give `DataGrid` a `<table>` (or any wide content) as
 * `children`, with its `<thead>` using `position: sticky; top: 0` on its own
 * header row, and this wrapper supplies the height that makes that sticky
 * header actually work.
 *
 * Why a plain `overflow-x: auto` wrapper doesn't work: browsers compute
 * `overflow-y` to `auto` as well the moment `overflow-x` is set to anything
 * other than `visible`, which turns the wrapper into a scroll container on
 * *both* axes and breaks `position: sticky` on the header — a sticky
 * element only sticks within its own nearest scrolling ancestor. Giving the
 * wrapper an explicit height instead resolves that: the wrapper becomes the
 * vertical scroll container, so the header sticks to *it* and stays put,
 * and the horizontal scrollbar belongs to the wrapper too — appearing right
 * below the visible rows instead of at the bottom of a page-length table.
 * That's the same shape spreadsheet/grid UIs (Sheets, Excel, Airtable) all
 * use: a fixed window onto the data, with the data moving behind it.
 *
 * The height is measured from where the box actually starts on the page via
 * `getBoundingClientRect()`, not guessed from a fixed `calc(100vh - Npx)` —
 * a constant like that is wrong the moment any page carries a different
 * amount of chrome above the grid than the page it was tuned for.
 *
 * Only applied from the `md` breakpoint up — below it this stays a plain
 * full-height table that scrolls sideways with the page, since a nested
 * scroll container fights a touch-scroll gesture for every swipe, and
 * there's no scrollbar to grab on a phone regardless.
 *
 * The two edge shadows (rendered via `--shadow-hue`, this design system's
 * tinted-shadow token) replace the original's bespoke `.is-scrolled`/
 * `.has-more-right` classes: an inset shadow on whichever side still has
 * unscrolled content, so a horizontally-scrollable grid always signals
 * there's more to see before the reader has to discover it by scrolling.
 *
 * Ported and generalized from a real client codebase's `data-grid.tsx`.
 */
export function DataGrid({
  id,
  label,
  children,
}: {
  /** Used to build the wrapper's DOM id (`grid-${id}`) — e.g. for an
      in-page "jump to table" link. */
  id: string
  /** Accessible name for the scroll region, exposed only once the grid is
      actually scrollable (see below). */
  label: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Three separate facts, because they drive three different things: whether
  // this is a focusable scroll region at all, and which of the two edge
  // shadows (if either) should currently be showing.
  const [scrollable, setScrollable] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wide = window.matchMedia("(min-width: 768px)")

    function fit() {
      if (!el) return
      if (!wide.matches) {
        // Below md the grid is a plain full-height table again — see the
        // comment above — so it must not be given a height at all.
        el.style.maxHeight = ""
        return
      }
      // 72px leaves room for a pager underneath, if the caller renders one.
      // Measured from the box's own position, so scrolling the page does
      // not change the answer.
      const top = el.getBoundingClientRect().top + window.scrollY
      const avail = window.innerHeight - (top - window.scrollY) - 72
      // The floor (520px, roughly eight rows) is allowed to beat the
      // available space: a window that only fits four rows of a long list
      // is a letterbox, and the page should scroll further rather than
      // shrink the grid down to that. Below the floor the horizontal
      // scrollbar still ends up a short scroll away, rather than at the
      // bottom of a page-length table — which is the complaint this
      // component exists to fix.
      el.style.maxHeight = `${Math.max(520, Math.min(760, avail))}px`
    }

    fit()
    window.addEventListener("resize", fit)
    wide.addEventListener("change", fit)
    // Anything above the grid changing height (a filter chip wrapping to a
    // second line, a banner appearing) moves the grid, so re-measure then too.
    const ro = new ResizeObserver(fit)
    if (document.body) ro.observe(document.body)
    return () => {
      window.removeEventListener("resize", fit)
      wide.removeEventListener("change", fit)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function sync() {
      if (!el) return
      const overflows = el.scrollWidth - el.clientWidth > 2
      setScrollable(overflows)
      setAtStart(el.scrollLeft <= 2)
      setAtEnd(!overflows || el.scrollWidth - el.scrollLeft - el.clientWidth <= 2)
    }

    sync()
    // ResizeObserver as well as the scroll listener: hiding a column (e.g.
    // via a columns menu) changes the overflow without any scrolling
    // happening, and a stale edge shadow would keep claiming there's more
    // content to one side when there no longer is.
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    const content = el.firstElementChild
    if (content) ro.observe(content)
    el.addEventListener("scroll", sync, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener("scroll", sync)
    }
  }, [])

  return (
    <div
      id={`grid-${id}`}
      ref={ref}
      {...(scrollable ? { role: "region", "aria-label": label, tabIndex: 0 } : {})}
      className="relative overflow-auto [border-radius:var(--radius-lg)] border [border-color:var(--color-ink-800)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--color-primary)]"
      style={{
        boxShadow:
          [
            // Deepened from 0.2. When a panel narrows the canvas this shadow
            // is the ONLY thing telling a customer their table continues past
            // the edge rather than being broken, and at 0.2 over a white card
            // it was not carrying that on its own.
            !atStart ? "inset 10px 0 8px -6px rgba(var(--shadow-hue), 0.34)" : "",
            !atEnd ? "inset -10px 0 8px -6px rgba(var(--shadow-hue), 0.34)" : "",
          ]
            .filter(Boolean)
            .join(", ") || undefined,
      }}
    >
      {children}
    </div>
  )
}
