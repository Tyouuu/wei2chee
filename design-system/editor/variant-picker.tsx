"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePuck } from "@puckeditor/core";
import { LivePreview } from "@/design-system/editor/live-preview";
import { scopeClasses } from "@/lib/portal/palettes";
import { VARIANTS, activeVariant, type Variant } from "@/design-system/editor/variants";
import { puckConfig } from "@/design-system/editor/puck-config";
import { preferredVariants } from "@/lib/portal/design-doc";
import { BLOCK_TONES, TONE_SWATCH, type BlockTone } from "@/design-system/editor/block-tone";
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

// ONE PER ROW UNTIL THERE IS ROOM FOR MORE.
//
// A single column is right in the docked sheet (440px), where one tile at full
// width is exactly wide enough that the difference between 数字+走势 and
// 数字+细项 is a thing you see rather than a thing you read off a label.
//
// It is wrong in the bottom sheet, which is the full width of the window: the
// first screenshot after that landed showed one variant tile filling a 1024px
// screen, a table rendered at four times the size it will ever be seen at.
// Columns are computed from the measured width instead, capped so a tile never
// grows past the size it was framed for (see FRAME above).
const MAX_TILE = 460;
const GAP = 12;

function columnsFor(width: number) {
  if (!width) return 1;
  return Math.max(1, Math.min(3, Math.floor((width + GAP) / (MAX_TILE + GAP))));
}

export function VariantPicker({ style, palette }: { style: StyleName; palette: string | null }) {
  const t = useTranslations("portal.editor");
  const toneLabel = t("blockTone.label");
  const { selectedItem, dispatch, getSelectorForId } = usePuck();

  // The tiles are scaled to the column they land in, and the column is whatever
  // Puck's side bar happens to be — it is user-resizable. Measuring beats
  // hard-coding a width that is right until someone drags the divider.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox(Math.max(0, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedItem?.type]);
  const cols = columnsFor(box);
  const cell = box ? (box - GAP * (cols - 1)) / cols : 0;

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

  /** Writes one appearance prop without touching the rest. Same replace as
   *  `pick`, same reason for keeping the id and the selection. */
  const setTone = (tone: BlockTone) => {
    const id = props.id;
    if (typeof id !== "string") return;
    const sel = getSelectorForId(id);
    if (!sel) return;
    dispatch({
      type: "replace",
      destinationIndex: sel.index,
      destinationZone: sel.zone,
      // "page" is stored as undefined rather than as the string: an absent
      // prop is what "the customer never chose" means everywhere else in this
      // system, and storing the default would make the two indistinguishable.
      data: {
        ...selectedItem,
        props: { ...props, tone: tone === "page" ? undefined : tone, id },
      },
      ui: { itemSelector: sel },
    });
  };
  const tone = (props.tone as BlockTone | undefined) ?? "page";

  return (
    <section className="px-3 py-3">
      {/* THE COLOUR ROW, ABOVE THE SHAPES.
          Durable puts it at the top of the block's Design tab and it belongs
          there: which ground a block sits on is a smaller decision than which
          shape it takes, and a smaller decision goes above so it does not
          interrupt the row of pictures below. Four discs rather than a
          dropdown -- the whole point of this panel is that nothing here is
          read, it is seen. */}
      <div className="mb-3 flex items-center gap-2">
        <span className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
          {toneLabel}
        </span>
        {/* SCOPED TO THE CUSTOMER'S REGISTER, NOT THE EDITOR'S CHROME.
            The first version resolved --color-paper and --color-primary-soft
            where the swatches are DRAWN, which is Formae's own dark chrome --
            so all three coloured discs came out white and the row said nothing.
            Photographed before it was ever shown to anyone. The swatches have
            to be painted in the register the block lives in, which is what this
            wrapper does and what LivePreview below has always done. */}
        <span className={`flex items-center gap-1.5 ${scopeClasses(style, palette)}`}>
          {BLOCK_TONES.map((tn) => {
            const sw = TONE_SWATCH[tn];
            const on = tone === tn;
            return (
              <button
                key={tn}
                type="button"
                onClick={() => setTone(tn)}
                aria-pressed={on}
                title={t(`blockTone.${tn}`)}
                className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110"
                style={{
                  background: sw.bg,
                  boxShadow: on
                    ? `0 0 0 2px var(--color-ink-900), 0 0 0 3.5px ${sw.ring}`
                    : `0 0 0 1px var(--color-ink-700)`,
                }}
              >
                {/* A SLASH, NOT A DOT, AND NOT A COLOUR.
                    The first version drew 「跟页面一样」 as a grey disc with a
                    dot in it, and the founder's first reaction on seeing the
                    row was 「等等什么颜色 那个灰色的？」 -- which is the whole
                    answer. Four discs in a row is four colours to choose from,
                    so the one that means "do not choose a colour" was read as
                    a fifth grey. Durable's row has the same fault and it got
                    copied along with the good half.

                    A slash through an empty circle is the universal mark for
                    「无」 and it is the only one of the four that is not a
                    surface, which is exactly what it is trying to say. */}
                {tn === "page" ? (
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="h-full w-full"
                    style={{ color: sw.fg }}
                  >
                    <line
                      x1="5.5"
                      y1="18.5"
                      x2="18.5"
                      y2="5.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </span>
      </div>

      <div
        ref={gridRef}
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}
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
