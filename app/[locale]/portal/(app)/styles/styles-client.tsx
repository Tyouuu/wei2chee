"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Render, type Data } from "@puckeditor/core";
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
import { PagePreview } from "@/app/[locale]/portal/page-preview";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  large: styles.large,
  stamp: styles.stamp,
  swiss: styles.swiss,
  soft: styles.soft,
  brut: styles.brut,
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
  previewPages,
}: {
  locale: string;
  style: StyleName;
  palette: string | null;
  /** The customer's own pages, for the tiles to play through. */
  previewPages: { key: string; label: string; data: Data }[];
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

        <ul className="mt-6 grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
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
                  {/* THE CUSTOMER'S OWN DASHBOARD, TRAVELLING.
                      It was the register's name typed beside the word 报价单
                      over a hand-built three-row table — one artefact, from
                      one page, drawn by hand, shown to somebody deciding what
                      their WHOLE SYSTEM will look like. 「为什么要做报价单 到底
                      是谁教你做报价单的 不能是从dashboard第一页开始」. */}
                  <PageReel register={name} pages={previewPages} />
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

          {/* FOUR ACROSS AT 1440, matching 21st.dev's Themes grid exactly --
              measured, four columns of 332px with a 32/24 gap. It was three
              across, and at three the accent band is a 380px wall of one colour
              that shouts down its neighbours; at four you compare them. */}
          <ul className="mt-5 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                dots={p.dots}
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
  dots,
  styleName,
  paletteKey,
  current,
  pending,
  disabled,
  onPick,
}: {
  label: string;
  blurb: string;
  /** ground / accent / line / fill. Absent on the native pairing, whose colours
   *  belong to the register rather than to a palette row. */
  dots?: readonly string[];
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
          <PaletteSample label={label} dots={dots} />
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

/**
 * ONE PALETTE, DRAWN 21ST.DEV'S WAY — WHICH IS NOT 21ST.DEV'S PICTURE.
 *
 * Their Themes grid was opened with a browser on 2026-08-26 and measured: four
 * across at 332px, and each card is a plain rectangle painted in that theme's
 * own background, four colour dots in the top-left, the theme's name inside it
 * at the bottom-left in the theme's own foreground. Zen Linen's card is linen,
 * Catppuccin's is lavender, Vercel's is white. The card IS the colour, at field
 * size, and that is why their grid reads instantly.
 *
 * COPYING THAT PICTURE HERE WOULD MAKE THIS PAGE WORSE, and the numbers say so
 * rather than an opinion. Across our 25 palettes the ground runs oklch L
 * 0.880–1.000 at chroma 0.000–0.053: TWENTY-FOUR OF TWENTY-FIVE are near-white.
 * The accent runs L 0.000–0.589 at chroma up to 0.237. A field of ground colour
 * would be twenty-five identical white rectangles with a dot in the corner —
 * which is exactly what this card was before, and exactly why it read as
 * unfinished.
 *
 * So the METHOD transfers and the picture does not. Their method is: give the
 * field to the axis that carries the identity. Theirs is the ground. Ours is
 * the accent. Hence a full-bleed band of the palette's own accent with its name
 * on it — which is also the pairing that fails most often (--color-on-primary
 * against --color-primary), so the card proves its own contrast — over the
 * ground, carrying their four dots and the three status tones.
 *
 * The status tones stay because they are the one thing four dots cannot say:
 * whether 已确认 / 待回复 / 停滞 are still three distinguishable colours in this
 * palette or have collapsed into the accent. Measured on 2026-08-23: 21 of 25
 * cannot carry status meaning in the accent alone.
 */
function PaletteSample({ label, dots }: { label: string; dots?: readonly string[] }) {
  /*
    WHICH AXIS GETS THE FIELD, PER PALETTE.

    The rule above -- give the field to the axis that carries the identity --
    was applied once, to the set: our accents vary and our grounds do not, so
    the accent got the field. 宣纸 broke that the moment it landed, and the
    screenshot said so immediately: a near-black accent on warm paper drew as a
    black rectangle, indistinguishable from 极简黑, with the one thing that
    makes it itself squeezed into the strip underneath.

    So the rule applies per palette instead. An accent with almost no chroma is
    not the statement; the ground it sits on is. Read from the palette's own
    accent dot rather than hard-coded by name, so a future near-neutral gets the
    same treatment without anybody remembering to add it to a list.
  */
  const accent = dots?.[1] ?? "";
  const chroma = Number(/oklch\(\s*[\d.]+\s+([\d.]+)/.exec(accent)?.[1] ?? "1");
  const groundLeads = chroma < 0.03;

  return (
    <span
      className="ds-ground relative block w-full overflow-hidden [background-color:var(--color-canvas)]"
      /* 3:2, not their 4:3. The accent needs a field, not a canvas: at 4:3 the
         card became a block of colour with a strip of information under it. */
      style={{ aspectRatio: "3 / 2" }}
    >
      <span className="flex h-full flex-col">
        {/* THE FIELD. Not a dot, not a button — the thing being chosen, at the
            size it is chosen at. Which colour fills it is decided above. */}
        <span
          className="flex flex-1 items-end [padding:12px_14px]"
          style={{
            backgroundColor: groundLeads
              ? "var(--color-canvas)"
              : "var(--color-primary)",
          }}
        >
          {/* A near-neutral accent still has to be visible, and on its own
              ground it is the ink rather than the paint: shown as the swatch
              the name sits beside. */}
          {groundLeads ? (
            <span
              className="mr-2.5 block size-[18px] shrink-0 [border-radius:var(--radius-xs)] [background-color:var(--color-primary)]"
              aria-hidden
            />
          ) : null}
          <span
            className="truncate [font-family:var(--font-display)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]"
            style={{
              color: groundLeads ? "var(--color-paper)" : "var(--color-on-primary)",
            }}
          >
            {label}
          </span>
        </span>

        <span className="flex shrink-0 items-center justify-between gap-3 [padding:11px_14px]">
          {/* Their four dots, unchanged: ground, accent, line, fill. Read out
              of the palette by the generator, never picked to resemble it. */}
          <span className="flex items-center gap-1.5">
            {(dots ?? []).map((c, i) => (
              <span
                key={i}
                className="block size-[15px] rounded-full [box-shadow:inset_0_0_0_1px_rgb(0_0_0/0.08)]"
                style={{ backgroundColor: c }}
              />
            ))}
          </span>

          <span className="flex items-center gap-2">
            {[
              ["var(--color-jade)", "已确认"],
              ["var(--color-brass)", "待回复"],
              ["var(--color-clay)", "停滞"],
            ].map(([c, w]) => (
              <span
                key={w}
                className="flex items-center gap-1 [font-size:var(--text-micro)]"
                style={{ color: c }}
              >
                <span className="block size-1.5 rounded-full" style={{ backgroundColor: c }} />
                {w}
              </span>
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * The tile, moving. Same behaviour as the editor's style sheet, and see
 * design-system/editor/style-sheet.tsx for the whole argument: measured on
 * 21st.dev on 2026-08-26, a gallery tile is a still or it is continuous
 * motion, and never a slideshow. This one travels down the dashboard and back;
 * the other pages are a click away under it rather than a cut every 2.5s.
 */
function PageReel({
  register,
  pages,
}: {
  register: StyleName;
  pages: { key: string; label: string; data: Data }[];
}) {
  if (!pages.length) return null;
  return (
    /* The register's own scope covers the picture and stops there -- a light
       register's near-black --color-paper would print the caption below it
       black on the portal's dark card. */
    <div className="flex h-full flex-col">
      <StyleScope
        register={register}
        className="ds-ground min-h-0 flex-1 overflow-hidden [background-color:var(--color-canvas)]"
      >
        <PagePreview data={pages[0].data} strip={pages.slice(1).map((p) => p.data)} />
      </StyleScope>
      {pages.length > 1 ? (
        <span className="shrink-0 pt-2 [color:var(--color-paper-dim)] [font-size:11px]">
          {pages.map((p) => p.label).join(" · ")}
        </span>
      ) : null}
    </div>
  );
}
