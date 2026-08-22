// "use client" BECAUSE THIS COMPONENT NOW READS THE REGISTER. An absent variant
// prop means "follow the 版式", which is a React context lookup, and a context
// cannot be read from a server component. The portal's page route renders Puck's
// <Render> on the SERVER -- the editor is a client tree, but the saved page is
// not -- so without this the first paint of every customer page threw. Nothing
// else here needs the client; the props are all serialisable data.
"use client"

import type { CSSProperties } from "react"
import { useRegisterProp } from "@/design-system/editor/style-scope"
import { DataGrid } from "./data-grid"
import { StatusDot, type StatusTone } from "./status-dot"
import { normalizeTable, type ColumnKind, type TableModel } from "@/lib/portal/table-model"

export type { TableModel }

/**
 * A real, Puck-friendly data table for business records (quotations,
 * customers, payments) — sits on top of `DataGrid` (a scroll-viewport
 * wrapper, not a table itself) and `StatusDot` (already registered), rather
 * than reinventing either.
 *
 * COLUMNS ARE DATA, NOT PROPS. This component used to take four fixed label
 * props, which made the column COUNT part of its type: a customer could rename
 * 「金额」 and never add 「负责的师傅」, and the assistant had to refuse the
 * request because no operation could express it. `table` is now
 * `{ columns, rows }` and everything here is driven by that array — see
 * lib/portal/table-model.ts for the shape and for why the old four props are
 * still readable rather than migrated in SQL.
 *
 * The legacy props are accepted and normalised here as well as on load, so a
 * layout that reaches this component through a path that forgot to upgrade it
 * (a preview, a cached draft) still renders the customer's real data instead of
 * an empty table.
 *
 * DENSITY: every measurement here comes from the style's own axis tokens
 * rather than a Tailwind literal, so the same table renders as a tight
 * 32px-row ops grid under Ledger and a 52px-row airy list under Hearth. A
 * table is where a register's density is most visible, so this is the one
 * component where getting it from tokens matters most.
 */

/** Per-kind width contribution to the table's minimum. A name needs more room
 *  than a status pill, and a table that has grown to seven columns must scroll
 *  rather than compress every column into unreadability — which is what
 *  DataGrid's scroll viewport and edge shadow exist for. */
const KIND_MIN: Record<ColumnKind, number> = {
  text: 130,
  detail: 120,
  amount: 95,
  status: 95,
}

export function RecordTable(props: {
  gridId: string
  caption: string
  table?: TableModel
  /** Legacy four-column shape. Still read (see table-model.ts) so no saved
   *  layout can render blank; never written by anything current. */
  primaryLabel?: string
  secondaryLabel?: string
  amountLabel?: string
  statusColumnLabel?: string
  rows?: unknown[]
  /** Set by the 换个款式 picker. `plain` is a rule between rows; `compact`
   *  is the same table at three-quarter height for a page that has to show
   *  twenty jobs rather than five; `zebra` is the banded look every business
   *  owner already reads in Excel; `grid` rules the columns as well, for a
   *  table that is being copied from or checked against paper. */
  look?: "plain" | "compact" | "zebra" | "grid"
}) {
  const { gridId, caption, look } = props
  // Absent means "follow the register", not "plain" -- see style-scope.tsx.
  const shown = look ?? useRegisterProp<"plain" | "compact" | "zebra" | "grid">("RecordTable", "look") ?? "plain"
  const { columns, rows } = normalizeTable(props as unknown as Record<string, unknown>)

  // Column heads carry the register's label voice: SMALL CAPS WITH WIDE
  // TRACKING under Ledger (--label-transform: uppercase), plain sentence case
  // under Hearth and Blueprint (--label-transform: none). Applying both tokens
  // unconditionally is correct — each style's own value decides the outcome.
  const headCell =
    "border-b text-left align-middle [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)] " +
    // The head's colours come from tokens rather than from a hard-coded pair,
    // so a register can fill the band instead of ruling it. Seven of the eight
    // declare the same values this used to hard-code, so nothing moved; 印头
    // fills it. See design-system/tokens/stamp.css.
    "[border-color:var(--color-ink-800)] [color:var(--color-table-head-fg)] " +
    "[font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] " +
    "[letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]"

  const bodyCell =
    "align-middle [padding-inline:var(--pad-cell-x)] " +
    "[padding-block:var(--row-pad-y,var(--pad-cell-y))] [height:var(--row-height,var(--row-h))]" +
    // Column rules stop before the last cell, or the table grows a right-hand
    // border that does not line up with the card edge behind it.
    (shown === "grid" ? " [&:not(:last-child)]:border-r [&:not(:last-child)]:[border-color:var(--color-ink-800)]" : "")

  // Computed, not the old flat 440 — but tuned so the DEFAULT four columns
  // still add up to exactly that. The narrowest real case is the editor with a
  // side panel open: a 1440px window gives the canvas 782, the customer's own
  // rail takes 228 and the shell's padding another 48, leaving ~460px for the
  // table. Four columns fit that; a fifth the customer added cannot, and must
  // widen the table and scroll — silently squeezing 状态 in half is the exact
  // defect that has already been fixed twice by widening things.
  const minWidth = columns.reduce((w, c) => w + KIND_MIN[c.kind], 0)

  return (
    // `revealEndWhen`: adding a column in a 460px-wide canvas puts the new
    // column past the right edge, so the customer's own action appeared to do
    // nothing. The grid scrolls to show it. Measured, not assumed — this was
    // visible in the first browser check of the column editor.
    <DataGrid id={gridId} label={caption} revealEndWhen={columns.length}>
      <table
        className="w-full border-collapse [font-size:var(--text-sm)]"
        style={
          shown === "compact"
            ? ({
                minWidth: `${minWidth}px`,
                // Multipliers, not pixels -- see this component's `look` note.
                // Distinct names: a property that reads itself is a cycle and
                // CSS discards the whole declaration, which would have left
                // 紧凑 silently identical to 正常.
                "--row-height": "calc(var(--row-h) * 0.72)",
                "--row-pad-y": "calc(var(--pad-cell-y) * 0.5)",
              } as CSSProperties)
            : { minWidth: `${minWidth}px` }
        }
      >
        <thead>
          <tr className="sticky top-0 [background-color:var(--color-table-head-bg)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.kind === "amount" ? `${headCell} !text-right` : headCell}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={
                // Bands and rules are alternatives, not additions: a zebra
                // table with a rule under every row is two separators doing
                // one job, and reads as noise at the row heights these tables
                // actually run at.
                shown === "zebra"
                  ? "even:[background-color:var(--color-ink-850)]"
                  : "[&:not(:last-child)]:border-b [&:not(:last-child)]:[border-color:var(--color-ink-800)]"
              }
            >
              {columns.map((col) => {
                const value = row.cells?.[col.key] ?? ""
                if (col.kind === "status") {
                  return (
                    <td key={col.key} className={bodyCell}>
                      {value ? (
                        <StatusDot
                          tone={(row.tones?.[col.key] as StatusTone) ?? "neutral"}
                          label={value}
                        />
                      ) : null}
                    </td>
                  )
                }
                if (col.kind === "amount") {
                  // --font-numeric is a mono face under Ledger and Blueprint and
                  // the rounded UI face under Hearth, which deliberately has no
                  // mono anywhere: a monospaced figure is a precision signal, and
                  // precision is not that register's job.
                  return (
                    <td
                      key={col.key}
                      className={`${bodyCell} text-right tabular-nums [color:var(--color-paper)] [font-family:var(--font-numeric)]`}
                    >
                      {value}
                    </td>
                  )
                }
                if (col.kind === "detail") {
                  return (
                    <td key={col.key} className={`${bodyCell} [color:var(--color-paper-dim)]`}>
                      {value}
                    </td>
                  )
                }
                return (
                  <td
                    key={col.key}
                    className={`${bodyCell} [color:var(--color-paper)] [font-weight:var(--fw-medium)]`}
                  >
                    {value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </DataGrid>
  )
}
