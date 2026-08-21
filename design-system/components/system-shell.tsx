import type { ReactNode } from "react"
import { NavAxisProvider } from "./nav-axis"

/**
 * The page shell every generated system page is built inside: a navigation
 * column beside a content column — or, since 2026-08-21, a navigation BAR
 * above one.
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
 *
 * WHY IT NOW HAS `nav` AND `navTone`: because RailNav grew four variants and
 * two of them are not a dark left column. The shell paints the navigation's
 * ground (see the long note below) and decides its axis, so neither of those
 * facts can live inside the rail alone. They are two fields on the shell rather
 * than one on the rail because they are properties of the PAGE -- where the
 * navigation sits, and what the strip it sits on is made of.
 */
export function SystemShell({
  sidebar,
  main,
  nav = "side",
  navTone = "dark",
}: {
  sidebar: ReactNode
  main: ReactNode
  /** Where the navigation sits. Pair `"top"` with RailNav's `variant="topbar"`;
   *  the two are a matched set and neither reads right without the other. */
  nav?: "side" | "top"
  /** What the navigation's ground is made of. `"dark"` is the register's own
   *  nav ground; `"light"` runs the navigation on the same paper as the page,
   *  separated by a hairline instead of by a colour. */
  navTone?: "dark" | "light"
}) {
  const isTop = nav === "top"

  /*
   * THE LIGHT NAVIGATION IS A TOKEN REMAP, NOT A SECOND RAIL.
   *
   * Every one of the three registers gives its own system a dark navigation
   * ground, and RailNav is written entirely against that `--color-nav-*`
   * family. Adding a light option by branching inside the rail would mean a
   * second copy of every colour decision in a 500-line component, kept in sync
   * by hand for as long as the product exists.
   *
   * So the family is re-pointed here instead, on the one wrapper that owns the
   * navigation's ground: nav-bg becomes the page's own panel, nav-fg becomes
   * its ink. Custom properties inherit and the nearest definition wins, so the
   * rail inside reads the new values without knowing anything happened — the
   * same mechanism that lets three customer registers and Formae's own chrome
   * share one component set.
   *
   * The accent becomes `--color-primary` because `--color-nav-accent` is
   * tuned for legibility on a dark ground and measures badly on paper: in
   * Ledger it is #f39158 on #14273d, which on #ffffff drops to 2.2:1.
   */
  const navVars =
    navTone === "light"
      ? ({
          backgroundColor: "var(--color-ink-900)",
          "--color-nav-bg": "var(--color-ink-900)",
          "--color-nav-bg-deep": "var(--color-ink-900)",
          "--color-nav-fg": "var(--color-paper)",
          "--color-nav-fg-dim": "var(--color-paper-dim)",
          "--color-nav-hover": "var(--color-ink-850)",
          "--color-nav-active": "var(--color-ink-950)",
          "--color-nav-border": "var(--color-ink-800)",
          "--color-nav-accent": "var(--color-primary)",
        } as React.CSSProperties)
      : ({ backgroundColor: "var(--color-nav-bg)" } as React.CSSProperties)

  return (
    <div
      className={`flex min-h-full w-full [background-color:var(--color-canvas)] ${
        isTop ? "flex-col" : "items-stretch"
      }`}
    >
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
          outside this shell. Same token, so the join is invisible.

          It is a style attribute rather than a class because the value is now a
          choice (`navTone`) and there is no arbitrary-value syntax that takes a
          variable chosen at runtime. */}
      {/* The axis is published here rather than set on the rail — see
          nav-axis.tsx for the trap that avoids. */}
      <NavAxisProvider value={nav}>
        <div className={isTop ? "flex w-full shrink-0" : "flex shrink-0"} style={navVars}>
          {sidebar}
        </div>
      </NavAxisProvider>

      {/* `min-w-0` is what lets the record tables inside scroll horizontally
          instead of forcing the whole shell wider than the viewport. */}
      <div className="flex min-w-0 flex-1 flex-col [gap:var(--gap-stack)] [padding:var(--pad-card-lg)]">
        {main}
      </div>
    </div>
  )
}
