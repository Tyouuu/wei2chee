"use client";

import { useEffect, useRef, useState } from "react";
import { Render, type Data } from "@puckeditor/core";
import { puckConfig } from "@/design-system/editor/puck-config";

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

export function PagePreview({ data }: { data: Data }) {
  const boxRef = useRef<HTMLDivElement>(null);
  // 0 until measured. Rendering at scale 0 rather than at 1 avoids a single
  // frame of a 1180px-wide page bursting out of a 300px card before the
  // observer fires.
  const [scale, setScale] = useState(0);

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
          wrapper where the editor inserts several. */}
      <div
        className="absolute left-0 top-0 origin-top-left [&>*]:h-full"
        style={{
          width: COMPOSE_W,
          height: COMPOSE_H,
          transform: `scale(${scale})`,
          // Nothing to see until measured, and `visibility` rather than
          // `display` so the observer still has a box to measure.
          visibility: scale ? "visible" : "hidden",
        }}
      >
        <Render config={puckConfig} data={data} />
      </div>
    </div>
  );
}
