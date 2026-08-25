"use client";

import { useEffect, useRef, useState } from "react";
import { Render, type Data } from "@puckeditor/core";
// Renders through the register-aware config, so a block nobody has
// touched takes the shape THIS register prefers. See
// design-system/editor/puck-config-client.tsx.
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";

/**
 * A real, scaled-down render of one of the customer's own pages.
 *
 * WHY A LIVE RENDER AND NOT A DIAGRAM: this is the opposite call from
 * `design-system/editor/component-preview.tsx`, which draws schematics on
 * purpose — and the reason the two differ is worth stating, because one
 * argument decides both.
 *
 * That file previews COMPONENTS inside the editor's own Ledger chrome, where a
 * live render would show a Hearth customer their block in the wrong style: a
 * preview that lies. This file previews the customer's OWN PAGES inside their
 * OWN style scope, so a live render is the only honest option — a diagram of a
 * page they have already edited would be a worse copy of something real. It is
 * also the thing 21st.dev's gallery gets right and every dashboard with
 * placeholder thumbnails gets wrong: the tile IS the product.
 *
 * The page is composed at a desktop width and then scaled, rather than rendered
 * small. Every component sizes itself from density tokens (--row-h,
 * --pad-cell-x, --text-*), so rendering into a 300px box would produce a
 * genuinely different cramped layout instead of a small picture of the real
 * one.
 */

/** The width the page is composed at before scaling — close to what the editor
 *  canvas gives it, so the miniature keeps the proportions the customer saw
 *  while editing. */
const COMPOSE_W = 1180;
/** How much of the page's height the card shows. A page is much taller than a
 *  card; cropping all of them at the same height is what makes a row of cards
 *  read as a row rather than as five different shapes. */
const COMPOSE_H = 720;

/**
 * HOW LONG ONE TRAVEL DOWN THE PAGE AND BACK TAKES.
 *
 * The same for every tile, which is the whole point and is NOT what 21st.dev
 * does — their cards are independent `<video>` elements and a snapshot of the
 * gallery caught them at currentTime 4.4s, 9.9s and 0.7s, all different. That
 * is right for a gallery of unrelated components and wrong here, because the
 * register grid is a COMPARISON: seventeen tiles showing the same page of the
 * same business, and the only question being asked is which design to keep. If
 * they drift apart you are comparing Ledger's table against Hearth's heading.
 *
 * Measured first: this was per-pixel-of-overhang, so a tall page took longer.
 * The first screenshot of it showed Ledger already down at its table while
 * Hearth was still at its top — a grid of seventeen slot machines, which is
 * exactly the failure the old cutting reel had, arrived at from the other
 * direction.
 */
const PAN_MS = 14000;

/** How many of the customer's pages a travelling tile threads together. Three
 *  is roughly 1440 composed pixels of travel, which at PAN_MS is a page every
 *  4.7 seconds — the reading speed measured off 21st.dev's clips. Four made the
 *  loop long enough that a tile could be watched for ten seconds without the
 *  page changing. */
const STRIP_MAX = 3;

/**
 * A FIXED POINT IN TIME, SHARED BY EVERY TILE ON THE PAGE.
 *
 * A constant duration is not enough on its own: each tile only starts
 * animating once its own overhang has been measured, and seventeen scaled page
 * trees do not finish mounting on the same frame. Whoever mounts second starts
 * its loop late and stays late forever.
 *
 * A negative `animation-delay` is the fix, and the only one that does not need
 * a timer: it starts the animation already part-way through. Offsetting every
 * tile by how long it has been since this module loaded snaps them all onto
 * one phase, whenever they happen to mount and however many mount later.
 *
 * IT IS WRITTEN ONTO THE NODE, NOT INTO THE STYLE PROP. `performance.now()` is
 * a different number on the server than in the browser, so putting the delay in
 * the rendered style made React report a hydration mismatch on every tile —
 * caught by the dev overlay, not by review. An effect runs only in the browser,
 * which is also where the clock this reads actually means anything.
 */
const PAN_EPOCH = typeof performance !== "undefined" ? performance.now() : 0;

/**
 * @param data   the page to draw.
 * @param strip  extra pages threaded under it, turning the tile into one
 *               continuous scroll instead of a still. See the note below.
 */
export function PagePreview({
  data,
  strip,
}: {
  data: Data;
  strip?: Data[];
}) {
  /*
    WHY THERE IS A STRIP AT ALL, AND WHY IT IS NOT ONE PAGE PANNING.

    The first version of this travelled down a single page, and the number said
    it should work: the stage reported scrollHeight 1338 against a 720 crop, so
    618 pixels to travel. The screenshot said otherwise — three seconds in, the
    tile was a bare table with half a card of white under it.

    scrollHeight was the wrong ruler. It picks up any inner overflow container,
    and the rail's own `overflow-x-auto` nav was reporting 569 of its own. The
    honest measure is `offsetHeight`, which is layout pixels and immune to the
    parent's scale() — and it says the dashboard at 1180 wide is 733px tall.
    The crop is 720. THE WHOLE PAGE WAS ALREADY IN THE TILE; there was nothing
    below it to travel to, and the pan was panning into blank canvas.

    That also answers the founder's older ask properly. 「客户就可以看到dashboard
    页面啊 其他的页面啊」 — he wanted the other pages, and cutting between them was
    the wrong way to give them. Threading them into one tall stage and scrolling
    it is the right way: every page appears, the dashboard is first, and nothing
    ever cuts.
  */
  const travel = !!strip && strip.length > 0;
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // 0 until measured. Rendering at scale 0 rather than at 1 avoids a single
  // frame of a 1180px-wide page bursting out of a 300px card before the
  // observer fires.
  const [scale, setScale] = useState(0);
  /** Composed pixels of page hanging below the crop. 0 = nothing to travel. */
  const [over, setOver] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // A ResizeObserver rather than a CSS container query: the scale has to be
    // a unitless <number> for transform: scale(), and `calc(100cqw / 1180)`
    // resolves to a length, which scale() rejects. This is the one case where
    // the measurement genuinely has to reach JavaScript.
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / COMPOSE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
    HOW FAR THERE IS TO TRAVEL.

    Only in travel mode, and measured rather than assumed: in the normal mode
    the stage is pinned to COMPOSE_H and there is nothing below the crop by
    construction. A page that turns out to be shorter than the crop reports 0
    and simply sits still -- which is the right answer, not a failure.
  */
  useEffect(() => {
    if (!travel) { setOver(0); return; }
    const el = stageRef.current;
    if (!el) return;
    // offsetHeight, NOT scrollHeight -- see the note in the signature. It is
    // layout pixels, unaffected by the scale() above, and it does not inherit
    // an inner scroll container's idea of how tall it is.
    const measure = () => setOver(Math.max(0, el.offsetHeight - COMPOSE_H));
    measure();
    // See PAN_EPOCH. Negative, so it seeks into the loop rather than waiting.
    el.style.animationDelay = `-${(performance.now() - PAN_EPOCH) % PAN_MS}ms`;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [travel, data]);


  return (
    // `inert`, not just `aria-hidden` + `pointer-events-none`: this is a picture
    // of a page, not a page. A real render carries the rail's five nav links,
    // the table's own links and every button on the page — across five cards
    // that is roughly forty focusable elements sitting in front of each card's
    // own single link.
    //
    // `aria-hidden` alone makes that WORSE rather than better: it hides them
    // from a screen reader while leaving them in the tab order, so focus lands
    // on controls that announce nothing. `pointer-events-none` stops the mouse
    // and does nothing about the keyboard. `inert` is the one thing that
    // removes the subtree from hit-testing, the tab order and the accessibility
    // tree together. Caught by a browser test, not by review: Playwright's
    // click resolved to six matching links instead of one.
    <div
      ref={boxRef}
      inert
      className="ds-ground pointer-events-none relative w-full select-none overflow-hidden [background-color:var(--color-canvas)]"
      style={{ aspectRatio: `${COMPOSE_W} / ${COMPOSE_H}` }}
    >
      {/* `[&>*]:h-full` gives Puck's `Render` root a definite height. Measured:
          without it the root div is 387px of auto height on a 720px stage, so
          `SystemShell`'s own `min-h-full` resolves against nothing and the
          page's dark rail stops a third of the way down with bare white under
          it — the same percentage-height break the editor hits, but here the
          chain is short enough to fix properly, because `Render` inserts one
          wrapper where the editor inserts several.

          IN TRAVEL MODE THAT PIN IS EXACTLY WHAT HAS TO GO. The page is let
          out to its natural height (with COMPOSE_H as a floor, so the rail
          still has something to be tall against on a short page) and the crop
          above holds the window. `min-h-full` then resolves against the real
          height and the rail runs the whole way down, which is the same fix
          seen from the other side. */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: COMPOSE_W,
          height: COMPOSE_H,
          transform: `scale(${scale})`,
          // Nothing to see until measured, and `visibility` rather than
          // `display` so the observer still has a box to measure.
          visibility: scale ? "visible" : "hidden",
        }}
      >
        <div
          ref={stageRef}
          className={
            travel
              /*
                THE FLOOR IS ON THE FIRST PAGE ONLY.

                It was on every child, and the first screenshot of the strip
                showed why that is wrong: each page was padded out to a full
                720px window, so a page whose content runs 400px contributed
                320px of blank canvas and the strip scrolled through white
                bands. The first page keeps the floor because it is the one
                seen at rest, and because SystemShell's `min-h-full` needs
                something definite to be tall against; the threaded ones run at
                their natural height and butt up against each other, which is
                what makes the travel read as continuous.
              */
              ? "ds-pan [&>*:first-child]:min-h-[var(--pan-floor)]"
              : "h-full [&>*]:h-full"
          }
          style={
            travel
              ? ({
                  "--pan-floor": `${COMPOSE_H}px`,
                  "--pan-to": `${-over}px`,
                  animationDuration: `${PAN_MS}ms`,
                  // A page with nothing below the crop must not animate at
                  // all: `translateY(0)` for nine seconds is a composite layer
                  // and a repaint budget spent on standing still.
                  animationPlayState: over > 0 ? "running" : "paused",
                } as React.CSSProperties)
              : undefined
          }
        >
          <Render config={puckConfig} data={data} />
          {/* A hairline where one page ends and the next begins, so the seam
              reads as a page break rather than as a glitch in one long page.
              The register's own border token, so it is the same line the page
              draws everywhere else. */}
          {(strip ?? []).slice(0, STRIP_MAX - 1).map((d, i) => (
            <div key={i} className="[border-top:var(--hairline)_solid_var(--border)]">
              <Render config={puckConfig} data={d} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
