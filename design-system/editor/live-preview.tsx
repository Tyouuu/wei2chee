"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { puckConfig } from "@/design-system/editor/puck-config";
import { scopeClasses } from "@/lib/portal/palettes";
import { StyleScope } from "@/design-system/editor/style-scope";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * THE PALETTE SHOWS THE REAL BLOCK, NOT A DRAWING OF ONE.
 *
 * `component-preview.tsx` draws a 40px schematic beside each name. Its own
 * header argues for that, and the argument was reasonable when it was written:
 * a live render would show the wrong style, several components run hooks, and
 * at 40px the recognisable thing is the shape.
 *
 * Then the founder looked at the palette and said 「在编辑页面 又看不到组件的图片
 * 只能看文字」. He is right, and the reason is worse than "the drawings are
 * small": they do not distinguish. 页面标题, 趋势图, 进度条 and 提醒条 are all
 * two grey bars; 日期选择, 月份选择 and 下拉选择 are all a bar in a box. The
 * picture carries no information, so you read the four characters anyway.
 * Registering eleven more blocks the same day made it eight entries worse,
 * because none of them had a drawing at all.
 *
 * Two of the three original objections dissolve on inspection:
 *
 *   * "a live render would show the WRONG style" — only if it renders in the
 *     editor's own chrome. Rendered inside `scopeClasses(style, palette)` it
 *     shows the customer's ACTUAL style, which makes it the most truthful
 *     thing in the editor rather than the least.
 *   * "several components run hooks" — they do, and they run fine. Thirty
 *     small React trees in a scrolling drawer is not a cost worth a worse
 *     palette; the pickers own popover state that simply stays closed.
 *
 * The third objection stands and is honoured: a full-page block (SystemShell,
 * RailNav) is meaningless at thumbnail size, and a block whose content comes
 * from a Puck slot has nothing to render outside Puck. Those fall back to the
 * schematic. Everything else renders itself.
 *
 * This is what 21st.dev does, and the reason it works there is the same reason
 * it works here: you recognise a table because it looks like a table.
 */

/** Slots arrive from Puck as components. Outside Puck they are undefined, so
 *  every slot gets this instead — which renders as the shape of "something
 *  goes here", and makes 分栏's preview genuinely informative: two blocks side
 *  by side is exactly what the block does. */
function SlotStand() {
  return (
    <div
      aria-hidden
      className="h-9 w-full rounded-[var(--radius-sm)] border border-dashed [border-color:var(--border)] [background-color:var(--muted)]"
    />
  );
}

/** Shaped stand-ins for the slots where a generic dashed bar says nothing.
 *  Keyed by component then by slot name; anything not listed here falls back
 *  to SlotStand above, which is correct for most blocks. */
const SLOT_FILL: Record<string, Record<string, () => ReactNode>> = {
  SystemShell: {
    sidebar: function NavStand() {
      return (
        <div aria-hidden className="flex flex-col gap-2 p-3">
          <div className="bg-primary/80 mb-1 size-6 rounded-[var(--radius-sm)]" />
          {[64, 52, 58, 46, 60].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="bg-muted-foreground/40 size-3 rounded-[var(--radius-sm)]" />
              <div
                className={
                  i === 0
                    ? "bg-primary/50 h-2.5 rounded-full"
                    : "bg-muted-foreground/25 h-2.5 rounded-full"
                }
                style={{ width: w }}
              />
            </div>
          ))}
        </div>
      );
    },
    main: function PageStand() {
      return (
        <div aria-hidden className="flex flex-col gap-3 p-4">
          <div className="bg-foreground/70 h-3 w-40 rounded-full" />
          <div className="bg-card [border-color:var(--border)] rounded-[var(--radius-lg)] border p-4">
            <div className="bg-muted-foreground/25 mb-2 h-2 w-24 rounded-full" />
            <div className="bg-foreground/70 h-5 w-36 rounded-[var(--radius-sm)]" />
          </div>
          <div className="bg-card [border-color:var(--border)] rounded-[var(--radius-lg)] border p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <div className="bg-muted-foreground/25 h-2 flex-1 rounded-full" />
                <div className="bg-muted-foreground/20 h-2 w-12 rounded-full" />
                <div className="bg-primary/40 h-2 w-8 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      );
    },
  },
};

/** Blocks that own the whole page. A 64px-tall miniature of a full app shell
 *  is a grey rectangle whatever we do, so these keep the schematic. */
const PAGE_SIZED = new Set(["SystemShell", "RailNav"]);

/** One bad block must not blank the palette. A render can throw for reasons
 *  that have nothing to do with the customer — a registry component reaching
 *  for a browser API, a default prop that stopped matching its type after an
 *  edit — and a palette that disappears is far worse than one tile that falls
 *  back to a drawing. */
class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function LivePreview({
  name,
  style,
  palette,
  fallback,
  props: override,
  /** Rendered width before scaling. Wide enough that a table reads as a table
   *  and a workflow reads as a row of steps; the transform brings it back to
   *  the drawer's width. */
  width = 560,
  height = 64,
  srcHeight = 120,
  scale: forcedScale,
  renderPageSized = false,
}: {
  name: string;
  style: StyleName;
  palette: string | null;
  fallback: ReactNode;
  /** Merged over the component's `defaultProps`. Slot props are still replaced
   *  by the stand-in below whatever is passed here -- a slot arrives from Puck
   *  as an ARRAY of child component data, and handing that to a render that
   *  expects a component throws. */
  props?: Record<string, unknown>;
  width?: number;
  height?: number;
  /** Height of the un-scaled source box. Raise it for blocks that are taller
   *  than they are identifiable — a 数字卡 with three supporting figures and a
   *  trend line needs ~220 before the interesting half stops being clipped. */
  srcHeight?: number;
  /** Scale factor, when the caller has measured the space it has. Overrides
   *  the drawer's fixed-height arithmetic; the tile then takes whatever height
   *  the whole block comes to. */
  scale?: number;
  /** Draw 页面框架 / 侧边导航 anyway. Off by default because a full app shell
   *  at 64px is a grey rectangle; on for the variant picker, where the shell's
   *  arrangement IS the thing being chosen. */
  renderPageSized?: boolean;
}) {
  // AFTER THE FIRST PAINT ONLY, and not as an optimisation.
  //
  // dnd-kit hands each sortable an `aria-describedby="DndDescribedBy-N"` from a
  // module-level counter. The server starts that counter at whatever the render
  // pass reached and the browser starts it at zero, so the 看板 preview
  // hydrated with `-6` against `-0` and React threw the whole drawer subtree
  // away and re-rendered it. One aria attribute, one discarded tree.
  //
  // Deferring is also just correct here: nothing about a palette thumbnail
  // needs to exist in the server's HTML, and thirty component trees is real
  // work to do twice.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fit-to-content, and it has to be measured rather than declared: the same
  // block is four different heights across its own variants. Only used in
  // picker mode -- the drawer wants every tile the same height so the palette
  // scans as a grid, and there "as tall as it happens to be" is the wrong
  // answer. `mounted` is in the deps because the ref's element does not exist
  // during the pre-mount render that returns the fallback.
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState(0);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNatural(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [forcedScale, name, mounted]);

  // THE TILE'S OWN WIDTH, MEASURED. The scale used to come from `height /
  // srcHeight` alone, which fixes the drawn width at `width * scale` and takes
  // no account of the box it lands in. That was right while the palette was a
  // ~300px docked column and silently wrong the day it became a 520px sheet:
  // 560 x (64/120) = 299px of painted preview inside a 470px tile, so every
  // block in 加一段 was drawn on the left half of its card with the panel's
  // dark background showing through the right. Found by opening the picker and
  // looking at it -- nothing about it throws, and every test stayed green.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || forcedScale) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [forcedScale, mounted]);

  if (!mounted) return <>{fallback}</>;

  const entry = (puckConfig.components as Record<
    string,
    { render?: unknown; defaultProps?: unknown; fields?: Record<string, { type?: string }> }
  >)[name];
  if (!entry?.render || (PAGE_SIZED.has(name) && !renderPageSized)) return <>{fallback}</>;

  const Render = entry.render as (props: Record<string, unknown>) => ReactNode;
  const props: Record<string, unknown> = {
    ...(entry.defaultProps as object | undefined),
    ...override,
  };

  // Ask the CONFIG which props are slots. The first version of this inferred
  // it — "an empty array must be a slot" — and broke three components on the
  // spot: Combobox's `options`, Listbox's `options` and TextAutocomplete's
  // `suggestions` all default to a legitimately empty array, so each was handed
  // a React component where it expected a list and threw `options.find is not
  // a function`. The error boundary below caught them, which is exactly why
  // the console had to be read rather than the palette merely looked at.
  for (const [k, field] of Object.entries(entry.fields ?? {})) {
    if (field?.type === "slot") props[k] = SLOT_FILL[name]?.[k] ?? SlotStand;
  }
  props.puck = { renderDropZone: () => null, isEditing: false, dragRef: null };

  // Fill the tile, then let the height follow. `height` survives as the floor
  // for the frame before the observer has fired -- a tile that starts at 0 and
  // jumps is worse than one that starts a little short.
  const fitScale = boxW ? boxW / width : height / srcHeight;
  const scale = forcedScale ?? fitScale;

  // HOW MUCH OF THE BLOCK THE TILE SHOWS, in source pixels.
  //
  // Not a constant, and the reason is that the palette holds both 标记 (one
  // pill, ~40px) and 记录表格 (a header and four rows, ~300px). A fixed window
  // gives one of them a mostly empty card and crops the other before its first
  // row. Clamped rather than free so the grid still scans as a grid.
  //
  // `natural` is measured on a box with NO minimum height, which is what keeps
  // this from oscillating: the measurement cannot depend on the number derived
  // from it.
  const SHORTEST = 104;
  const srcShown = forcedScale
    ? natural || srcHeight
    : Math.min(srcHeight, Math.max(natural || srcHeight, SHORTEST));
  const tileHeight = srcShown * scale;
  // Centred while it fits, top-aligned once it does not: a short block in the
  // corner of an empty rectangle reads as a failed load, and a tall one that
  // loses its own first row loses the thing that says what it is.
  const offset = forcedScale ? 0 : Math.max(0, (srcShown - (natural || 0)) / 2);

  return (
    <div
      ref={boxRef}
      className="pointer-events-none relative overflow-hidden rounded-[var(--radius-md)]"
      style={{ height: tileHeight, width: "100%" }}
      aria-hidden
    >
      <StyleScope
        register={style}
        palette={palette}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          ref={innerRef}
          className="bg-background text-foreground grid justify-center px-4 py-3"
          style={{ width, marginTop: offset }}
        >
          <Guard fallback={<div style={{ height: SHORTEST }} />}>
            <Render {...props} />
          </Guard>
        </div>
      </StyleScope>
    </div>
  );
}
