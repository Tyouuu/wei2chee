import type { ReactNode } from "react"

/**
 * 一大两小 — one block given the room, two beside it.
 *
 * ── WHY IT IS NOT Columns WITH A NESTED Columns ──────────────────────────
 *
 * That arrangement exists and is wrong here. Nesting a two-row split inside
 * one half of a two-column split gives the two small blocks a height each of
 * "whatever they need", so the right-hand stack ends short of the left-hand
 * block and the row reads as a card that failed to fill. What a bento IS, and
 * the only reason the shape is worth having, is that the cells are cut from
 * one rectangle: the big one is exactly as tall as the two small ones plus the
 * gap between them, because the grid says so rather than because the content
 * happened to agree.
 *
 * `grid-template-rows: 1fr 1fr` with the lead spanning both is the whole
 * mechanism, and it is why this is fifteen lines rather than a layout engine.
 *
 * ── WHY THREE CELLS AND NOT n ────────────────────────────────────────────
 *
 * Four small cells beside one large is a dashboard, and we have one of those
 * already -- it is called StatRow and it is better at it. What this shape adds
 * to a business system is exactly one thing: a chart, a table or a board that
 * needs the width, with two things that do not sitting beside it. That is
 * three, and a fourth would only ever be somebody filling the grid.
 *
 * ── ONE COLUMN BELOW md ──────────────────────────────────────────────────
 *
 * Same threshold and the same reason as columns.tsx: a bento cell on a 390px
 * phone is a card 180px wide, which is narrower than the figure inside it. The
 * shape stops being an arrangement and becomes a squeeze, and stacking is what
 * the customer would have drawn anyway.
 */
export function Bento({
  lead,
  a,
  b,
}: {
  /** The block that needs the room — a chart, a table, a board. */
  lead?: ReactNode
  a?: ReactNode
  b?: ReactNode
}) {
  return (
    <div
      className="grid [gap:var(--gap-section)] @3xl:[grid-template-columns:1.6fr_1fr] @3xl:[grid-template-rows:1fr_1fr]"
    >
      {/* min-w-0 for the same reason every Columns cell has it: a wide table
          inside a grid track reports its full content width as the track's
          minimum and pushes everything else off the page.

          min-h-0 as well, which Columns does not need: these cells have a
          DEFINITE height from the row template, and without it a tall child
          (a table with eight rows) grows the track instead of scrolling inside
          the cell it was given. */}
      <div className="flex min-h-0 min-w-0 flex-col @3xl:row-span-2 [&>*]:flex-1 [&>*>*]:h-full [&>*>*>*]:h-full">
        {lead}
      </div>
      <div className="flex min-h-0 min-w-0 flex-col [&>*]:flex-1 [&>*>*]:h-full [&>*>*>*]:h-full">
        {a}
      </div>
      <div className="flex min-h-0 min-w-0 flex-col [&>*]:flex-1 [&>*>*]:h-full [&>*>*>*]:h-full">
        {b}
      </div>
    </div>
  )
}
