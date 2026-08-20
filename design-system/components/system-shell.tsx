import type { ReactNode } from "react"

/**
 * The page shell every generated system page is built inside: a navigation
 * column beside a content column.
 *
 * WHY IT EXISTS: Puck's canvas is a single vertical stack, and a sidebar is not
 * a stackable block. Placing RailNav as the first item in a page's `content`
 * put a full-viewport-height nav ABOVE everything else, pushing the page header,
 * the headline figure, the pipeline and the table a full screen below the fold.
 * Verified in a real browser, not reasoned about: all five components rendered
 * correctly, at x=412, y=172 / 1172 / 1243 / 1348 / 1471 -- a customer opening
 * their new system saw a sidebar and nothing else.
 *
 * The fix is structural, not cosmetic. This component owns the two-column
 * relationship, and its two Puck `slot` fields make each column a real drop
 * target, so a customer can still drag blocks into either side and reorder
 * them. That is closer to how they actually think about their system ("this bit
 * is the menu, this bit is the page") than one flat list ever was.
 */
export function SystemShell({
  sidebar,
  main,
}: {
  sidebar: ReactNode
  main: ReactNode
}) {
  return (
    <div className="flex min-h-full w-full items-stretch [background-color:var(--color-canvas)]">
      {/* `shrink-0` matters: RailNav sets its own width, and without this the
          flex row compresses it into an unreadable sliver as the main column's
          table grows.

          THE GROUND IS PAINTED HERE, not only on the rail itself, and that is
          deliberate. `items-stretch` gives this wrapper the shell's full
          height, but the rail inside it cannot inherit that height when Puck is
          driving: Puck inserts a drop zone AND a per-item wrapper between the
          two, both `height: auto`, and a percentage height needs a definite
          ancestor to resolve against. Measured on a real page: wrapper 661px,
          rail 387px -- a dark column that stopped two thirds of the way down
          with bare canvas below it.

          Turning those wrappers into flex containers would fix the chain and
          would also change the boxes Puck positions its own drag placeholders
          against, to fix something the customer only ever sees as a colour. So
          the colour is applied to the box that already has the right height,
          and the rail keeps its own matching background for when it is used
          outside this shell. Same token, so the join is invisible. */}
      <div className="flex shrink-0 [background-color:var(--color-nav-bg)]">{sidebar}</div>

      {/* `min-w-0` is what lets the record tables inside scroll horizontally
          instead of forcing the whole shell wider than the viewport. */}
      <div className="flex min-w-0 flex-1 flex-col [gap:var(--gap-stack)] [padding:var(--pad-card-lg)]">
        {main}
      </div>
    </div>
  )
}
