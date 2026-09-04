"use client";

import { useState } from "react";
import { siteSkeleton } from "@/lib/templates/site-composition";
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
  swiss: styles.swiss,
  signboard: styles.signboard,
  counter: styles.counter,
};


/** The name a customer sees. Was two hardcoded ternaries in two files, which is
 *  why a fourth style would have rendered as "Blueprint" in both. */
export const STYLE_LABEL: Record<StyleName, string> = {
  ledger: "Ledger",
  hearth: "Hearth",
  blueprint: "Blueprint",
  swiss: "Swiss",
  signboard: "Signboard",
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
  const zh = locale === "zh";
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
    /* WHICH ONE IS ON, stated rather than inferred. shoot:skeletons has to put
       the register back when it is done, and 「the card with no 换成这个 button」
       is the kind of inference that quietly starts matching the wrong element
       -- which is exactly how shoot:registers came to photograph 台账 and file
       it as 工作室. See the note on data-register below. */
    <div data-register-current={style} className="contents">
      {/* COUNTED, NOT TYPED. It read 「同一套系统,十种做法」 while the set held
          seventeen, and the English said 「five ways」 -- both were written when
          the number was true and neither moved when it changed. Three culls have
          gone past those two strings. */}
      <PageBar title={t("title")} subtitle={t("subtitle", { n: STYLE_ORDER.length })}>
        {failed && (
          <span role="status" className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
            {tEditor("styleFailed")}
          </span>
        )}
      </PageBar>

      <div className="px-8 py-7">
        <p className="max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {tHome("styleBody", { n: STYLE_ORDER.length })}
        </p>

        <ul className="mt-6 grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {STYLE_ORDER.map((name) => {
            const isActive = name === active;
            return (
              <li
                key={name}
                /*
                  A HOOK FOR THE TWO RULERS THAT JUDGE THIS PAGE.

                  check:registers and shoot:registers both used to find a card
                  by looking for the register's NAME in an <li>. That worked
                  while a card was a name over a hand-drawn table. Since the
                  cards became live travelling previews of the customer's own
                  pages, every card contains hundreds of <li>s of somebody
                  else's content, and both scripts started matching the wrong
                  element -- shoot:registers photographed 台账 and filed it as
                  工作室, and check:registers reported 「0 / 0, every register is
                  structurally distinct」, which is true and worthless.

                  A ruler that passes by finding nothing is worse than no ruler.
                  So the card carries its own name in an attribute that no copy
                  change and no preview can imitate.
                */
                data-register={name}
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
                      data-register-use={name}
                      disabled={Boolean(pending)}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors disabled:opacity-50 enabled:hover:[border-color:var(--color-primary)]"
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
          {/* `portal.styles.moreComing` existed and nothing rendered it -- the
              library page reads its own key of the same name. It said 「十种版式
              × 十一种配色」 and had gone past three culls without moving, which is
              what a string nobody draws does. Counted now, and drawn. */}
          <p className="mt-1.5 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
            {t("moreComing", { styles: STYLE_ORDER.length, palettes: PALETTES.length + 1 })}
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
                // Chrome, so it follows the interface locale. See PaletteRow:
                // the English is written out rather than translated, because
                // 「深红配奶油底,老字号的正式红」 has no faithful machine rendering
                // and 老字号 has no one-word English equivalent at all.
                label={zh ? p.label : p.labelEn}
                blurb={zh ? p.blurb : p.blurbEn}
                who={zh ? p.who : p.whoEn}
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
    </div>
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
 * ONE PALETTE — THEIR ARRANGEMENT, NOT THEIR FILL.
 *
 * Two galleries were opened with a browser on 2026-08-26 and measured rather
 * than recalled: 21st.dev's Themes grid (four across at 332px) and tweakcn's
 * community grid. They run the same card, and the founder's read of it was
 * right — 「他的好像擺放的比較好看」. It is ONE clean field, the name large at the
 * bottom-left, a row of tall colour bars in the corner, and the metadata
 * outside underneath.
 *
 * This card had the name inside AND a dense two-part strip below it — four
 * circles plus three labelled status words. That strip was the clutter, and
 * that is the part their layout fixes. Six bars, primary tallest and the
 * neutrals stepping down, carry the same information in less room: four circles
 * read as decoration where a ramp reads as a scale.
 *
 * THE FILL IS THE PART THAT DOES NOT TRANSFER, and the only way I learned it
 * was to build both and look. Their card is painted in the theme's GROUND, and
 * it works because their grounds genuinely differ — cream, linen, white, grey.
 * Ours do not: measured, 9 of our 10 sit at oklch L 0.880–1.000, so a
 * ground-filled grid is nine near-white rectangles. Filling with the ACCENT
 * instead says what 朱红 is at a glance and makes a wall of ten saturated
 * blocks.
 *
 * Theirs is a gallery to browse. This is a picker: ten of them, once, by an
 * owner answering 「我的系统要什么颜色」. So the card is split — the upper two
 * thirds is the ground with the ramp on it, the lower third is the accent with
 * the name on it. Both axes at the size each is actually used, and it is the
 * first version in which 宣纸's warm linen reads as different from 极简黑's white
 * without being told.
 *
 * The three status tones stay because they are the one thing a row of neutrals
 * cannot say: whether 已确认 / 待回复 / 停滞 are still three distinguishable
 * colours in this palette or have collapsed into the accent. Measured
 * 2026-08-23: 21 of 25 could not carry status meaning in the accent alone.
 */
function PaletteSample({ label, dots }: { label: string; dots?: readonly string[] }) {
  return (
    <span
      className="ds-ground relative flex w-full flex-col overflow-hidden [background-color:var(--color-canvas)]"
      /* 3:2, not 21st.dev's 4:3. The accent needs a field, not a canvas. */
      style={{ aspectRatio: "3 / 2" }}
    >
      {/*
        BOTH AXES AT FIELD SIZE — the third answer, arrived at by building the
        other two and looking.

        Filling the whole card with the ACCENT tells you instantly what 朱红 is
        and makes a grid of ten saturated blocks.

        Filling it with the GROUND is tweakcn's own layout and reads calmer and
        more professional — and produces nine near-white rectangles here,
        because their grounds genuinely differ (cream, linen, white, grey) and
        ours do not: measured, 9 of our 10 sit at oklch L 0.88–1.00.

        Theirs is a gallery to browse. This is a picker: ten of them, once,
        by an owner answering 「我的系统要什么颜色」. So the card gives the upper
        two-thirds to the ground with the ramp on it, and the lower third to the
        accent with the name on it. You can read the ground AND the accent at
        the size each is actually used, which is what the question needs.
      */}
      <span className="relative flex flex-[1.6] [background-color:var(--color-canvas)]">
        {/*
          THE RAMP, TOP-RIGHT — 21st.dev's card layout, and tweakcn's, both of
          which do the same thing: 「他的好像擺放的比較好看」, 2026-08-26.

          Measured against ours: theirs is ONE clean field with the name large
          at the bottom-left and a row of tall colour bars in the corner. Ours
          had the name inside and then a dense two-part strip underneath — four
          circles AND three labelled status words — which is where the clutter
          was. The bars carry more information in less room: six of them show
          the whole scale at a glance, where four circles read as decoration.

          Ours holds the three status tones as well as the neutrals, because
          those are the one thing a set of neutrals cannot say — whether
          已确认 / 待回复 / 停滞 are still three distinguishable colours in this
          palette or have collapsed into the accent. Measured 2026-08-23: 21 of
          25 could not carry status meaning in the accent alone.
        */}
        <span className="absolute right-4 top-4 flex items-start gap-[5px]" aria-hidden>
          {[
            // The primary leads the ramp: the bars sit on the GROUND half, so
            // it is never painted on its own colour.
            "var(--color-primary)",
            "var(--color-jade)",
            "var(--color-brass)",
            "var(--color-clay)",
            ...(dots ?? []).slice(2),
          ].map((c, i) => (
            <span
              key={i}
              className="block w-[9px] rounded-full"
              style={{
                backgroundColor: c,
                // A ramp, not a row: the accent is the tallest and the
                // neutrals step down, so the eye reads an order rather than a
                // set of equals.
                height: `${34 - i * 4}px`,
                boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)",
              }}
            />
          ))}
        </span>

      </span>

      {/* THE ACCENT BAND, with the name on it — which also makes the card prove
          the pairing that fails most often, --color-on-primary against
          --color-primary. */}
      <span className="flex flex-1 items-center [background-color:var(--color-primary)] [padding:0_16px]">
        <span className="truncate [color:var(--color-on-primary)] [font-family:var(--font-display)] [font-size:var(--text-xl)] [font-weight:var(--fw-semibold)]">
          {label}
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
      {/* 🔴 官网那一页要穿官网的框（2026-09-04）。缩图从「客户的四页系统」
          换成「客户的官网」之后，少了这个框画出来的是**另一页** ——
          没有版心、没有节奏、标题是工作台的尺寸。`.ds-site` 跟这几个
          data 属性是 app/s/[slug]/public-site.tsx 上线时就在用的同一组，
          从那里抄过来，不是新发明的。 */}
      <StyleScope
        register={register}
        data-ground={siteSkeleton(register).ground ?? "page"}
        data-pattern={siteSkeleton(register).pattern}
        data-measure={siteSkeleton(register).measure ?? "normal"}
        data-rhythm={siteSkeleton(register).rhythm ?? "normal"}
        data-figure={siteSkeleton(register).figure ?? "normal"}
        data-copy={siteSkeleton(register).copy ?? "normal"}
        data-steps={siteSkeleton(register).steps}
        data-frame={siteSkeleton(register).frame ?? "none"}
        className="ds-ground min-h-0 flex-1 overflow-hidden [background-color:var(--color-canvas)]"
      >
        <div className="ds-site flex flex-col">
          <PagePreview data={pages[0].data} strip={pages.slice(1).map((p) => p.data)} />
        </div>
      </StyleScope>
      {pages.length > 1 ? (
        <span className="shrink-0 pt-2 [color:var(--color-paper-dim)] [font-size:11px]">
          {pages.map((p) => p.label).join(" · ")}
        </span>
      ) : null}
    </div>
  );
}
