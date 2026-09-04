import type { ReactNode } from "react"

/**
 * Two or three things side by side.
 *
 * WHY THIS EXISTS. Until now every page a customer could build was one
 * vertical stack: `SystemShell` splits the screen into a rail and a main
 * area, and everything inside `main` piles up in a single column. That makes
 * the most ordinary business layout there is — a form on the left, the record
 * it belongs to on the right — impossible to express. A contractor who wants
 * 「左边填资料、右边看报价」 has no way to say it.
 *
 * WHY NOT THE ONE FROM THE REGISTRY. `@ilinxa/split-workspace` does this and
 * far more: 22 files of resizable panes, corner and edge drag gestures, a
 * component picker, layout presets. That is an IDE workspace. A customer
 * arranging a quotation page does not want to discover pane-splitting
 * gestures, and we would be maintaining 70KB to get one flex row. Pulled it,
 * read it, deleted it, wrote this instead.
 *
 * The proportions are named rather than numeric because the customer is
 * choosing a shape, not a percentage: 「对半」 is what you want when the two
 * halves are equally important, 「左宽」 when one side is the work and the
 * other is a summary beside it.
 */

export type ColumnsLayout = "half" | "wide-left" | "wide-right" | "thirds"

/*
  minmax(0, …) AND NOT PLAIN fr.

  A `1fr` track is `minmax(auto, 1fr)`, and `auto` as a minimum means the track
  refuses to shrink below its content -- so a wide block does not scroll inside
  its half, it makes its half wider and pushes the other one off.

  ActivitySquares is 53 weeks of 11px squares, about 740px. It has carried
  `w-full overflow-x-auto` since 2026-08-25 with a comment saying it was put
  there for exactly this, and that scroller could never fire. Screenshotted on
  台账 three times: the heatmap ran past its edge and painted over the workflow
  strip beside it, and `min-w-0` on the cell and then on the Panel each fixed
  one more box in a chain whose FIRST link was this line.

  Every box between a scroller and its container has to agree to shrink. The
  track is a box.
*/
const TEMPLATE: Record<ColumnsLayout, string> = {
  half: "minmax(0, 1fr) minmax(0, 1fr)",
  "wide-left": "minmax(0, 2fr) minmax(0, 1fr)",
  "wide-right": "minmax(0, 1fr) minmax(0, 2fr)",
  thirds: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
}

/**
 * A cell that its card actually fills.
 *
 * MEASURED, not reasoned. Probing the live Console dashboard: the cell was
 * 278px, Puck's DropZone inside it correctly took `flex: 1 1 0%` and was also
 * 278px -- and the plain wrapper div Puck puts around each item stayed at 178,
 * because a block-level DropZone does not stretch its children. So the card
 * ended 100px short and the column had bare ground under it.
 *
 * Hence three levels rather than one: the slot's own wrapper, Puck's item
 * wrapper, and the block. Each is inert when nothing above it has a height,
 * which is every use outside a split.
 *
 * 🔴 `:only-child` ON THE DEEPEST LEVEL, and it is load-bearing.
 *
 * That chain counts three wrappers because the EDITOR has three. `<Render>`
 * has two -- Puck adds no per-item wrapper outside the editor -- so on a
 * published page, in the supervisor's view, and on a phone, the third level
 * lands one box too deep: on the SECTIONS INSIDE the block rather than on the
 * block.
 *
 * Measured at 390 on the clients page, 2026-09-04. RecordTable stacks four
 * sections whose natural heights are 24 / 38 / 606 / 20. With `h-full` on each
 * of them, the flex column takes its height from content (736) and then hands
 * every child `height: 736` -- so flexbox shrinks them back to 173 / 173 / 174
 * / 186. **Seven customers ended up inside a 174px window with its own
 * scrollbar, under 321px of blank.**
 *
 * The comment above already stated the intent -- "inert when nothing above it
 * has a height" -- and `height: 100%` does not deliver it here, because the
 * height it copies is one the content itself produced. `:only-child` does:
 * a block is the only thing in its wrapper, a block's own sections never are.
 */
const CELL =
  "min-w-0 flex flex-col [&>*]:flex-1 [&>*>*]:h-full [&>*>*>*:only-child]:h-full";

export function Columns({
  layout = "half",
  a,
  b,
  c,
}: {
  layout?: ColumnsLayout
  a?: ReactNode
  b?: ReactNode
  /** Only rendered by the three-column layout; ignored by the other three so
   *  that switching back to two columns does not silently drop what is in it. */
  c?: ReactNode
}) {
  const three = layout === "thirds"

  return (
    // Below `md` every layout collapses to one column. A 2fr/1fr split on a
    // 390px phone gives a 240px column beside a 120px one, which is narrower
    // than a date field — the split stops being a layout and becomes a
    // squeeze. Stacking is what the customer would have drawn anyway.
    <div
      className="grid [gap:var(--gap-section)] @3xl:[grid-template-columns:var(--cols)]"
      style={{ ["--cols" as string]: TEMPLATE[layout] }}
    >
      {/* min-w-0 on every cell: a wide table inside a grid track reports its
          full content width as the track's minimum and pushes the other
          column off the page.

          flex-col + flex-1 on the child: a grid TRACK stretches, but the card
          inside it does not, so a three-row ranking beside a chart drew a
          short card with a hundred pixels of bare ground under it. Every admin
          template this is modelled on -- Ant Design Pro, Tabler, AdminLTE --
          makes the pair the same height, and the reason is visible the moment
          they are not: two cards of different heights read as one card and one
          mistake. */}
      <div className={CELL}>{a}</div>
      <div className={CELL}>{b}</div>
      {three ? <div className={CELL}>{c}</div> : null}
    </div>
  )
}
