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

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
};

const STYLE_ORDER: StyleName[] = ["ledger", "hearth", "blueprint"];

/** Each 版式's own colours, for the 「原本的配色」 card. Read off the three
 *  token files rather than invented, so the swatch and the system agree. */
const NATIVE_DOTS: Record<StyleName, [string, string, string, string]> = {
  ledger: ["#f3f4f6", "#b8500f", "#d3dbe5", "#e4e9f0"],
  hearth: ["#faf6f0", "#237570", "#ded5c8", "#efe9e0"],
  blueprint: ["#f3f7fe", "#2261dd", "#b9c6dc", "#e2e9f6"],
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
                <div
                  className={`${scopeClasses(name, activePalette)} ${chrome.sheet} m-3 h-[268px] overflow-hidden [background-color:var(--color-canvas)]`}
                >
                  <div className="pointer-events-none origin-top-left [width:150%] [transform:scale(0.6667)]">
                    <div className="[padding:var(--pad-card-lg)]">
                      <Render config={puckConfig} data={SAMPLE as never} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t px-4 py-3 [border-color:var(--color-ink-800)]">
                  <span className="min-w-0">
                    <span className="block [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                      {name === "ledger" ? "Ledger" : name === "hearth" ? "Hearth" : "Blueprint"}
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
              dots={NATIVE_DOTS[active]}
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
                dots={p.dots}
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

/** One palette, shown as what it is: four colours and a name.
 *  Deliberately not a rendered sample — a palette changes only colour, so a
 *  swatch is a complete description of it, and eleven rendered samples on one
 *  page would take longer to scan than the decision deserves. */
function PaletteCard({
  label,
  blurb,
  dots,
  current,
  pending,
  disabled,
  onPick,
}: {
  label: string;
  blurb: string;
  dots: [string, string, string, string];
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
        className={`block w-full overflow-hidden rounded-[var(--radius-md)] p-4 text-left transition-colors disabled:cursor-default ${
          current
            ? "[border:2px_solid_var(--color-primary)]"
            : "[border:1px_solid_var(--color-ink-800)] enabled:hover:[border-color:var(--color-paper-dim)]"
        }`}
        style={{ backgroundColor: dots[0] }}
      >
        <span className="flex gap-1.5">
          {dots.map((c, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="h-5 w-5 rounded-[var(--radius-pill)] [border:1px_solid_rgba(0,0,0,0.08)]"
              style={{ backgroundColor: c }}
            />
          ))}
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
