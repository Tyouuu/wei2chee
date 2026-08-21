"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Render } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { puckConfig } from "@/design-system/editor/puck-config";
import { PageBar } from "../page-bar";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import chrome from "../../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { PALETTES, scopeClasses } from "@/lib/portal/palettes";
import { StatusDot } from "@/design-system/components/status-dot";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  bare: styles.bare,
  docket: styles.docket,
};

const STYLE_ORDER: StyleName[] = ["ledger", "hearth", "blueprint", "bare", "docket"];

/** The name a customer sees. Was two hardcoded ternaries in two files, which is
 *  why a fourth style would have rendered as "Blueprint" in both. */
export const STYLE_LABEL: Record<StyleName, string> = {
  ledger: "Ledger",
  hearth: "Hearth",
  blueprint: "Blueprint",
  bare: "Bare",
  docket: "Docket",
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
const SAMPLE = {
  root: {},
  content: [
    {
      type: "PageHeader",
      props: { id: "s-h", title: "报价单", subtitle: "发给客户的报价，跟进哪些已确认。" },
    },
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
                  <div
                    className={`${scopeClasses(name, activePalette)} [background-color:var(--color-canvas)]`}
                  >
                    <div className="pointer-events-none origin-top-left [width:150%] [transform:scale(0.6667)]">
                      <div className="[padding:var(--pad-card-lg)]">
                        <Render config={puckConfig} data={SAMPLE as never} />
                      </div>
                    </div>
                  </div>
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

          <ul className="mt-5 grid gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-5">
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
  styleName,
  paletteKey,
  current,
  pending,
  disabled,
  onPick,
}: {
  label: string;
  blurb: string;
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
        <span className={`${scopeClasses(styleName, paletteKey)} block`}>
          <PaletteSample />
        </span>
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
    </li>
  );
}

/** The smallest fragment that shows everything a palette decides: the ground,
 *  the accent on a figure and on a button, and the three status tones a
 *  business system actually leans on — confirmed, waiting, overdue. Rendered at
 *  real size rather than scaled, because a palette is judged on colour and
 *  colour survives being small; the layouts above are the ones that need
 *  room. */
function PaletteSample() {
  const row = (name: string, amount: string, tone: "positive" | "warning" | "negative", label: string) => (
    <span className="flex items-center gap-2 border-t [border-color:var(--border)] px-3 py-1.5 [font-size:var(--text-xs)]">
      <span className="min-w-0 flex-1 truncate [color:var(--foreground)]">{name}</span>
      <span className="[font-family:var(--font-numeric)] [color:var(--foreground)]" style={{ fontVariantNumeric: "tabular-nums" }}>
        {amount}
      </span>
      <span className="flex shrink-0 items-center gap-1 [color:var(--muted-foreground)]">
        <StatusDot tone={tone} label={label} />
      </span>
    </span>
  );

  return (
    <span className="block bg-background">
      <span className="flex items-end justify-between gap-2 px-3 pt-3 pb-2">
        <span className="block">
          <span
            className="block [color:var(--muted-foreground)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)]"
            style={{ textTransform: "var(--label-transform)" as never }}
          >
            本月已确认
          </span>
          <span className="block [color:var(--foreground)] [font-family:var(--font-numeric)] [font-size:var(--text-lg)] [font-weight:var(--fw-display)]">
            RM 71,300
          </span>
        </span>
        <span className="shrink-0 rounded-[var(--radius-control)] [background-color:var(--primary)] [color:var(--primary-foreground)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] px-2 py-1">
          新增
        </span>
      </span>
      {row("Taman Desa 三房翻新", "48,500", "positive", "已确认")}
      {row("Cheras 店面装修", "96,000", "negative", "已逾期")}
    </span>
  );
}
