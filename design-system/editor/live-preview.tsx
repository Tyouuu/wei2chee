"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import { puckConfig } from "@/design-system/editor/puck-config";
import { scopeClasses } from "@/lib/portal/palettes";
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
  /** Rendered width before scaling. Wide enough that a table reads as a table
   *  and a workflow reads as a row of steps; the transform brings it back to
   *  the drawer's width. */
  width = 560,
  height = 64,
}: {
  name: string;
  style: StyleName;
  palette: string | null;
  fallback: ReactNode;
  width?: number;
  height?: number;
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
  if (!mounted) return <>{fallback}</>;

  const entry = (puckConfig.components as Record<
    string,
    { render?: unknown; defaultProps?: unknown; fields?: Record<string, { type?: string }> }
  >)[name];
  if (!entry?.render || PAGE_SIZED.has(name)) return <>{fallback}</>;

  const Render = entry.render as (props: Record<string, unknown>) => ReactNode;
  const props: Record<string, unknown> = { ...(entry.defaultProps as object | undefined) };

  // Ask the CONFIG which props are slots. The first version of this inferred
  // it — "an empty array must be a slot" — and broke three components on the
  // spot: Combobox's `options`, Listbox's `options` and TextAutocomplete's
  // `suggestions` all default to a legitimately empty array, so each was handed
  // a React component where it expected a list and threw `options.find is not
  // a function`. The error boundary below caught them, which is exactly why
  // the console had to be read rather than the palette merely looked at.
  for (const [k, field] of Object.entries(entry.fields ?? {})) {
    if (field?.type === "slot") props[k] = SlotStand;
  }
  props.puck = { renderDropZone: () => null, isEditing: false, dragRef: null };

  const scale = height / 120;

  return (
    <div
      className="pointer-events-none relative overflow-hidden rounded-[var(--radius-md)]"
      style={{ height, width: "100%" }}
      aria-hidden
    >
      <div
        className={scopeClasses(style, palette)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* A fixed source box with the content centred in it. Without this
            every block renders flush to the top-left of the tile and anything
            short — 状态标记, 标记, 评分, 按钮 — sits in the corner of a mostly
            empty rectangle, which reads as "failed to load" rather than as a
            small component. */}
        <div
          className="bg-background text-foreground grid place-content-center px-3"
          style={{ minHeight: 120, width }}
        >
          <Guard fallback={<div style={{ height: 120 }} />}>
            <Render {...props} />
          </Guard>
        </div>
      </div>
    </div>
  );
}
