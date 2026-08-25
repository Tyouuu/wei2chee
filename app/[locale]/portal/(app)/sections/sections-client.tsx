"use client";

import { useMemo, useState } from "react";
import { BLOCK_CATEGORIES, BLOCK_META } from "@/components/blocks";
import { PageBar } from "../page-bar";
import chrome from "../../chrome.module.css";
import { Specimen } from "@/design-system/editor/specimen";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { SECTION_SHELVES, orderShelves } from "./shelves";

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

export function SectionsClient({
  style,
  palette,
}: {
  style: StyleName;
  palette: string | null;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>("hero");

  const shelves = useMemo(() => orderShelves(Object.keys(BLOCK_CATEGORIES)), []);
  const total = useMemo(
    () => Object.values(BLOCK_CATEGORIES).reduce((n, list) => n + list.length, 0),
    [],
  );

  const searching = query.trim().length > 0;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return Object.entries(BLOCK_META)
        .filter(
          ([name, m]) =>
            name.toLowerCase().includes(q) ||
            m.title.toLowerCase().includes(q) ||
            (SECTION_SHELVES[m.cats.split("/")[0]] ?? "").includes(q),
        )
        .map(([name]) => name);
    }
    return BLOCK_CATEGORIES[active] ?? [];
  }, [query, active]);

  const shelfName = (k: string) => SECTION_SHELVES[k] ?? k;

  return (
    <>
      <PageBar title="版段库" subtitle={`${total} 段 · 可以直接放进官网`} />

      <div className="flex items-start gap-8 px-8 py-7">
        <nav className="sticky top-4 hidden w-[190px] shrink-0 lg:block">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索版段…"
            aria-label="搜索版段"
            className="mb-4 w-full rounded-[var(--radius-md)] border px-3 py-2 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-xs)] outline-none focus-visible:[border-color:var(--color-paper-dim)]"
          />
          <ul className="flex flex-col gap-px">
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
                    <span className="min-w-0 flex-1 truncate">{shelfName(key)}</span>
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
              placeholder="搜索版段…"
              aria-label="搜索版段"
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
              {searching ? query.trim() : shelfName(active)}
            </h2>
            <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)] tabular-nums">
              {shown.length}
            </span>
          </div>
          <p className="mt-1.5 max-w-xl [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
            整段套用，里面的字是版段自己的；穿的是你选的风格。在编辑器里用「官网版段」放进页面。
          </p>

          {shown.length === 0 && (
            <p className="mt-10 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              没有找到「{query}」。
            </p>
          )}

          {/* TWO ACROSS AND TALLER THAN 组件库's TILES.
              These are full-width page sections, not parts: a pricing panel
              composed at 1200 and fitted into a 300px frame is a picture of a
              pricing panel, not a specimen of one. Two columns at 1440 gives
              ~560, which fits at about a half — the same ratio 21st.dev's own
              hero thumbnails run at. */}
          <ul className="mt-6 grid grid-cols-1 items-start gap-x-4 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((name) => (
              <li key={name} className="group min-w-0">
                <div
                  className={`${chrome.mount} block h-[300px] w-full transition-transform duration-200 group-hover:-translate-y-0.5`}
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
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
