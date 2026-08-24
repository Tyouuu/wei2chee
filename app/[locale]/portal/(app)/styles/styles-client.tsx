"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Render } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { puckConfig } from "@/design-system/editor/puck-config";
import { PageBar } from "../page-bar";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import chrome from "../../chrome.module.css";
import {
  STYLE_ORDER,
  type StyleName,
} from "@/app/[locale]/style-picker/style-column";
import { PALETTES } from "@/lib/portal/palettes";
import { StyleScope } from "@/design-system/editor/style-scope";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  large: styles.large,
  stamp: styles.stamp,
  swiss: styles.swiss,
  soft: styles.soft,
  brut: styles.brut,
  ink: styles.ink,
  glass: styles.glass,
  night: styles.night,
  signboard: styles.signboard,
  lacquer: styles.lacquer,
  code: styles.code,
  tile: styles.tile,
  pop: styles.pop,
  console: styles.console,
  counter: styles.counter,
};


/** The name a customer sees. Was two hardcoded ternaries in two files, which is
 *  why a fourth style would have rendered as "Blueprint" in both. */
export const STYLE_LABEL: Record<StyleName, string> = {
  ledger: "Ledger",
  hearth: "Hearth",
  blueprint: "Blueprint",
  large: "Large",
  stamp: "Stamp",
  swiss: "Swiss",
  soft: "Soft",
  brut: "Brut",
  ink: "Ink",
  glass: "Glass",
  night: "Night",
  signboard: "Signboard",
  lacquer: "Lacquer",
  code: "Code",
  tile: "Tile",
  pop: "Pop",
  console: "Console",
  counter: "Counter",
};

/**
 * A real fragment of a real system, rendered in each style.
 *
 * WHY NOT A COLOUR SWATCH. A swatch shows the palette and hides everything else
 * — and the palette is the SMALLEST difference between these three. They differ
 * on six axes (font, radius, density, accent, ground, border weight), and the
 * one a customer feels first is row height: 33px under Ledger, 43px under
 * Blueprint, 52px under Hearth. Only a rendered table shows that. This is the
 * 21st.dev Themes-grid argument taken one step further: show the thing, not a
 * label for the thing.
 */
/** The table alone. The heading and the button above it are drawn by hand so
 *  they can be a TYPE SPECIMEN rather than page content -- see the card. */
const TABLE_ONLY = {
  root: {},
  content: [
    {
      type: "RecordTable",
      props: {
        id: "s-t",
        gridId: "s-t",
        caption: "报价单列表",
        table: {
          columns: [
            { key: "primary", label: "报价内容", kind: "text" },
            { key: "secondary", label: "客户", kind: "detail" },
            { key: "amount", label: "金额", kind: "amount" },
            { key: "status", label: "状态", kind: "status" },
          ],
          rows: [
            {
              cells: { primary: "Taman Desa 三房翻新", secondary: "陈先生", amount: "RM 48,500", status: "已确认" },
              tones: { status: "positive" },
            },
            {
              cells: { primary: "Bukit Jalil 厨房改造", secondary: "李太太", amount: "RM 22,800", status: "等确认" },
              tones: { status: "warning" },
            },
            {
              cells: { primary: "Cheras 店面装修", secondary: "王老板", amount: "RM 96,000", status: "报价中" },
              tones: { status: "neutral" },
            },
          ],
        },
      },
    },
  ],
};

export function StylesClient({
  locale,
  style,
  palette,
}: {
  locale: string;
  style: StyleName;
  palette: string | null;
}) {
  const t = useTranslations("portal.styles");
  const tHome = useTranslations("portal.home");
  const tEditor = useTranslations("portal.editor");

  const [active, setActive] = useState<StyleName>(style);
  const [pending, setPending] = useState<StyleName | null>(null);
  const [failed, setFailed] = useState(false);
  const [activePalette, setActivePalette] = useState<string | null>(palette);
  const [palettePending, setPalettePending] = useState<string | null>(null);

  async function pickPalette(next: string | null) {
    if (next === activePalette || palettePending) return;
    const previous = activePalette;
    // Optimistic for the same reason the layout choice is: the samples above
    // re-render immediately from the class, so what the round trip confirms is
    // persistence, not appearance. Rolled back on failure so the current
    // marker never claims something the database did not accept.
    setActivePalette(next);
    setPalettePending(next ?? "__native__");
    setFailed(false);
    const { error } = await createBrowserSupabaseClient().rpc("update_project_palette", {
      new_palette: next,
    });
    setPalettePending(null);
    if (error) {
      setActivePalette(previous);
      setFailed(true);
    }
  }

  async function choose(next: StyleName) {
    if (next === active || pending) return;
    const previous = active;
    // Optimistic: every sample on this screen is already rendered in its own
    // style, so what the click changes is which one is marked current. Rolling
    // back on failure keeps the mark honest.
    setActive(next);
    setPending(next);
    setFailed(false);
    const { error } = await createBrowserSupabaseClient().rpc("update_project_style", {
      new_style: next,
    });
    setPending(null);
    if (error) {
      setActive(previous);
      setFailed(true);
    }
  }

  return (
    <>
      <PageBar title={t("title")} subtitle={t("subtitle")}>
        {failed && (
          <span role="status" className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
            {tEditor("styleFailed")}
          </span>
        )}
      </PageBar>

      <div className="px-8 py-7">
        <p className="max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {tHome("styleBody")}
        </p>

        <ul className="mt-6 grid items-start gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          {STYLE_ORDER.map((name) => {
            const isActive = name === active;
            return (
              <li
                key={name}
                className={`overflow-hidden rounded-[var(--radius-lg)] transition-colors ${
                  isActive
                    ? "[border:1px_solid_var(--color-primary)]"
                    : "[border:1px_solid_var(--color-ink-800)]"
                } [background-color:var(--color-ink-900)]`}
              >
                {/* The sample re-scopes every token to this style, which is why
                    three different design systems can sit on one screen at once
                    — custom properties inherit and the nearest definition wins. */}
                {/* Fixed frame for the same reason as the component library:
                    a scale transform keeps its pre-scale layout height, which
                    left a large void under the shorter registers and stretched
                    every card to the height of Hearth's. */}
                <div className={`${chrome.mount} m-3 h-[268px]`}>
                  {/* NULL, not activePalette. A palette replaces colour and
                      only colour, so rendering all eight registers inside the
                      customer's palette paints all eight the same and leaves
                      radius alone to carry the comparison. Their own colours
                      here; the customer's 配色 has its own grid below. */}
                  <StyleScope
                    register={name} className="ds-ground h-full [background-color:var(--color-canvas)]"
                  >
                    {/* THE TYPE SPECIMEN. The register's name set in the
                        register's own face, next to a filled control carrying
                        its own accent, radius and label case -- the four things
                        that differ most and that a 13px table at 0.67 scale
                        cannot show. Durable's Fonts card does exactly this:
                        「Playfair Display」 set in Playfair. */}
                    <div className="flex items-center justify-between gap-3 [padding-inline:var(--pad-card)] [padding-block:var(--pad-card)]">
                      <span className="min-w-0 truncate [color:var(--color-paper)] [font-family:var(--font-ui)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)]">
                        {STYLE_LABEL[name]}　报价单
                      </span>
                      <span className="shrink-0 rounded-[var(--radius-md)] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-family:var(--font-ui)] [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] [text-transform:var(--label-transform)]">
                        新增
                      </span>
                    </div>
                    <div className="pointer-events-none origin-top-left [width:143%] [transform:scale(0.7)]">
                      <div className="[padding-inline:var(--pad-card-lg)]">
                        <Render config={puckConfig} data={TABLE_ONLY as never} />
                      </div>
                    </div>
                  </StyleScope>
                </div>

                <div className="flex items-center justify-between gap-3 border-t px-3 py-3 [border-color:var(--color-ink-800)]">
                  <span className="min-w-0">
                    <span className="block [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                      {STYLE_LABEL[name]}
                    </span>
                    <span className="block [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                      {tHome(`styleTag.${name}`)}
                    </span>
                  </span>
                  {isActive ? (
                    <span className="shrink-0 rounded-full px-2.5 py-1 [font-size:var(--text-xs)] [background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]">
                      {tHome("styleCurrent")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => choose(name)}
                      disabled={Boolean(pending)}
                      className="shrink-0 rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors disabled:opacity-50 enabled:hover:[border-color:var(--color-primary)]"
                    >
                      {pending === name ? tEditor("saving") : tHome("styleUse")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* THE 配色 LAYER.
            Below the 版式 grid, not beside it, because the two are not peers:
            the layout decides how dense and how sharp the system is, which is
            the decision a business owner actually has an opinion about, and the
            colour is the one they will change three times in a week.

            Rendered as swatch cards rather than as three more full samples —
            this is the one part of 21st.dev's Themes grid that transfers, and
            it transfers precisely because a palette IS only colour. Their
            argument breaks for the 版式 above (a swatch cannot show that
            Ledger's rows are 32px and Hearth's are 52px, which is the first
            thing a customer feels), and holds perfectly here. */}
        <section className="mt-12">
          <div className="flex items-baseline gap-4">
            <h2 className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
              {t("paletteTitle")}
            </h2>
            <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
              {PALETTES.length + 1}
            </span>
          </div>
          <p className="mt-2 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
            {t("paletteBody", { count: STYLE_ORDER.length * (PALETTES.length + 1) })}
          </p>

          {/* Two to four, not three to five: 21st.dev's cards are wide, and
              the width is doing the work -- a ground colour has to be a FIELD
              to read as one. */}
          <ul className="mt-5 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {/* The native pairing first, and as a real option rather than a
                "none". Ledger's rust, Hearth's teal and Blueprint's blue were
                each chosen with their layout; "no palette" is the designed
                answer, not the absence of one. */}
            <PaletteCard
              label={t("paletteNative")}
              blurb={t("paletteNativeBlurb")}
              styleName={active}
              paletteKey={null}
              current={activePalette === null}
              pending={palettePending === "__native__"}
              onPick={() => pickPalette(null)}
              disabled={Boolean(palettePending)}
            />
            {PALETTES.map((p) => (
              <PaletteCard
                key={p.key}
                label={p.label}
                blurb={p.blurb}
                who={p.who}
                styleName={active}
                paletteKey={p.key}
                current={activePalette === p.key}
                pending={palettePending === p.key}
                onPick={() => pickPalette(p.key)}
                disabled={Boolean(palettePending)}
              />
            ))}
          </ul>
        </section>

      </div>
    </>
  );
}

/** THE PALETTE IS SHOWN AS THE SYSTEM WEARING IT, NOT AS FOUR DOTS.
 *
 *  This used to be a swatch, and the reasoning written here was that "a
 *  palette changes only colour, so a swatch is a complete description of it".
 *  It is not. Four circles do not tell a contractor where the accent lands, how
 *  「已确认」 reads against 「已逾期」, or whether the ground is warm enough to
 *  live on all day. What the swatch actually described was the palette FILE.
 *
 *  It was also the largest single reason the founder said 「还不能preview 什么都
 *  可以」: five layouts times eleven palettes is fifty-five looks, and exactly
 *  five of them — one per layout card — were visible. Rendering the fragment
 *  makes eleven visible at a time, and switching layout shows the next eleven.
 *
 *  The fragment is deliberately tiny: one figure, two rows with statuses, one
 *  button. That is every place a palette shows itself, and nothing else. */
function PaletteCard({
  label,
  blurb,
  who,
  styleName,
  paletteKey,
  current,
  pending,
  disabled,
  onPick,
}: {
  label: string;
  blurb: string;
  /** Which trades this colour belongs to. Absent on the native pairing, which
   *  belongs to the register rather than to a trade. */
  who?: string;
  styleName: StyleName;
  paletteKey: string | null;
  current: boolean;
  pending: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled || current}
        aria-current={current}
        className={`block w-full overflow-hidden rounded-[var(--radius-md)] text-left transition-colors disabled:cursor-default ${
          current
            ? "[border:2px_solid_var(--color-primary)]"
            : "[border:1px_solid_var(--color-ink-800)] enabled:hover:[border-color:var(--color-paper-dim)]"
        }`}
      >
        <StyleScope register={styleName} palette={paletteKey} className="block">
          <PaletteSample label={label} />
        </StyleScope>
      </button>
      <span className="mt-2.5 flex items-baseline gap-2">
        <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
          {label}
        </span>
        {current && (
          <span className="[color:var(--color-primary)] [font-size:var(--text-xs)]">✓</span>
        )}
        {pending && (
          <span className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">…</span>
        )}
      </span>
      <span className="block [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">{blurb}</span>
      {/* WHO IT IS FOR, under the description. Twenty-five colours is a longer
          list than anybody wants to compare one by one, and a business owner
          does not choose a hue -- he recognises his own trade. This is the
          line that turns a wall of swatches into a shortlist of two. */}
      {who && (
        <span className="mt-0.5 block [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [opacity:0.8]">
          {who}
        </span>
      )}
    </li>
  );
}

/** The smallest fragment that shows everything a palette decides: the ground,
 *  the accent on a figure and on a button, and the three status tones a
 *  business system actually leans on — confirmed, waiting, overdue. Rendered at
 *  real size rather than scaled, because a palette is judged on colour and
 *  colour survives being small; the layouts above are the ones that need
 *  room. */
/** One palette, the way 21st.dev draws a theme: the card IS the canvas
 *  colour, four dots for the accent and the neutral ramp, and the name set
 *  inside it in the palette's own foreground. */
function PaletteSample({ label }: { label: string }) {
  /* WHAT THIS USED TO BE, AND WHY IT CHANGED.
     The comment above this function has said since it was written that the
     fragment is "one figure, two rows with statuses, one button". It was not.
     It was four dots and a word on an empty field -- 25 cards each showing a
     large rectangle of ground colour with a row of circles in the corner, which
     is the least informative thing a palette card can be and reads as
     unfinished. Screenshotted at 1440 before this was replaced.

     A palette shows itself in four places and nowhere else: the ground it
     paints, the accent on a fill, the three status tones, and the ink on a
     panel. So the fragment now contains exactly those four and nothing more --
     small enough to sit twenty-five to a page, complete enough that choosing
     between two of them is a real comparison rather than a guess. */
  const row = (name: string, amount: string, tone: string, state: string) => (
    <span className="flex items-center gap-2 [padding:6px_10px]">
      <span className="min-w-0 flex-1 truncate [color:var(--color-paper)] [font-size:var(--text-xs)]">
        {name}
      </span>
      <span className="tabular-nums [color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
        {amount}
      </span>
      <span
        className="flex shrink-0 items-center gap-1 [font-size:var(--text-micro)]"
        style={{ color: tone }}
      >
        <span className="block size-1.5 rounded-full" style={{ backgroundColor: tone }} />
        {state}
      </span>
    </span>
  );

  return (
    <span
      className="ds-ground relative block w-full overflow-hidden [background-color:var(--color-canvas)] [padding:12px]"
      style={{ aspectRatio: "4 / 3" }}
    >
      <span className="flex h-full flex-col gap-2">
        {/* The panel: ink on a card, the accent as a number, and the chart ramp
            as a figure. Five bars because five is what the ramp has. */}
        <span className="ds-card block [padding:10px_12px]">
          <span className="flex items-end justify-between">
            <span className="block">
              <span className="block [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
                本月收款
              </span>
              <span className="block tabular-nums [color:var(--color-primary)] [font-family:var(--font-numeric)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                RM 48,500
              </span>
            </span>
            <span className="flex h-7 items-end gap-[3px]">
              {[
                ["var(--color-jade-chart)", 10],
                ["var(--color-brass-chart)", 18],
                ["var(--color-info)", 13],
                ["var(--color-primary)", 26],
                ["var(--color-slate)", 16],
              ].map(([c, h], i) => (
                <span
                  key={i}
                  className="block w-[5px] [border-radius:var(--radius-xs)]"
                  style={{ backgroundColor: c as string, height: `${h as number}px` }}
                />
              ))}
            </span>
          </span>
        </span>

        {/* The three status tones, which is the one thing four dots could never
            show: whether 已确认 / 待回复 / 停滞 are still three colours in this
            palette, or have collapsed into one accent. */}
        <span className="ds-card block flex-1 divide-y [border-color:var(--color-ink-800)] [divide-color:var(--color-ink-800)]">
          {row("陈先生 · 三房翻新", "48,500", "var(--color-jade)", "已确认")}
          {row("李太太 · 厨房", "22,800", "var(--color-brass)", "待回复")}
          {row("黄先生 · 店面", "96,000", "var(--color-clay)", "停滞")}
        </span>

        {/* The accent as a FILL, with its own label colour on it -- the pair
            that fails most often, and the only place it shows. */}
        <span className="flex items-center justify-between gap-2">
          <span className="truncate [color:var(--color-paper)] [font-family:var(--font-display)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {label}
          </span>
          <span
            className="shrink-0 [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-micro)] [padding:5px_12px]"
          >
            发出报价
          </span>
        </span>
      </span>
    </span>
  );
}
