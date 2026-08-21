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

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
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

export function LibraryClient({
  locale,
  style,
  firstPage,
}: {
  locale: string;
  style: StyleName;
  /** Where 「去用它」 sends the block. The customer's own first page, not a
   *  hardcoded `dashboard` — a business whose trade has no dashboard route
   *  would have been sent to a 404. */
  firstPage: string;
}) {
  const t = useTranslations("portal.library");
  const [query, setQuery] = useState("");

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
    if (!q) return entries;
    return entries.filter(
      (e) => e.label.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
    );
  }, [entries, query]);

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

        {filtered.length === 0 && (
          <p className="mt-8 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {t("noResults", { query })}
          </p>
        )}

        {[...grouped.entries()].map(([category, items]) => (
          <section key={category} className="mt-9">
            <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
              {categoryTitle(category)}
              <span className="ml-2 opacity-60">{items.length}</span>
            </h2>

            <ul className="mt-4 grid items-start gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {items.map((entry) => (
                <li
                  key={entry.name}
                  className="overflow-hidden rounded-[var(--radius-lg)] [border:1px_solid_var(--color-ink-800)] [background-color:var(--color-ink-900)]"
                >
                  {/* FIXED HEIGHT, CLIPPED. `transform: scale()` does not
                      change the layout box, so the wrapper below still occupies
                      its full pre-scale height — which showed up as a large
                      dead gap under short components and made every card in a
                      row stretch to the tallest one. A fixed frame gives
                      uniform tiles and clips what does not fit, which is what a
                      gallery thumbnail is supposed to do. */}
                  <div
                    className={`${styles.scope} ${SCOPE_CLASS[style]} ${chrome.sheet} m-3 h-[190px] overflow-hidden [background-color:var(--color-canvas)]`}
                  >
                    {STRUCTURAL.has(entry.name) ? (
                      <p className="[padding:var(--pad-card-lg)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                        {t(`structural.${entry.name}`)}
                      </p>
                    ) : (
                      // `pointer-events-none`: these are samples, not controls.
                      // A customer clicking a date picker here would open a
                      // calendar that writes to nothing.
                      <div className="pointer-events-none origin-top-left [width:133.33%] [transform:scale(0.75)]">
                        <div className="[padding:var(--pad-card)]">
                          <Render
                            config={puckConfig}
                            data={{ root: {}, content: [{ type: entry.name, props: entry.props }] } as never}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t px-4 py-3 [border-color:var(--color-ink-800)]">
                    <span className="min-w-0">
                      <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                        {entry.label}
                      </span>
                      <span className="block truncate [font-size:var(--text-micro)] [color:var(--color-paper-dim)] [font-family:var(--font-mono)]">
                        {entry.name}
                      </span>
                    </span>
                    {/* A real action, not a link to the editor's front door.
                        `?add=` is read server-side in [pageKey]/page.tsx and
                        applied through the SAME add_component operation the AI
                        assistant uses, so the block lands in the main column
                        exactly as a drag would — unsaved, undoable, and behind
                        the same paid gate. Without this the library is a
                        brochure. */}
                    {!STRUCTURAL.has(entry.name) && (
                      <Link
                        href={`/${locale}/portal/${firstPage}?add=${entry.name}`}
                        className="shrink-0 rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors hover:[border-color:var(--color-primary)]"
                      >
                        {t("useIt")}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-10 max-w-2xl rounded-[var(--radius-md)] border border-dashed px-4 py-3 [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {t("moreComing")}
        </p>
      </div>
    </>
  );
}
