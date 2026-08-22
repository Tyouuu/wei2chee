"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePuck } from "@puckeditor/core";
import { LivePreview } from "@/design-system/editor/live-preview";
import { VARIANTS, activeVariant, type Variant } from "@/design-system/editor/variants";
import { puckConfig } from "@/design-system/editor/puck-config";
import { preferredVariants } from "@/lib/portal/design-doc";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * 换个款式 — a row of pictures of what the selected block could look like,
 * sitting directly under the panel's title, above its fields.
 *
 * Two things about it are load-bearing and easy to get wrong.
 *
 * IT SHOWS THE CUSTOMER'S OWN BLOCK. Every tile renders the block that is
 * actually selected — their 「本月已确认工程额」, their RM 71,300 — with one
 * appearance prop changed. A picker built from generic samples answers "what
 * does 只有数字 look like"; this one answers "what does MY card look like as
 * 只有数字", which is the question being asked. It costs nothing extra: the
 * props are already in hand.
 *
 * IT IS SAFE TO CLICK THROUGH. Selection survives the swap (`ui.itemSelector`
 * below), and every variant only sets appearance props — so the customer can
 * click all five, look at each in the canvas at full size, and land on the one
 * they want, with nothing they typed lost along the way. A picker you have to
 * undo is a picker nobody explores.
 */

/** How large to draw each block before scaling it into the column. Framing is
 *  per-component because "big enough to recognise" is: 标记 is two words and
 *  数字卡 is a figure, a trend line and three supporting stats. Getting this
 *  wrong doesn't error — it silently clips the half that distinguishes the
 *  variants, which is why each one below is a looked-at number and not a
 *  guessed one. */
const FRAME: Record<string, { w: number; h: number }> = {
  HeroCard: { w: 430, h: 250 },
  WorkflowStrip: { w: 560, h: 230 },
  Columns: { w: 560, h: 140 },
  // The whole page, so the difference between a left rail and a top bar is
  // visible as an arrangement rather than inferred from a label.
  // A whole page. Wider than the others by a lot, because what is being
  // compared is an ARRANGEMENT and an arrangement needs its proportions.
  SystemShell: { w: 1100, h: 620 },
  ActionButton: { w: 200, h: 76 },
  Tag: { w: 170, h: 64 },
  StatusDot: { w: 190, h: 64 },
  TrendChart: { w: 480, h: 210 },
  Alert: { w: 470, h: 140 },
  EmptyState: { w: 470, h: 210 },
  Divider: { w: 360, h: 100 },
};
const DEFAULT_FRAME = { w: 470, h: 150 };

// One per row. Wide enough that the difference between 数字+走势 and
// 数字+细项 is a thing you see rather than a thing you read off a label.
const COLS = 1;
const GAP = 12;

export function VariantPicker({ style, palette }: { style: StyleName; palette: string | null }) {
  const { selectedItem, dispatch, getSelectorForId } = usePuck();

  // The tiles are scaled to the column they land in, and the column is whatever
  // Puck's side bar happens to be — it is user-resizable. Measuring beats
  // hard-coding a width that is right until someone drags the divider.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [cell, setCell] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setCell(Math.max(0, (e.contentRect.width - GAP * (COLS - 1)) / COLS));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedItem?.type]);

  const list = selectedItem ? VARIANTS[selectedItem.type] : null;

  /** The props the register would have drawn this block with. Hoisted above the
   *  early return because it is a hook; empty when the register names no
   *  preference for this component, which is the same as "Puck's default". */
  const registerDefaults = useMemo(() => {
    const type = selectedItem?.type;
    if (!type) return {};
    const wanted = preferredVariants(style)[type];
    return (VARIANTS[type] ?? []).find((v) => v.id === wanted)?.props ?? {};
  }, [style, selectedItem?.type]);

  if (!selectedItem || !list?.length) return null;

  const props = selectedItem.props as Record<string, unknown>;
  // WHAT AN UNTOUCHED BLOCK IS SHOWING. Three layers, in the same order the
  // component itself resolves them: Puck's defaults underneath, then the
  // register's preference on top of those, and the customer's own props last
  // (applied inside activeVariant). A block nobody has touched carries no
  // variant key at all, so what it RENDERS as is the register's choice -- and
  // that is the tile that has to be lit, or the picker tells the customer
  // 「一行一条」 while the page in front of them is drawn with gridlines.
  const defaults = {
    ...((puckConfig.components as Record<string, { defaultProps?: Record<string, unknown> }>)[
      selectedItem.type
    ]?.defaultProps ?? {}),
    ...registerDefaults,
  };
  const active = activeVariant(selectedItem.type, props, defaults);
  const frame = FRAME[selectedItem.type] ?? DEFAULT_FRAME;
  const scale = cell ? cell / frame.w : 0;

  const pick = (v: Variant) => {
    const id = props.id;
    if (typeof id !== "string") return;
    const sel = getSelectorForId(id);
    if (!sel) return;
    dispatch({
      type: "replace",
      destinationIndex: sel.index,
      destinationZone: sel.zone,
      // `id` is spread in from `props` above; Puck's ComponentData type wants
      // it named explicitly, and it must stay the SAME id -- a replace that
      // mints a new one orphans the selection and any zones nested inside.
      data: { ...selectedItem, props: { ...props, ...v.props, id } },
      // Without this the block deselects on swap, the panel collapses back to
      // 「整个页面」, and comparing two variants means re-selecting the block
      // between every click.
      ui: { itemSelector: sel },
    });
  };

  return (
    <section className="px-3 py-3">
      <div
        ref={gridRef}
        className="grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gap: GAP }}
      >
        {list.map((v) => {
          const on = active?.id === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => pick(v)}
              aria-pressed={on}
              title={v.label}
              className="group/v flex flex-col gap-1 rounded-[var(--radius-md)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:[outline-color:var(--color-paper-dim)]"
            >
              <span
                className="relative block w-full overflow-hidden rounded-[var(--radius-md)] border transition-colors"
                style={{
                  // The active tile is marked by its FRAME, never by a tint
                  // over the picture. Tinting a preview changes the thing
                  // being previewed, which in a picker whose whole job is
                  // colour and shape defeats itself.
                  borderColor: on ? "var(--color-paper)" : "var(--color-ink-800)",
                  borderWidth: on ? 2 : 1,
                  backgroundColor: "var(--color-ink-950)",
                }}
              >

                {scale > 0 ? (
                  <LivePreview
                    name={selectedItem.type}
                    style={style}
                    palette={palette}
                    // The customer's content, THIS variant's appearance.
                    // Passing `props` alone drew five identical tiles — every
                    // one of them a picture of the block as it already is,
                    // which is the one thing a picker must never show. The
                    // canvas swap was correct the whole time, so nothing but
                    // looking at it would have caught this.
                    props={{ ...props, ...v.props }}
                    width={frame.w}
                    srcHeight={frame.h}
                    scale={scale}
                    renderPageSized
                    fallback={<span className="block" style={{ height: frame.h * 0.24 }} />}
                  />
                ) : (
                  <span className="block" style={{ height: 48 }} />
                )}
              </span>
              <span className="flex items-center gap-1.5">
                {on && (
                  <span
                    aria-hidden
                    className="grid size-3.5 shrink-0 place-items-center rounded-full [background-color:var(--color-paper)] [color:var(--color-ink-950)] [font-size:9px] [line-height:1]"
                  >
                    ✓
                  </span>
                )}
                <span
                  className="truncate [font-size:var(--text-xs)]"
                  style={{ color: on ? "var(--color-paper)" : "var(--color-paper-dim)" }}
                >
                  {v.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
