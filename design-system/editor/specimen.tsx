"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Render } from "@puckeditor/core";
// Renders through the register-aware config, so a block nobody has
// touched takes the shape THIS register prefers. See
// design-system/editor/puck-config-client.tsx.
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";
import { StyleScope } from "@/design-system/editor/style-scope";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * ONE COMPONENT, WHOLE, INSIDE ITS FRAME.
 *
 * ── WHAT WAS WRONG, LOOKED AT RATHER THAN REASONED ABOUT ──────────────────
 *
 * The gallery drew every block into a 168px window at a FIXED `scale(0.65)`
 * with `overflow:hidden`. Two failures fall straight out of that, and both are
 * visible in the first screenshot of the page:
 *
 *   TALL BLOCKS WERE SLICED. 官网大标题 showed a headline and the top third of
 *   its red button. 询价表格 stopped mid-way through its second field. 报价单
 *   was cut across a table row. Nobody can judge a component from a slice of
 *   it, and a grid of slices reads as a page that failed to finish loading.
 *
 *   SHORT BLOCKS WERE STRANDED. 头像 is one 24px chip; at 0.65 in a 168x300
 *   cream rectangle it is 98% empty ground with a speck in the corner. Same
 *   for 多人头像, 日期选择, 月份选择, 评分. Eleven of the fifty-six looked
 *   broken for the same reason the tall ones did: the frame had nothing to do
 *   with the thing inside it.
 *
 * ── WHAT THE REFERENCES ACTUALLY DO ───────────────────────────────────────
 *
 * Screenshotted 2026-08-23 at 1440, because the founder said to look rather
 * than reason: 21st.dev/s/hero and landingfolio.com. Both run the same card,
 * and it is not the card this gallery had. Every tile is ONE fixed aspect
 * ratio; the component inside is COMPLETE, scaled down to fit, never cropped
 * and never floating in a corner; the name sits below the frame on the page
 * ground rather than inside it.
 *
 * ── HOW ───────────────────────────────────────────────────────────────────
 *
 * Measure both boxes, take the smaller ratio, scale about the CENTRE:
 *
 *     scale = min(frameW / naturalW, frameH / naturalH, 1)
 *
 * Capped at 1 because a component enlarged past its own size is a different
 * lie from a cropped one -- a 24px status dot blown up to fill 300px is not
 * what lands on the page. It stays 24px, centred, with quiet ground around it,
 * which is what a specimen card is.
 *
 * Scaling about the centre is what removes the offset arithmetic that
 * live-preview.tsx still carries: `transform` does not affect layout, so an
 * unscaled box centred by grid stays centred at any scale.
 */

/**
 * Blocks that are ONE CONTROL rather than a page section.
 *
 * They render at their own content width. Everything else renders at the full
 * authoring width, because a table asked to be `max-content` wide collapses to
 * its longest cell and stops looking like a table.
 *
 * A list rather than a measurement, for the same reason as before: width is
 * only knowable after render, and a grid that reflows once it has measured
 * itself is a worse problem than a list somebody has to keep current.
 */
export const NARROW = new Set([
  "StatusDot",
  "Avatar",
  "Tag",
  "ActionButton",
  "Stars",
  "NoticePill",
  "SmallStat",
  "CopyValue",
  "DatePicker",
  "MonthPicker",
  "Listbox",
  "Combobox",
  "PayQr",
  "FaceRow",
  "PageNumbers",
]);

/** Blocks that ARE a whole page. A 300px miniature of an app shell is a grey
 *  rectangle whatever the scale, so these are described in words instead. */
export const PAGE_SIZED = new Set(["SystemShell", "RailNav"]);

/** One bad block must not blank the gallery. Copied in spirit from
 *  live-preview.tsx's Guard, and for the same reason: a registry component
 *  reaching for a browser API should cost one tile, not the page. */
class Guard extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Specimen({
  name,
  props,
  style,
  palette,
  /** The width the block is composed at before it is scaled down. Wide enough
   *  that a table reads as a table; the fit brings it back to the frame. */
  width = 620,
  className = "",
}: {
  name: string;
  props: Record<string, unknown>;
  style: StyleName;
  palette: string | null;
  width?: number;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setFrame({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    // contentRect, NEVER getBoundingClientRect.
    //
    // This element sits INSIDE the scaled subtree, so its client rect is the
    // painted size -- scale feeding its own input. The first build did use the
    // rect and the gallery came out with every table crushed into a narrow
    // strip on the right of an empty card: measure 620, scale 0.48, re-measure
    // 296, scale 0.23, and so on down. It converges, quietly, to nonsense.
    // `contentRect` is the LAYOUT box and transforms do not touch it.
    const ro = new ResizeObserver(([e]) =>
      setNatural({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [name]);

  const scale =
    frame.w && frame.h && natural.w && natural.h
      ? Math.min(frame.w / natural.w, frame.h / natural.h, 1)
      : 1;

  return (
    <div ref={frameRef} className={`relative overflow-hidden ${className}`}>
      <StyleScope
        register={style}
        palette={palette}
        className="absolute inset-0 flex items-center justify-center [background-color:var(--color-canvas)]"
      >
          {/* flex, NOT `grid place-items-center`.
              Probed in the browser: a grid item WIDER than its track gets
              Chromium's safe-alignment treatment and is clamped to the start
              edge instead of centred, so every block composed at 620 inside a
              432 frame was painted 94px right of where it belonged and lost
              its right edge to the clip. Flexbox centres an oversized item
              symmetrically -- the same behaviour that makes centred flex
              content impossible to scroll back to, which here is exactly what
              is wanted. */}
        {/* `pointer-events-none`: these are specimens, not controls. A customer
            opening a date picker here would get a calendar that writes to
            nothing. */}
        <div
          className="pointer-events-none"
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
        >
          <div
            ref={innerRef}
            style={
              NARROW.has(name)
                ? { width: "max-content" }
                : { width, maxWidth: width }
            }
          >
            <Guard fallback={<div style={{ width: 120, height: 40 }} />}>
              <Render
                config={puckConfig}
                data={
                  { root: {}, content: [{ type: name, props }] } as never
                }
              />
            </Guard>
          </div>
        </div>
      </StyleScope>
    </div>
  );
}
