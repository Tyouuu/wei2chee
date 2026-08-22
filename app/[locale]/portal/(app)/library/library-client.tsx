"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Render } from "@puckeditor/core";
import { puckConfig } from "@/design-system/editor/puck-config";
import { PageBar } from "../page-bar";
import { LIBRARY_SAMPLES } from "./samples";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import chrome from "../../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

import { StyleScope } from "@/design-system/editor/style-scope";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  bare: styles.bare,
  docket: styles.docket,
  large: styles.large,
  stamp: styles.stamp,
  contract: styles.contract,
  swiss: styles.swiss,
  soft: styles.soft,
  brut: styles.brut,
  ink: styles.ink,
};

type Entry = { name: string; label: string; category: string; props: Record<string, unknown> };

/**
 * Structural components. They ARE registered and a customer can drag them, but
 * a page frame or a whole navigation rail rendered inside a 400px card is a
 * picture of a box, not a sample — so they are described rather than rendered.
 * Naming them here keeps the gallery honest about the full set rather than
 * quietly showing a shorter list than the editor offers.
 */
const STRUCTURAL = new Set(["SystemShell", "RailNav"]);

/**
 * Components that are ONE CONTROL rather than a page section.
 *
 * They need centring, not because it looks tidier but because top-aligning a
 * 24px status dot in a 168px frame renders a card that is 85% empty ground --
 * which reads as a component that failed to load, not as a specimen of a
 * status dot. 21st.dev never hits this: everything in their gallery is a
 * full-width marketing block that fills its own tile.
 *
 * A set rather than a measurement because the height is only knowable after
 * render, and a layout that reflows once it has measured itself is a worse
 * problem than a list that has to be kept current.
 */
const SINGLE_CONTROL = new Set([
  "StatusDot",
  "Avatar",
  "Tag",
  "ActionButton",
  "Stars",
  "Divider",
  "NoteField",
  "Progress",
  "Alert",
  "DatePicker",
  "MonthPicker",
  "Listbox",
  "Combobox",
  "TextAutocomplete",
  "FilterChips",
  "FileUploadField",
  "EmptyState",
  // Second wave.
  "CheckRow",
  "SwitchRow",
  "SliderRow",
  "ChoiceRow",
  "TagPicker",
  "WeekStrip",
  "PageNumbers",
  "CopyValue",
  "NoticePill",
  "SmallStat",
  "FaceRow",
]);

/** The two that are not just short but NARROW. A status dot and an avatar are
 *  a few dozen pixels wide, so left-aligning them leaves the specimen pinned to
 *  one corner of an otherwise empty card. Everything else in SINGLE_CONTROL is
 *  full-width and belongs on the left margin like real page content. */
const TINY = new Set([
  "StatusDot",
  "Avatar",
  "Tag",
  "ActionButton",
  "Stars",
  "Divider",
  "FaceRow",
  "PayQr",
]);

export function LibraryClient({
  locale,
  style,
  palette,
  firstPage,
}: {
  locale: string;
  style: StyleName;
  /** The customer's 配色 layer, or null for this layout's native colours. */
  palette: string | null;
  /** Where 「去用它」 sends the block. The customer's own first page, not a
   *  hardcoded `dashboard` — a business whose trade has no dashboard route
   *  would have been sent to a 404. */
  firstPage: string;
}) {
  const t = useTranslations("portal.library");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  // Which block is open at full size. A thumbnail answers "which one is the
  // table"; it cannot answer "what will this actually look like on my page",
  // and that second question is the one a customer has before committing.
  const [zoomed, setZoomed] = useState<Entry | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const categories = puckConfig.categories ?? {};
    const out: Entry[] = [];
    for (const [key, cat] of Object.entries(categories)) {
      for (const name of (cat as { components?: string[] }).components ?? []) {
        const config = (puckConfig.components as Record<string, { label?: string; defaultProps?: Record<string, unknown> }>)[name];
        if (!config) continue;
        out.push({
          name,
          label: config.label ?? name,
          category: key,
          // The library's own sample where one exists, otherwise the same
          // defaults a drag produces. Defaults are tuned to be a sane STARTING
          // POINT for editing (one placeholder row, empty optional fields),
          // which is the right call in the editor and the wrong one in a
          // gallery — a table with a single "示例记录 #1" row does not show
          // what a table is for. See samples.ts.
          props: { ...(config.defaultProps ?? {}), ...(LIBRARY_SAMPLES[name] ?? {}), id: `lib-${name}` },
        });
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (active && e.category !== active) return false;
      if (!q) return true;
      return e.label.toLowerCase().includes(q) || e.name.toLowerCase().includes(q);
    });
  }, [entries, query, active]);

  // Counts come off the UNFILTERED set on purpose. A facet whose number drops
  // to 0 the moment you pick another facet is telling you about the filter,
  // not about the library -- and the whole reason the number is there is to say
  // how much is in the library.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return map;
  }, [entries]);

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filtered) {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    }
    return map;
  }, [filtered]);

  const categoryTitle = (key: string) =>
    ((puckConfig.categories ?? {}) as Record<string, { title?: string }>)[key]?.title ?? key;

  return (
    <>
      <PageBar title={t("title")} subtitle={t("subtitle", { count: entries.length })}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-52 rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] outline-none [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]"
        />
      </PageBar>

      <div className="px-8 py-7">
        <p className="max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {t("body")}
        </p>

        {/* FACETED FILTERING, WITH THE COUNTS ON THE FACETS.
            This is the one thing on 21st.dev that a solo founder can actually
            copy. Their rail reads Backgrounds 365, Calls to Action 501,
            Heroes 1152 -- the count lives beside the category name, 11px and
            grey, never as a separate statistic. It is what makes a finite
            library read as a deep one, and it is why their 12,000 components
            feel browsable while a flat list of nineteen does not.
            Nineteen is nineteen. Saying so, per category, is free. */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Chip active={active === null} onClick={() => setActive(null)}>
            {t("filterAll")}
            <Count n={entries.length} />
          </Chip>
          {[...counts.entries()].map(([category, n]) => (
            <Chip
              key={category}
              active={active === category}
              onClick={() => setActive(active === category ? null : category)}
            >
              {categoryTitle(category)}
              <Count n={n} />
            </Chip>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-8 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {t("noResults", { query })}
          </p>
        )}

        {[...grouped.entries()].map(([category, items]) => (
          <section key={category} className="mt-9">
            <h2 className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
              {categoryTitle(category)}
              <span className="ml-2 [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] opacity-60">
                {items.length}
              </span>
            </h2>

            {/* Four across, up from two.
                Measured on 21st.dev/s/card: a four-column grid of borderless
                previews with the name and byline printed BELOW each one, on the
                page ground, and 584 of 588 text nodes at weight 500. The card
                gives no pixels to labels at all. This gallery was doing the
                opposite -- a bordered box whose lower third held a Chinese
                name, an English component name and a button, with the actual
                component squeezed into what was left. */}
            <ul className="mt-4 grid items-start gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((entry) => (
                // `min-w-0`: a grid track is `minmax(auto, 1fr)` by default, so
                // it refuses to go below its content's min-width — and the
                // preview inside is deliberately composed at 154% and scaled
                // down, which the track reads as a 490px minimum. On a 390px
                // phone that pushed every tile off the right edge. Found by a
                // hit-test sweep, not by looking.
                <li key={entry.name} className="group min-w-0">
                  {/* FIXED HEIGHT, CLIPPED. `transform: scale()` does not
                      change the layout box, so the wrapper below still occupies
                      its full pre-scale height -- which showed up as a large
                      dead gap under short components and made every card in a
                      row stretch to the tallest one. A fixed frame gives
                      uniform tiles and clips what does not fit, which is what a
                      gallery thumbnail is supposed to do.

                      The frame is now a mount: the clipping is done by
                      `.mount > *` rather than by this element, and the hover
                      affordance is a lift rather than a coloured ring, because
                      the ring was drawn in --color-primary and Formae no
                      longer has an accent to draw it in. */}
                  {/* The frame is the zoom control. 21st.dev opens a full
                      preview on click and that is the step this gallery was
                      missing: a 168px thumbnail answers "which one is the
                      table", never "what will this look like on my page".
                      The NAME underneath is still the add link, so the two
                      actions never fight — look here, take it there. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setZoomed(entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setZoomed(entry);
                      }
                    }}
                    aria-label={t("zoom", { name: entry.label })}
                    className={`${chrome.mount} block h-[168px] w-full cursor-zoom-in transition-transform duration-200 group-hover:-translate-y-0.5`}
                  >
                    <StyleScope
                      register={style} palette={palette} className="[background-color:var(--color-canvas)]"
                    >
                      {STRUCTURAL.has(entry.name) ? (
                        <p className="[padding:var(--pad-card)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
                          {t(`structural.${entry.name}`)}
                        </p>
                      ) : (
                        // `pointer-events-none`: these are samples, not controls.
                        // A customer clicking a date picker here would open a
                        // calendar that writes to nothing.
                        <div
                          className={`pointer-events-none origin-top-left [width:154%] [transform:scale(0.65)] ${
                            SINGLE_CONTROL.has(entry.name)
                              ? `flex h-[258px] items-center ${TINY.has(entry.name) ? "justify-center" : ""}`
                              : ""
                          }`}
                        >
                          <div className="w-full [padding:var(--pad-card)]">
                            <Render
                              config={puckConfig}
                              data={{ root: {}, content: [{ type: entry.name, props: entry.props }] } as never}
                            />
                          </div>
                        </div>
                      )}
                    </StyleScope>
                  </div>

                  {/* Outside the card, on the page ground. Two sizes, two inks,
                      no button -- 「去用它」 was a control competing with the
                      thing it described, on every one of nineteen cards. The
                      whole tile is the link now, which is also what a customer
                      tries first. */}
                  <div className="mt-3">
                    {STRUCTURAL.has(entry.name) ? (
                      <>
                        <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                          {entry.label}
                        </span>
                        <span className="block truncate [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                          {entry.name}
                        </span>
                      </>
                    ) : (
                      // A real action, not a link to the editor's front door.
                      // `?add=` is read server-side in [pageKey]/page.tsx and
                      // applied through the SAME add_component operation the AI
                      // assistant uses, so the block lands in the main column
                      // exactly as a drag would -- unsaved, undoable, and behind
                      // the same paid gate. Without this the library is a
                      // brochure.
                      <Link
                        href={`/${locale}/portal/${firstPage}?add=${entry.name}`}
                        className="block"
                      >
                        <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] group-hover:[color:var(--color-primary)]">
                          {entry.label}
                        </span>
                        <span className="block truncate [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                          {entry.name}
                        </span>
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-12 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {t("moreComing")}
        </p>
      </div>
      {/* Rendered at real size in the customer's own style, on their own
          ground — the same tokens the editor canvas uses, so what is shown here
          is what lands on the page. Native <dialog> rather than a portal: it
          gets the top layer, Escape and the backdrop for free, and this file
          already has no modal machinery. */}
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.label}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 sm:p-8"
          onClick={() => setZoomed(null)}
        >
          <div
            className="flex max-h-full w-full max-w-4xl flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-baseline gap-3">
              <span className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {zoomed.label}
              </span>
              <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                {zoomed.name}
              </span>
              <span className="flex-1" />
              <Link
                href={`/${locale}/portal/${firstPage}?add=${zoomed.name}`}
                className="rounded-[var(--radius-md)] [background-color:var(--color-paper)] [color:var(--color-canvas)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] px-3 py-1.5"
              >
                {t("useIt")}
              </Link>
              <button
                type="button"
                onClick={() => setZoomed(null)}
                aria-label={t("close")}
                className="rounded-[var(--radius-md)] [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] px-3 py-1.5"
              >
                ✕
              </button>
            </div>
            <div className={`${chrome.mount} min-h-0 overflow-auto`}>
              <StyleScope
                register={style} palette={palette} className="[background-color:var(--color-canvas)]"
              >
                <div className="[padding:var(--pad-card-lg)]">
                  <Render
                    config={puckConfig}
                    data={{ root: {}, content: [{ type: zoomed.name, props: zoomed.props }] } as never}
                  />
                </div>
              </StyleScope>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** A filter facet. Pill-shaped and quiet until selected, because on this page
 *  nineteen of them would otherwise out-shout the components they filter. */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius-pill)] border px-3.5 py-1.5 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] transition-colors ${
        active
          ? "[background-color:var(--color-paper)] [border-color:var(--color-paper)] [color:var(--color-ink-900)]"
          : "[background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] hover:[border-color:var(--color-paper-dim)] hover:[color:var(--color-paper)]"
      }`}
    >
      {children}
    </button>
  );
}

/** The count that rides along with a facet's name. Tabular so a row of chips
 *  does not jitter, and always dimmer than the label -- it is a qualifier, not
 *  the thing being named. */
function Count({ n }: { n: number }) {
  return (
    <span className="ml-2 [font-family:var(--font-numeric)] [font-size:var(--text-xs)] tabular-nums opacity-55">
      {n}
    </span>
  );
}
