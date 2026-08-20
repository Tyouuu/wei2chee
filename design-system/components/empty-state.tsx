import Link from "next/link"
import type { ReactNode } from "react"

/**
 * One empty-state component, three situations — the distinction is the
 * point:
 *
 *   variant="empty"    nothing has ever been created → offer the create action
 *   variant="filtered" the active filter matched nothing → offer "clear filters", never the create action
 *   variant="cleared"  the work is done → no action at all; a call-to-action here reads as a chore
 *
 * Collapsing those three into one generic "nothing here" state is how you
 * end up offering a create action to someone who has plenty of records and
 * simply mistyped a search, or offering nothing to someone who genuinely
 * has zero and needs a way forward.
 *
 * Two-part copy (a title, then one short line explaining what would appear
 * here) rather than a single sentence, and rendered OUTSIDE the
 * table/list rather than inside an empty row — a table with headers and no
 * rows should not be an empty `<tbody>`, because that reads as broken
 * rather than as empty.
 *
 * Ported and generalized from a real client codebase's `empty-state.tsx`.
 */
export function EmptyState({
  variant,
  title,
  description,
  action,
  icon,
}: {
  variant: "empty" | "filtered" | "cleared"
  title: string
  description?: string
  /** Rendered only for `variant="empty"` (create) and `variant="filtered"`
      (clear filters). Ignored for `variant="cleared"` — see above. */
  action?: { href: string; label: string }
  icon?: ReactNode
}) {
  return (
    // aria-live: the result of an async filter is announced rather than
    // silently swapping content out from under a screen reader.
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-2 [border-radius:var(--radius-lg)] border border-dashed px-6 py-14 text-center [border-color:var(--color-ink-800)]"
    >
      {icon && (
        <span className="mb-1 grid h-11 w-11 place-items-center rounded-full text-[color:var(--color-paper-dim)] [background-color:var(--color-ink-850)]">
          {icon}
        </span>
      )}
      <p className="[font-size:var(--text-base)] text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{title}</p>
      {description && (
        <p className="max-w-sm [font-size:var(--text-sm)] leading-relaxed text-[color:var(--color-paper-dim)]">{description}</p>
      )}
      {variant === "empty" && action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] [color:var(--color-on-primary)] transition-colors [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] [transition-duration:var(--dur)] [transition-timing-function:var(--ease-out-quad)] hover:[background-color:var(--color-primary-deep)]"
        >
          {action.label}
        </Link>
      )}
      {variant === "filtered" && action && (
        <Link
          href={action.href}
          className="mt-3 [font-size:var(--text-xs)] text-[color:var(--color-paper-dim)] transition-colors [font-weight:var(--fw-medium)] [transition-duration:var(--dur)] hover:text-[color:var(--color-paper)]"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
