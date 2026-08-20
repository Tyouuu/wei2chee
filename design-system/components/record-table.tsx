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
 * AI-filled industry template edits — the shape Puck's `array` field type
 * can represent (primitives only, no ReactNode), unlike `DataGrid` itself
 * which takes an arbitrary `<table>` as `children` and can't be driven by
 * Puck's field data directly.
 *
 * `docs/portal-editor-known-issues.md`'s correction (2026-08-20): this is
 * the real "quotation table" component that was previously assumed to
 * already exist as `data-grid.tsx` -- it didn't, this is that component.
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

  return (
    <DataGrid id={gridId} label={caption}>
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="sticky top-0 [background-color:var(--color-ink-900)]">
            <th className="border-b px-4 py-2.5 text-left [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">
              {primaryLabel}
            </th>
            {hasSecondary && (
              <th className="border-b px-4 py-2.5 text-left [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">
                {secondaryLabel}
              </th>
            )}
            {hasAmount && (
              <th className="border-b px-4 py-2.5 text-right [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">
                {amountLabel}
              </th>
            )}
            <th className="border-b px-4 py-2.5 text-left [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">
              {statusColumnLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="[&:not(:last-child)]:border-b [&:not(:last-child)]:[border-color:var(--color-ink-800)]">
              <td className="px-4 py-2.5 [color:var(--color-paper)] [font-weight:var(--fw-medium)]">{row.primary}</td>
              {hasSecondary && (
                <td className="px-4 py-2.5 [color:var(--color-paper-dim)]">{row.secondary}</td>
              )}
              {hasAmount && (
                <td className="px-4 py-2.5 text-right tabular-nums [color:var(--color-paper)]">{row.amount}</td>
              )}
              <td className="px-4 py-2.5">
                <StatusDot tone={row.statusTone} label={row.statusLabel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataGrid>
  )
}
