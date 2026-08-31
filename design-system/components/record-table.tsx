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
import { useSystemWords } from "@/design-system/system-lang-context"
import { Avatar } from "@/design-system/components/avatar"
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
  /**
   * WHAT A ROW CONTAINS -- a second, independent axis.
   *
   * `look` says how rows are SEPARATED (a rule, a band, column lines, less
   * height). Measured on 2026-08-25, eight of eighteen registers chose `plain`
   * on it, because separation is a small question and most briefs have no
   * opinion. This axis asks a different one and gets different answers: a
   * status can be a dot with a word beside it or a filled pill, and a person
   * can be a name or a name with a face.
   *
   * Both of the dashboards the founder sent that day differ from us here and
   * not on separation -- shadcn-admin puts an initials circle on every row of
   * Recent Sales, Ant Design Pro puts a filled badge on every status.
   */
  row?: "plain" | "pill" | "avatar"
  /** Segment labels shown above the table, after an "All" the component adds
   *  itself. Inert in the preview — the finished system wires them to queries.
   *  Empty or absent means no segment row, which is right for a table that is
   *  already the whole of its page. */
  filters?: string[]
}) {
  const { gridId, caption, look, row, filters } = props
  const w = useSystemWords()
  // Absent means "follow the register", not "plain" -- see style-scope.tsx.
  /*
    THE HOOK IS CALLED UNCONDITIONALLY, THE FALLBACK IS APPLIED AFTER.

    This read `prop ?? useRegisterProp(...) ?? default` on one line, which is
    the precedence rule stated exactly right and executed exactly wrong: `??`
    SHORT-CIRCUITS, so when the customer's own prop is present the hook is
    never called. useRegisterVariant is useContext + useMemo -- two hook slots
    -- so the number of hooks this component calls changed with its props.
    React matches hooks positionally, so that is either "rendered fewer hooks
    than expected" or, worse, a memo silently read from the wrong slot; in
    RecordTable, where there were TWO of these in a row, the second could take
    the first one's place.

    Splitting the line changes no semantics -- the hook is pure and its result
    is still the middle term of the same precedence chain -- and it makes the
    hook count constant. Found by `npm run lint`, which had never once run:
    there was no eslint config in the repository, so `react-hooks/rules-of-hooks`
    has been switched off for this codebase's entire life.
  */
  const lookPref = useRegisterProp<"plain" | "compact" | "zebra" | "grid">("RecordTable", "look")
  const shown = look ?? lookPref ?? "plain"
  // "RecordTableRow", NOT "RecordTable". A register's preference is a VARIANT
  // ID, and the id is looked up in VARIANTS under the same key -- so two axes
  // on one component need two keys, or the second silently reads the first
  // one's props and finds nothing. This is the same class of failure as the
  // 315 preferences that reached nothing before 2026-08-23, and it is silent
  // in exactly the same way: the table renders, it just renders the default.
  const rowPref = useRegisterProp<"plain" | "pill" | "avatar">("RecordTableRow", "row")
  const rowShape = row ?? rowPref ?? "plain"
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
    <div className="flex flex-col [gap:var(--gap-inline)]">
      {/* THE TABLE'S HEADING, WHICH UNTIL 2026-08-25 NOBODY COULD SEE.
          `caption` was passed straight into DataGrid as an accessible name and
          rendered nowhere, so every table in every register shipped with no
          title, no count and no filters — while all eleven competitors
          photographed that day carry a heading, a total and a segment row
          above theirs. It was the cheapest missing thing on the page: the
          string was already being computed and already being passed in.

          The count is derived, never given: a caller who passes a number and a
          list can disagree with itself, and it is the list that is on screen. */}
      <div className="flex flex-wrap items-center [gap:var(--gap-inline)]">
        <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
          {caption}
        </span>
        <span className="tnum [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
          {w.rowCount(rows.length)}
        </span>
        {filters?.length ? (
          <div
            className="ms-auto flex overflow-hidden [border:var(--border-card-width)_solid_var(--border)] [border-radius:var(--radius-control)]"
            role="group"
          >
            {[w.filterAll, ...filters].map((f, i) => (
              <span
                key={f}
                className={`whitespace-nowrap [font-size:var(--text-xs)] [padding-block:2px] [padding-inline:var(--pad-control-x)] ${
                  i === 0
                    ? "[background:var(--color-primary-soft)] [color:var(--color-primary)] [font-weight:var(--fw-medium)]"
                    : "[color:var(--color-paper-dim)]"
                }`}
              >
                {f}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* `revealEndWhen`: adding a column in a 460px-wide canvas puts the new
          column past the right edge, so the customer's own action appeared to do
          nothing. The grid scrolls to show it. Measured, not assumed — this was
          visible in the first browser check of the column editor. */}
      <DataGrid id={gridId} label={caption} revealEndWhen={columns.length}>
      <table
        className="w-full border-collapse [background-color:var(--color-table-bg)] [font-size:var(--text-sm)]"
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
                  const tone = (row.tones?.[col.key] as StatusTone) ?? "neutral"
                  return (
                    <td key={col.key} className={bodyCell}>
                      {value ? (
                        rowShape === "pill" ? (
                          <Pill tone={tone} label={value} />
                        ) : (
                          <StatusDot tone={tone} label={value} />
                        )
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
                      {rowShape === "avatar" && value ? (
                        <span className="flex items-center [gap:var(--gap-inline)]">
                          {/*
                            THE FACE BELONGS TO THE PERSON, NOT TO THE CELL.

                            This read `name={value}` -- the DETAIL cell -- so the
                            initials were taken from whatever happened to be in
                            the second column. With the sample rows that looked
                            plausible (「Taman Desa · 013-2xx xxxx」 -> Ta); with a
                            business's real customers, where that column is a
                            composed contact line, 陈先生 got a badge reading
                            「06」 and 建材行 A got 「王·」.

                            Found by looking at the page on the day directory
                            went live. Twenty-nine database assertions and the
                            whole unit suite were green -- none of them can see
                            two digits of a phone number in a circle.
                          */}
                          <Avatar name={String(row.cells?.primary || value)} size={24} />
                          <span className="truncate">{value}</span>
                        </span>
                      ) : (
                        value
                      )}
                    </td>
                  )
                }
                return (
                  <td
                    key={col.key}
                    className={`${bodyCell} [color:var(--color-paper)] [font-weight:var(--fw-medium)]`}
                  >
                    {/*
                      A REAL RECORD OPENS; A SAMPLE DOES NOT.

                      `row.href` is set only by the live-rows projection, so a
                      demonstration table has nothing to click and a business's
                      own row can be opened and fixed. An anchor rather than a
                      control on purpose: this table is drawn in the style
                      gallery, in hundreds of thumbnails and on paper, where
                      there is no session -- a link is inert in all of them and
                      a button would not be.

                      Only the first column. A row of four links is four
                      answers to one question, and the underline would fight
                      the amount column's alignment.
                    */}
                    {row.href && col.key === "primary" && value ? (
                      <a
                        href={row.href}
                        className="underline decoration-[color:var(--color-ink-700)] underline-offset-[3px] hover:decoration-[color:var(--color-primary)]"
                      >
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </DataGrid>
    </div>
  )
}

/**
 * A filled status, for the registers whose briefs are loud enough to carry one.
 *
 * WHY NOT REUSE Tag. Tag is a label the customer writes -- 「加急」, 「熟客」 --
 * and its tones are chosen by hand. This one reads the row's own status tone,
 * so a table can never show a green pill on a row the dot would have shown red
 * on. Same tones, one source.
 *
 * The fill is the status colour at low opacity rather than a second token per
 * tone: every register already defines these four, and a --*-soft for each
 * would be sixteen new declarations to keep in step with four that already
 * exist.
 */
const PILL_TONE: Record<string, string> = {
  positive: "var(--color-jade-bright)",
  warning: "var(--color-brass-bright)",
  negative: "var(--color-clay-bright)",
  neutral: "var(--color-slate-bright)",
}

function Pill({ tone, label }: { tone: StatusTone; label: string }) {
  const c = PILL_TONE[tone] ?? PILL_TONE.neutral
  return (
    <span
      className="inline-flex max-w-full items-center truncate whitespace-nowrap [border-radius:var(--radius-control)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [padding-block:2px] [padding-inline:var(--pad-control-x)]"
      /*
        THE LABEL IS NEVER THE TONE, AND THIS FILE'S SIBLING SAYS SO.

        status-dot.tsx, three files over, argues it in its own header: 「A label
        that also takes the hue is the weakest-contrast text on the page for
        something meant to be read.」 The dot obeys it; this pill did not -- it
        painted the label in the status colour at --text-xs, which measured
        2.56:1 for 「Awaiting reply」 and 2.74:1 for 「Confirmed」 on 中台's
        table band. Both are STATES OF HIS OWN JOBS, at 11.5px.

        The tone still says everything it said: it is the fill and the border,
        which is what makes a pill a pill. Only the words moved to reading
        contrast, and they are mixed a quarter of the way back toward the tone
        so the chip keeps its character.
      */
      style={{
        color: `color-mix(in oklab, ${c} 25%, var(--color-paper))`,
        background: `color-mix(in oklab, ${c} 14%, transparent)`,
        border: `var(--hairline) solid color-mix(in oklab, ${c} 32%, transparent)`,
      }}
    >
      {label}
    </span>
  )
}
