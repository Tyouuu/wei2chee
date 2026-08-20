import { DataGrid } from "./data-grid"
import { StatusDot, type StatusTone } from "./status-dot"

export type RecordRow = {
  primary: string
  secondary?: string
  amount?: string
  statusTone: StatusTone
  statusLabel: string
}

/**
 * A real, Puck-friendly data table for business records (quotations,
 * customers, payments) — sits on top of `DataGrid` (a scroll-viewport
 * wrapper, not a table itself) and `StatusDot` (already registered), rather
 * than reinventing either. Column labels are static per-instance (set once
 * when the component is placed), row DATA is the array a customer or the
 * industry template edits — the shape Puck's `array` field type can
 * represent (primitives only, no ReactNode), unlike `DataGrid` itself which
 * takes an arbitrary `<table>` as `children` and can't be driven by Puck's
 * field data directly.
 *
 * `docs/portal-editor-known-issues.md`'s correction (2026-08-20): this is
 * the real "quotation table" component that was previously assumed to
 * already exist as `data-grid.tsx` -- it didn't, this is that component.
 *
 * DENSITY: every measurement here comes from the style's own axis tokens
 * rather than a Tailwind literal, so the same table renders as a tight
 * 32px-row ops grid under Ledger and a 52px-row airy list under Hearth. A
 * table is where a register's density is most visible, so this is the one
 * component where getting it from tokens matters most.
 */
export function RecordTable({
  gridId,
  caption,
  primaryLabel,
  secondaryLabel,
  amountLabel,
  statusColumnLabel,
  rows,
}: {
  gridId: string
  caption: string
  primaryLabel: string
  secondaryLabel?: string
  amountLabel?: string
  statusColumnLabel?: string
  rows: RecordRow[]
}) {
  const hasSecondary = rows.some((r) => r.secondary !== undefined)
  const hasAmount = rows.some((r) => r.amount !== undefined)

  // Column heads carry the register's label voice: SMALL CAPS WITH WIDE
  // TRACKING under Ledger (--label-transform: uppercase), plain sentence case
  // under Hearth and Blueprint (--label-transform: none). Applying both tokens
  // unconditionally is correct — each style's own value decides the outcome.
  const headCell =
    "border-b text-left align-middle [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)] " +
    "[border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] " +
    "[font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] " +
    "[letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]"

  const bodyCell =
    "align-middle [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)] [height:var(--row-h)]"

  return (
    <DataGrid id={gridId} label={caption}>
      <table className="w-full min-w-[520px] border-collapse [font-size:var(--text-sm)]">
        <thead>
          <tr className="sticky top-0 [background-color:var(--color-ink-900)]">
            <th className={headCell}>{primaryLabel}</th>
            {hasSecondary && <th className={headCell}>{secondaryLabel}</th>}
            {hasAmount && <th className={`${headCell} !text-right`}>{amountLabel}</th>}
            <th className={headCell}>{statusColumnLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="[&:not(:last-child)]:border-b [&:not(:last-child)]:[border-color:var(--color-ink-800)]"
            >
              <td className={`${bodyCell} [color:var(--color-paper)] [font-weight:var(--fw-medium)]`}>
                {row.primary}
              </td>
              {hasSecondary && (
                <td className={`${bodyCell} [color:var(--color-paper-dim)]`}>{row.secondary}</td>
              )}
              {hasAmount && (
                // --font-numeric is a mono face under Ledger and Blueprint and
                // the rounded UI face under Hearth, which deliberately has no
                // mono anywhere: a monospaced figure is a precision signal, and
                // precision is not that register's job.
                <td
                  className={`${bodyCell} text-right tabular-nums [color:var(--color-paper)] [font-family:var(--font-numeric)]`}
                >
                  {row.amount}
                </td>
              )}
              <td className={bodyCell}>
                <StatusDot tone={row.statusTone} label={row.statusLabel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataGrid>
  )
}
