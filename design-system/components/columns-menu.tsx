"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

export type ColumnSpec = { key: string; label: string; hint?: string }

/**
 * Which columns a table is showing, with a checklist to toggle each on/off
 * and a live "6/8" count on the trigger — the count, not a dot, because
 * "Columns 6/8" says both that something is hidden and how much, which a
 * badge alone can't.
 *
 * This component owns only the toggle UI and the open/closed set of hidden
 * keys; it does not persist anything itself. `onChange` fires with the full
 * next hidden-key list on every toggle, and it's the caller's job to decide
 * what "hiding a column" actually does — flipping conditional rendering on
 * a `<table>` it renders, writing a cookie for a no-flash server-rendered
 * first paint, localStorage, whatever fits the app it's dropped into.
 *
 * Ported and generalized from a real client codebase's `columns-menu.tsx`.
 * The real source wrote a `<style>` tag built from a cookie-backed hidden-
 * column CSS helper and a `TableId`-keyed cookie name, both imported from
 * an app-specific `lib/table-columns` module — a real, load-bearing piece
 * of that app's own SSR-no-flash strategy, but not something a shared
 * design-system component should own: a hard dependency on one app's
 * cookie-naming and CSS-injection scheme would break the moment this file
 * is copied into a different app that persists column visibility a
 * different way (or not at all). The checkbox-list interaction and the
 * "N/total" trigger label are preserved exactly; the persistence mechanism
 * is now entirely the caller's choice via `onChange`.
 */
export function ColumnsMenu({
  columns,
  hidden: initialHidden,
  alwaysOn,
  onChange,
  footnote,
}: {
  columns: ColumnSpec[]
  /** Which column keys start hidden. */
  hidden: string[]
  /** Named in the menu as fixed, so their absence doesn't read as an omission — e.g. "Name and Status". */
  alwaysOn: string
  /** Fires with the full next hidden-key list every time a column is toggled. */
  onChange?: (hidden: string[]) => void
  /** One line under the checklist — e.g. whether the choice is remembered and where. Omit if the caller doesn't persist it. */
  footnote?: string
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(initialHidden))
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function toggle(key: string) {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setHidden(next)
    onChange?.([...next])
  }

  const shownCount = columns.length - hidden.size

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] text-[color:var(--color-paper)] transition-colors [border-color:var(--color-ink-800)] [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)]"
      >
        Columns
        <span className="tnum text-[color:var(--color-paper-dim)]">
          {shownCount}/{columns.length}
        </span>
        <ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform [transition-duration:var(--dur-fast)] ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-64 rounded-xl border p-2 shadow-lg [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
          <p className="px-2 pb-1.5 pt-1 text-[11px] uppercase tracking-[0.07em] text-[color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            Show these columns
          </p>
          {columns.map((col) => (
            <label
              key={col.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:[background-color:var(--color-ink-850)]"
            >
              <input
                type="checkbox"
                checked={!hidden.has(col.key)}
                onChange={() => toggle(col.key)}
                className="mt-[3px] h-3.5 w-3.5 [accent-color:var(--color-primary)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] text-[color:var(--color-paper)] [font-weight:var(--fw-medium)]">{col.label}</span>
                {col.hint && <span className="block text-[11px] leading-snug text-[color:var(--color-paper-dim)]">{col.hint}</span>}
              </span>
            </label>
          ))}
          <p className="border-t px-2 pb-1 pt-2 text-[11px] leading-snug text-[color:var(--color-paper-dim)] [border-color:var(--color-ink-800)]">
            {alwaysOn} always stay.{footnote ? ` ${footnote}` : ""}
          </p>
        </div>
      )}
    </div>
  )
}
