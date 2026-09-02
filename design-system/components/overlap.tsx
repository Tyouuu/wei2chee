import type { ReactNode } from "react"

/**
 * 层叠 — one block riding up over the band above it.
 *
 * ── WHAT THIS IS NOT, AND WHY ────────────────────────────────────────────
 *
 * 「层叠」 could mean cards scattered at offsets over each other, which is what
 * the word usually buys on a landing page. In a business system it is wrong,
 * and not as a matter of taste: every block on these pages is a live surface
 * with real records in it, and two of them overlapping means one is covering
 * rows the owner needs to read. It also cannot survive its own content — a
 * table that grows to nine rows slides under the card sitting on it, and the
 * page that looked composed in a screenshot is broken by Thursday.
 *
 * So the layering here is the one version that is structural rather than
 * decorative, and it is the one every reference page uses: a coloured band at
 * the top of the page, and the FIRST block pulled up so it sits half on the
 * band and half on the page. Stripe, Vercel and Linear all open this way.
 * Nothing is covered — the band is a ground, not content — and it survives any
 * amount of content below it, because only the top edge is involved.
 *
 * ── WHY THE BAND IS DRAWN HERE AND NOT ON PageHeader ─────────────────────
 *
 * The band and the overlap are one gesture: the band's height IS the overlap,
 * and splitting them across two components means two numbers that have to
 * agree, kept in different files, and they will not. A band with nothing
 * riding on it is a coloured strip nobody asked for.
 */

export function Overlap({
  /** How far the riding block sits ON the band, in px. */
  rise = 44,
  /** What the band is drawn behind — the page's title and its action. A band
   *  with nothing in it is a strip; a band with the heading in it is the top of
   *  the page. This is the difference between the first version of this
   *  component and the one that shipped: with only the block riding on it, the
   *  screenshot read as 「一条色带上面压着一张卡」 rather than as one composition. */
  band,
  children,
}: {
  rise?: number
  band?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative">
      {/* THE BAND. `--color-primary-soft` rather than the accent itself: every
          register tuned that value to sit just above its own page background,
          so this is a step and never a slab. A register whose whole argument is
          restraint (瑞士, 大字) gets a band you can barely see, which is the
          correct amount of band for it.

          ⚠️ EXCEPT WHERE THE PRIMARY IS A STRONG HUE. 招牌's primary is a sign
          red, so its `soft` step is #fbe8ea -- and across the top of a whole
          page that stops being a step and becomes a pink field. Photographed
          2026-09-02, and the founder had just said 「就跟着白色跟黑色做」.
          A register can now name its own band; the default is unchanged, so
          the five that were right stay exactly as they were. */}
      {/* The band is sized by its CONTENT plus the rise, not by a constant, so
          a two-line page title and a one-line one both get a band that ends
          exactly `rise` px into the block below. Two numbers that have to agree
          become one measurement. */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 bottom-0 -mx-[var(--pad-card-lg)] -mt-[var(--pad-card-lg)] [background:var(--color-band,var(--color-primary-soft))]"
          style={{ bottom: -rise }}
        />
        {/*
          THE BAND CARRIES THE PANEL'S INK, NOT THE PAGE'S.

          Photographed on 漆, 2026-08-26: the page title 「Overview」 was pale
          pink on a pale pink band -- the single most important line on the
          screen, invisible. Nothing was broken; two correct decisions simply
          met. 漆's canvas is a dark lacquer red, so PageHeader draws its title
          in --color-on-canvas, which is light and right for that ground. The
          band is --color-primary-soft, which every register tunes to sit one
          step off its own PANEL. Light ink, light band.

          --color-primary-soft is a panel-lightness surface in all seventeen
          registers -- pale in sixteen, and on 夜 a translucent warm tint over a
          dark ground -- and --color-paper is by definition the ink that reads
          on a panel. So the band re-points the on-canvas family at it, the same
          token remap SystemShell's light navTone already makes on the rail.
          Nothing in PageHeader has to know: custom properties inherit, and the
          nearest definition wins.
        */}
        <div
          className="relative"
          style={{
            ["--color-on-canvas" as string]: "var(--color-paper)",
            ["--color-on-canvas-dim" as string]: "var(--color-paper-dim)",
          }}
        >
          {band}
        </div>
      </div>
      {/* `relative` so it draws above the band without a z-index arms race. */}
      <div className="relative">{children}</div>
    </div>
  )
}
