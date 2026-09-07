"use client";

import { useMemo, useState } from "react";
import { BLOCK_CATEGORIES, BLOCK_META } from "@/components/blocks";
import { PageBar } from "../page-bar";
import chrome from "../../chrome.module.css";
import { Specimen } from "@/design-system/editor/specimen";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { SECTION_SHELVES, shelfNames, orderShelves } from "./shelves";
import { useTranslations } from "next-intl";

/**
 * 版段库 — the 216 whole page sections pulled from the @7Ovr registry (MIT-0).
 *
 * ── WHY IT IS A SEPARATE PAGE FROM 组件库 ──────────────────────────────────
 *
 * 组件库 holds PARTS: a table, a status dot, a date picker. A customer goes
 * there to answer "what can my system be made of". This page holds whole
 * SECTIONS of a public website — a priced three-tier panel, an FAQ accordion,
 * a wall of testimonials — and the question is "what should my page say next".
 * Same gallery machinery, different question, so a different room. Mixing them
 * would put a 24px status dot and a full pricing section on the same shelf,
 * which is the pile again.
 *
 * ── WHAT A CUSTOMER CAN AND CANNOT CHANGE HERE ────────────────────────────
 *
 * 「模板是不可以改的 对不对 风格是可以改的」 — that line is this page. The
 * words inside these sections are the template's; the register is the
 * customer's. Every tile below is rendered through the SAME Specimen frame the
 * component library uses, inside their chosen register, so what is on screen
 * is what lands on the page. See design-system/editor/site-block.tsx.
 *
 * The layout is deliberately the one built for 组件库 on the same day — a
 * persistent rail, one shelf at a time, one frame per tile with the section
 * complete inside it. Copying it is the point: two galleries that browse
 * differently is two things to learn.
 */

/** One 版段 tile. Hoisted for the same reason 组件库's is — a component
 *  declared inside the render function is a new type every render, and each of
 *  these mounts a composed-then-scaled specimen with its own ResizeObserver. */
function SectionTile({
  name,
  style,
  palette,
}: {
  name: string;
  style: StyleName;
  palette: string | null;
}) {
  return (
    <li className="group min-w-0">
      <div
        className={`${chrome.exhibit} block h-[300px] w-full transition-transform duration-200 group-hover:-translate-y-0.5`}
      >
        <Specimen
          name="SiteBlock"
          props={{ id: `sec-${name}`, block: name }}
          style={style}
          palette={palette}
          // Composed at the width a marketing section is designed
          // for. At 620 (the component library's width) a three-tier
          // pricing grid stacks into one column and stops being the
          // thing it is.
          width={1200}
        />
      </div>
      <div className="mt-2.5">
        <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
          {BLOCK_META[name]?.title ?? name}
        </span>
        <span className="block truncate [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
          {name}
        </span>
      </div>
    </li>
  );
}

/** Tiles per front-door row. Three, because a 版段 is a whole page section
 *  and this grid runs three across where 组件库 runs four. */
const ROW = 3;

export function SectionsClient({
  locale,
  style,
  palette,
  initialQuery,
}: {
  locale: string;
  style: StyleName;
  palette: string | null;
  /* 🔴 从网址接住那个字。
     「找东西」那个面板搜到一个组件/版段，落点必须是**已经筛好的这一页** ——
     把人丢在一张 4,705px（版段库 21,417px）的页上，然后叫他自己找，
     就是这个仓库最常犯的那一类：能力有，线只接了一半。
     ⚠️ 从**服务端**穿下来，不用 `useSearchParams` —— 那要一层 Suspense，
     而且在 `useState` 初值里读 `window.location` 会让服务端跟浏览器
     渲染出两个不同的值。 */
  initialQuery?: string;
}) {
  const t = useTranslations("portal.sections");
  // Chrome, so it follows the interface locale. The SEARCH still reads the
  // Chinese names as well -- an owner who has been using this page in Chinese
  // and switches should not lose the word he was about to type.
  const names = shelfNames(locale);
  const [query, setQuery] = useState(initialQuery ?? "");
  /* null = the sectioned front door. See the grid below, and 组件库's own
     note: 21st.dev opens on rows, not on one shelf and not on everything. */
  const [active, setActive] = useState<string | null>(null);

  const shelves = useMemo(
    () => orderShelves(Object.keys(BLOCK_CATEGORIES)),
    [],
  );
  const total = useMemo(
    () =>
      Object.values(BLOCK_CATEGORIES).reduce((n, list) => n + list.length, 0),
    [],
  );

  const searching = query.trim().length > 0;
  const shown = useMemo<string[]>(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return Object.entries(BLOCK_META)
        .filter(
          ([name, m]) =>
            name.toLowerCase().includes(q) ||
            m.title.toLowerCase().includes(q) ||
            (SECTION_SHELVES[m.cats.split("/")[0]] ?? "").includes(q) ||
            (names[m.cats.split("/")[0]] ?? "").toLowerCase().includes(q),
        )
        .map(([name]) => name);
    }
    // null is the sectioned front door, which builds its own rows; this
    // list is only what the flat grid shows.
    return active ? (BLOCK_CATEGORIES[active] ?? []) : [];
  }, [query, active]);

  const shelfName = (k: string) => names[k] ?? SECTION_SHELVES[k] ?? k;

  return (
    <>
      <PageBar title={t("title")} subtitle={t("subtitle", { n: total })} />

      <div className="flex items-start gap-8 px-8 py-7">
        <nav className="sticky top-4 hidden w-[190px] shrink-0 lg:block">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="mb-4 w-full rounded-[var(--radius-md)] border px-3 py-2 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-xs)] outline-none focus-visible:[border-color:var(--color-paper-dim)]"
          />
          <ul className="flex flex-col gap-px">
            {/* 全部 sits at the top and goes back to the sectioned front
                door. Without it the rail is one way: you can enter a shelf and
                never get back out to the overview. */}
            <li>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActive(null);
                }}
                aria-current={
                  !searching && active === null ? "true" : undefined
                }
                className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left transition-colors [font-size:var(--text-xs)] ${
                  !searching && active === null
                    ? "[background-color:var(--color-ink-850)] [color:var(--color-paper)] [font-weight:var(--fw-medium)]"
                    : "[color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-900)] hover:[color:var(--color-paper)]"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{t("all")}</span>
                <span className="[font-family:var(--font-numeric)] tabular-nums opacity-55">
                  {total}
                </span>
              </button>
            </li>
            {shelves.map((key) => {
              const on = !searching && active === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActive(key);
                    }}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left transition-colors [font-size:var(--text-xs)] ${
                      on
                        ? "[background-color:var(--color-ink-850)] [color:var(--color-paper)] [font-weight:var(--fw-medium)]"
                        : "[color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-900)] hover:[color:var(--color-paper)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {shelfName(key)}
                    </span>
                    <span className="[font-family:var(--font-numeric)] tabular-nums opacity-55">
                      {BLOCK_CATEGORIES[key].length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="w-40 shrink-0 rounded-[var(--radius-pill)] border px-3 py-1.5 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-xs)] outline-none"
            />
            {shelves.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setQuery("");
                  setActive(key);
                }}
                className={`shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border px-3 py-1.5 [font-size:var(--text-xs)] ${
                  !searching && active === key
                    ? "[background-color:var(--color-paper)] [border-color:var(--color-paper)] [color:var(--color-ink-900)]"
                    : "[background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]"
                }`}
              >
                {shelfName(key)}
                <span className="ml-1.5 [font-family:var(--font-numeric)] tabular-nums opacity-55">
                  {BLOCK_CATEGORIES[key].length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-baseline gap-3">
            <h2 className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
              {searching ? query.trim() : active ? shelfName(active) : t("all")}
            </h2>
            <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)] tabular-nums">
              {shown.length}
            </span>
          </div>
          <p className="mt-1.5 max-w-xl [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
            {t("body")}
          </p>

          {shown.length === 0 && (
            <p className="mt-10 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {t("none", { query })}
            </p>
          )}

          {/* TWO ACROSS AND TALLER THAN 组件库's TILES.
              These are full-width page sections, not parts: a pricing panel
              composed at 1200 and fitted into a 300px frame is a picture of a
              pricing panel, not a specimen of one. Two columns at 1440 gives
              ~560, which fits at about a half — the same ratio 21st.dev's own
              hero thumbnails run at. */}
          {/* THE SECTIONED FRONT DOOR, same as 组件库's — 21st.dev's
              /components opens on rows, not on one shelf. This page opened on
              「hero」, so the entrance to 216 sections was one shelf. */}
          {!searching && active === null ? (
            <div className="mt-6 flex flex-col gap-10">
              {shelves.map((key) => (
                <section key={key}>
                  <div className="mb-3 flex items-baseline gap-3">
                    <h3 className="[color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                      {shelfName(key)}
                    </h3>
                    <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)] tabular-nums">
                      {BLOCK_CATEGORIES[key].length}
                    </span>
                    <span className="flex-1" />
                    {BLOCK_CATEGORIES[key].length > ROW && (
                      <button
                        type="button"
                        onClick={() => setActive(key)}
                        className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)]"
                      >
                        {t("allN", { n: BLOCK_CATEGORIES[key].length })}
                      </button>
                    )}
                  </div>
                  <ul className="grid grid-cols-1 items-start gap-x-4 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
                    {BLOCK_CATEGORIES[key].slice(0, ROW).map((name) => (
                      <SectionTile
                        key={name}
                        name={name}
                        style={style}
                        palette={palette}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="mt-6 grid grid-cols-1 items-start gap-x-4 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((name) => (
                <SectionTile
                  key={name}
                  name={name}
                  style={style}
                  palette={palette}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
