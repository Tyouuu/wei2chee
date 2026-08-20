import Link from "next/link"
import { X } from "lucide-react"

export type FilterChip = {
  /** What kind of filter this is — "Search", "Region", "Status". */
  label: string
  /** The value being filtered on. */
  value: string
  /** Where to go to remove just this one. */
  removeHref: string
}

/**
 * Shows what is currently narrowing a list, and lets each one be removed
 * individually, plus a clear-all affordance once there's more than one.
 *
 * The filters live in the URL — which is what makes a filtered view
 * shareable — but a URL alone gives no on-screen sign that a filter is
 * active: a list showing 3 of 249 rows looks identical to a list that only
 * ever had 3 rows, and the only way back is editing the URL by hand. This
 * renders active filters as chips with per-chip removal plus a clear-all,
 * the way Linear does (minus the operator editing needed for nested
 * boolean filter groups, which most apps reaching for this don't have).
 *
 * Ported and generalized from a real client codebase's `filter-chips.tsx`.
 */
export function FilterChips({
  chips,
  clearAllHref,
  filteredByLabel = "筛选条件",
  clearAllLabel = "清空全部",
}: {
  chips: FilterChip[]
  clearAllHref: string
  /** Overridable heading before the chip list. */
  filteredByLabel?: string
  /** Overridable label for the clear-all affordance. */
  clearAllLabel?: string
}) {
  if (!chips.length) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="[font-size:var(--text-xs)] uppercase tracking-wide text-[color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">
        {filteredByLabel}
      </span>
      {chips.map((chip) => (
        <Link
          key={`${chip.label}-${chip.value}`}
          href={chip.removeHref}
          // The whole chip is the remove target, not just the ×. A 10px
          // glyph is under every documented minimum touch size, and there's
          // nothing else a click on an active filter chip could sensibly
          // mean.
          className="group inline-flex items-center gap-1.5 [border-radius:var(--radius-sm)] border py-1 pl-2.5 pr-2 [font-size:var(--text-xs)] text-[color:var(--color-paper)] transition-colors [border-color:var(--color-ink-800)] [background-color:var(--color-ink-850)] [font-weight:var(--fw-medium)] [transition-duration:var(--dur-fast)] hover:[border-color:var(--color-ink-700)] hover:[background-color:var(--color-ink-800)]"
          title={`Remove ${chip.label.toLowerCase()} filter`}
        >
          <span className="text-[color:var(--color-paper-dim)]">{chip.label}:</span>
          <span className="max-w-[180px] truncate">{chip.value}</span>
          <X
            aria-hidden="true"
            className="h-3 w-3 text-[color:var(--color-paper-dim)] transition-colors group-hover:text-[color:var(--color-paper)]"
          />
        </Link>
      ))}
      {chips.length > 1 && (
        <Link
          href={clearAllHref}
          className="ml-0.5 [font-size:var(--text-xs)] text-[color:var(--color-paper-dim)] underline-offset-2 [font-weight:var(--fw-medium)] hover:text-[color:var(--color-paper)] hover:underline"
        >
          {clearAllLabel}
        </Link>
      )}
    </div>
  )
}
