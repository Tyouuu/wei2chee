import Link from "next/link"
import type { ReactNode } from "react"

/**
 * The page's identity zone: title, an optional one-line summary of scale,
 * and the one action this page is for. It renders on the page background,
 * OUTSIDE any card that holds the page's content — that placement keeps
 * "you are here" (this header) visually separate from "here is the data"
 * (the content below it), instead of both rendering at the same elevation
 * inside one bordered surface, where the border stops grouping anything and
 * just becomes an outline drawn around the whole page.
 *
 * The action slot is what gives a page's primary action somewhere to live,
 * next to the heading it belongs to, rather than only existing as a nav
 * link elsewhere in the app.
 *
 * Ported and generalized from a real client codebase's `page-header.tsx`.
 */
export function PageHeader({
  title,
  subtitle,
  meta,
  action,
}: {
  /** ReactNode, not string, so the editor can wrap it in an <Inline> marker
   *  and let the customer retype it on the page. Every existing caller passes
   *  a string, which is a ReactNode. */
  title: ReactNode
  /** One line on the scale of what's below, e.g. "249 records · 44 regions". */
  subtitle?: ReactNode
  /** Small trailing element beside the title, e.g. a read-only badge. */
  meta?: ReactNode
  /** Either a link-style primary action (rendered as a styled link) or any
      other node — a button, a group of buttons — for full control. */
  action?: { href: string; label: string } | ReactNode
}) {
  const actionNode =
    action && typeof action === "object" && "href" in action ? (
      <Link
        href={action.href}
        className="inline-flex shrink-0 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] [color:var(--color-on-primary)] transition-colors [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] [transition-duration:var(--dur)] [transition-timing-function:var(--ease-out-quad)] hover:[background-color:var(--color-primary-deep)]"
      >
        {action.label}
      </Link>
    ) : (
      action
    )

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="ds-display flex items-center [gap:var(--gap-inline)] [font-size:var(--text-title)] tracking-[var(--tracking-title)] text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
          {title}
          {meta}
        </h1>
        {subtitle && (
          <p className="mt-0.5 [font-size:var(--text-sm)] text-[color:var(--color-paper-dim)]">{subtitle}</p>
        )}
      </div>
      {actionNode}
    </div>
  )
}
