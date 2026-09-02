"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Render } from "@puckeditor/core";
import { puckConfig } from "@/design-system/editor/puck-config";
import { localisedPuckConfig } from "@/design-system/editor/puck-config-client";
import { useSystemLang } from "@/design-system/system-lang-context";
import { sampleProps } from "@/design-system/editor/sample-en";
import { PageBar } from "../page-bar";
import { LIBRARY_SAMPLES } from "./samples";
import chrome from "../../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

import { StyleScope } from "@/design-system/editor/style-scope";
import { Specimen, PAGE_SIZED } from "@/design-system/editor/specimen";

type Entry = { name: string; label: string; category: string; props: Record<string, unknown> };

/**
 * 组件库 — the gallery a customer browses before they build.
 *
 * ── REBUILT 2026-08-23, AFTER SCREENSHOTTING THE REFERENCES ───────────────
 *
 * The founder's words were 「你看看21st的库存是怎么放的啊 不可能全部东西丢在一起
 * 还有丢出来的东西要有美感啊」. So 21st.dev/s/hero and landingfolio.com were
 * opened at 1440 and looked at rather than remembered, and they turn out to
 * run the SAME page. Three things, all of which this gallery was doing the
 * opposite of:
 *
 *   1. A PERSISTENT LEFT RAIL, ONE CATEGORY AT A TIME. 21st's rail reads
 *      Announcements 71, Backgrounds 365, Borders 111, Calls to Action 501,
 *      Heroes 1152 — fourteen visible at once, each with a count, and the grid
 *      shows exactly ONE of them. Landingfolio's is the same rail with three
 *      groupings. Neither site ever puts every category on screen together.
 *      This page did: six headings stacked down one scroll, two of which held
 *      37 of the 56 blocks. That is the pile, and 「全部东西丢在一起」 is an
 *      accurate description of it. The categories are now twelve (puck-config)
 *      and only one is on screen.
 *
 *   2. ONE ASPECT RATIO, EVERY SPECIMEN COMPLETE. Every card on both sites is
 *      the same 4:3 frame with the whole component inside it. This page had a
 *      168px window at a fixed scale(0.65) with overflow hidden, so tall
 *      blocks were sliced mid-button and short ones sat as a speck in an empty
 *      cream rectangle. See design-system/editor/specimen.tsx — that file is
 *      the fix and carries the measurement.
 *
 *   3. THE RAGGED TAIL GOES FOR FREE. Stacked categories meant every section
 *      ended in a half-empty row — 官网 has two blocks, so its row was two
 *      tiles and a hole four columns wide. One category at a time leaves one
 *      ragged row per page instead of twelve.
 *
 * What is NOT copied: their ground. 21st is a light site; Formae is dark by
 * the rule in project_formae_design_decisions — dark is Formae, light is the
 * customer. The card is a white `.mount` plinth for that reason, which is also
 * why the specimens stop reading as slabs scattered on black: they become
 * objects on plinths, evenly sized, in a grid.
 */

/**
 * Shelves that hold nothing but single controls, and so get a SHORTER tile.
 *
 * A 下拉选择 is one 160x40 control. Given the same 248px frame a 记录表格 needs,
 * it is a small object in the middle of a large empty field, six times over —
 * which is what the first rebuild looked like on 选择 and 勾选与开关. The frame
 * has to agree with what is in it.
 *
 * Per SHELF rather than per component, because the grid's job is for a row to
 * line up: mixed tile heights inside one shelf is a worse fault than a
 * slightly loose frame. Every shelf listed here is controls end to end —
 * checked by reading its `components` array in puck-config, not assumed.
 */
const CONTROL_SHELVES = new Set(["pick", "toggles", "actions"]);

/** How many tiles a front-door row shows. Four, because that is what the
 *  grid holds at 1440 and because a row that wraps stops being a row. */
const ROW = 4;

/**
 * One gallery tile.
 *
 * HOISTED OUT OF `LibraryClient` ON PURPOSE. It was declared inside it, which
 * makes a NEW component type on every render: React cannot match the old tree
 * to the new one, so every tile unmounts and remounts on every keystroke in
 * the search box — and each tile mounts a composed-then-scaled specimen with
 * its own ResizeObserver. Same class of bug as the reel that re-rendered
 * seventeen page trees per tick, arrived at from the other direction.
 */
function Tile({
  entry,
  short,
  style,
  palette,
  locale,
  firstPage,
  t,
  onZoom,
}: {
  entry: Entry;
  short: boolean;
  style: StyleName;
  palette: string | null;
  locale: string;
  firstPage: string;
  t: (key: string, values?: Record<string, string>) => string;
  onZoom: (entry: Entry) => void;
}) {
  return (
    <li className="group min-w-0">
      {/* The frame is the zoom control; the NAME underneath is the
          add link. Two actions that never fight — look here, take it
          there. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onZoom(entry)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onZoom(entry);
          }
        }}
        aria-label={t("zoom", { name: entry.label })}
        className={`${chrome.exhibit} block w-full cursor-zoom-in transition-transform duration-200 group-hover:-translate-y-0.5 ${short ? "h-[140px]" : "h-[208px]"}`}
      >
        {PAGE_SIZED.has(entry.name) ? (
          <StyleScope
            register={style}
            palette={palette}
            className="ds-ground grid place-items-center [background-color:var(--color-canvas)]"
          >
            <p className="max-w-[26ch] text-center [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)] [padding:var(--pad-card)]">
              {t(`structural.${entry.name}`)}
            </p>
          </StyleScope>
        ) : (
          <Specimen
            name={entry.name}
            props={entry.props}
            style={style}
            palette={palette}
          />
        )}
      </div>

      {/* Outside the card, on the page ground. Two sizes, two inks,
          no button — 「去用它」 was a control competing with the thing
          it described, on every one of fifty-six cards. The whole
          name is the link now, which is what a customer tries first.
          `?add=` is read server-side in [pageKey]/page.tsx and goes
          through the SAME add_component operation the AI assistant
          uses, so the block lands unsaved, undoable, and behind the
          same paid gate. Without it the library is a brochure. */}
      <div className="mt-2.5">
        {PAGE_SIZED.has(entry.name) ? (
          <>
            <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
              {entry.label}
            </span>
            <span className="block truncate [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
              {entry.name}
            </span>
          </>
        ) : (
          <Link href={`/${locale}/portal/${firstPage}?add=${entry.name}`} className="block">
            <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] group-hover:underline">
              {entry.label}
            </span>
            <span className="block truncate [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
              {entry.name}
            </span>
          </Link>
        )}
      </div>
    </li>
  );
}

export function LibraryClient({
  locale,
  style,
  palette,
  firstPage,
  initialQuery,
}: {
  locale: string;
  style: StyleName;
  /** The customer's 配色 layer, or null for this layout's native colours. */
  palette: string | null;
  /** Where 「去用它」 sends the block. The customer's own first page, not a
   *  hardcoded `dashboard` — a business whose trade has no dashboard route
   *  would have been sent to a 404. */
  firstPage: string;
  /** 「找东西」那个面板带过来的字。见下面 `useState` 上的注解。 */
  initialQuery?: string;
}) {
  const t = useTranslations("portal.library");
  /*
    THE LIBRARY SPEAKS THE INTERFACE'S LANGUAGE.

    「不是這個英文 是我的平台裡面用英文」 -- 2026-08-26. Measured the same day by
    logging into /en/portal and counting the CJK text nodes on every page: this
    one had 203, more than the other seven put together. Every category heading
    (整段成品, 标题与文字, 表格与看板) and every block name under them was Chinese
    on the English portal.

    None of that needed writing. `localisedPuckConfig(locale, systemLang)` has
    projected the whole config -- labels, categories, field names, option
    labels, sample content -- since task 8 landed on 2026-08-25. The editor uses
    it. This page went on importing the raw config, so the projection existed
    and reached nothing. That is the fifth time in this repo that the capability
    was built and the wire was never connected; the previous four are noted in
    founder-tasks.

    TWO LANGUAGES, TWO SOURCES, on purpose. The chrome follows `locale` -- what
    Formae calls things. The sample content inside each specimen follows
    `system_language` -- what the CUSTOMER'S system says on their own page. A
    Chinese-language system previewed inside an English portal is correct and
    must not be flattened.
  */
  const systemLang = useSystemLang();
  const config = useMemo(
    () => localisedPuckConfig(locale, systemLang),
    [locale, systemLang],
  );
  /* 🔴 从网址接住那个字。
     「找东西」那个面板搜到一个组件/版段，落点必须是**已经筛好的这一页** ——
     把人丢在一张 4,705px（版段库 21,417px）的页上，然后叫他自己找，
     就是这个仓库最常犯的那一类：能力有，线只接了一半。
     ⚠️ 从**服务端**穿下来，不用 `useSearchParams` —— 那要一层 Suspense，
     而且在 `useState` 初值里读 `window.location` 会让服务端跟浏览器
     渲染出两个不同的值。 */
  const [query, setQuery] = useState(initialQuery ?? "");
  /*
    WHICH SHELF IS OPEN, AND WHY null IS THE FRONT DOOR NOW.

    It opened on 「官网」, a shelf with two blocks in it, which meant the front
    door of a 69-block library was two tiles and a screen of empty ground. The
    note that used to sit here argued 全部 is the pile and should not be the
    entrance. That was right about 全部 and wrong about the conclusion, because
    21st.dev has a third answer and I had not gone and looked at it.

    Measured on 2026-08-26: their /components does not open on a category and
    does not open on everything. It opens on SECTIONED ROWS -- Newest, Popular,
    Shaders -- each one a horizontal strip of four with a 「View all →」 on the
    right, and their landing page does the same with chips. You see the range
    of the library in one screen, and you enter through whichever row looks
    like your problem.

    So null now means the sectioned front door, and the rail still takes you to
    one shelf at a time. I had recommended against building this. He said
    「我要你完完全全的去抄他们的做法」, and having actually opened the page I think
    he is right: a two-tile front door is the worst possible answer to
    「这个库存里有什么」.
  */
  const [active, setActive] = useState<string | null>(null);
  // Which block is open at full size. A thumbnail answers "which one is the
  // table"; it cannot answer "what will this actually look like on my page",
  // and that second question is the one a customer has before committing.
  const [zoomed, setZoomed] = useState<Entry | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const categories = config.categories ?? {};
    const out: Entry[] = [];
    for (const [key, cat] of Object.entries(categories)) {
      for (const name of (cat as { components?: string[] }).components ?? []) {
        const c = (config.components as Record<string, { label?: string; defaultProps?: Record<string, unknown> }>)[name];
        if (!c) continue;
        out.push({
          name,
          label: c.label ?? name,
          category: key,
          // The library's own sample where one exists, otherwise the same
          // defaults a drag produces. Defaults are tuned to be a sane STARTING
          // POINT for editing (one placeholder row, empty optional fields),
          // which is the right call in the editor and the wrong one in a
          // gallery — a table with a single "示例记录 #1" row does not show
          // what a table is for. See samples.ts.
          // LIBRARY_SAMPLES goes through the same projection as the
          // defaults. It is spread AFTER them, so raw Chinese here silently
          // overwrote content the config had already translated -- which is
          // why 49 Chinese strings survived localising the config: 「怎么称呼」,
          // 「电话 / WhatsApp」, 「填完送出 → 你的系统会开一张报价单」. Content, so
          // it follows systemLang, not the interface locale.
          props: {
            ...(c.defaultProps ?? {}),
            ...(sampleProps(LIBRARY_SAMPLES[name] ?? {}, systemLang) as Record<string, unknown>),
            id: `lib-${name}`,
          },
        });
      }
    }
    return out;
  }, [config, systemLang]);

  const searching = query.trim().length > 0;

  // Search wins over the rail. Typing 「表格」 while 官网 is open and getting
  // two results is a page arguing with the person using it; a search box on a
  // library searches the library.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return entries.filter(
        (e) => e.label.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
      );
    }
    return active ? entries.filter((e) => e.category === active) : entries;
  }, [entries, query, active]);

  /** The front door's rows: every shelf, in the order puck-config declares
   *  them, each cut to what fits one row. */
  const sections = useMemo(() => {
    const cats = Object.keys(config.categories ?? {});
    return cats
      .map((key) => ({ key, items: entries.filter((e) => e.category === key) }))
      .filter((s) => s.items.length > 0);
  }, [entries]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return map;
  }, [entries]);

  const categoryTitle = (key: string) =>
    ((config.categories ?? {}) as Record<string, { title?: string }>)[key]?.title ?? key;


  const heading = searching ? query.trim() : active ? categoryTitle(active) : t("filterAll");
  // 全部 and a search across everything both mix sections with controls, so
  // neither gets the short tile — only a shelf that is controls all the way.
  const short = !searching && active !== null && CONTROL_SHELVES.has(active);

  return (
    <>
      <PageBar title={t("title")} subtitle={t("subtitle", { count: entries.length })} />

      <div className="flex items-start gap-8 px-8 py-7">
        {/* ── THE RAIL ─────────────────────────────────────────────────────
            Sticky, 200px, search at the top of it — the arrangement on both
            reference sites. `top-4` rather than `top-0`: the page bar is not
            sticky, so a rail pinned at 0 would sit against the viewport edge
            the moment the page scrolls past it. */}
        <nav className="sticky top-4 hidden w-[200px] shrink-0 lg:block">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="mb-4 w-full rounded-[var(--radius-md)] border px-3 py-2 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-xs)] outline-none focus-visible:[border-color:var(--color-paper-dim)]"
          />
          <ul className="flex flex-col gap-px">
            <RailItem
              active={!searching && active === null}
              onClick={() => {
                setQuery("");
                setActive(null);
              }}
              label={t("filterAll")}
              n={entries.length}
            />
            {[...counts.entries()].map(([key, n]) => (
              <RailItem
                key={key}
                active={!searching && active === key}
                onClick={() => {
                  setQuery("");
                  setActive(key);
                }}
                label={categoryTitle(key)}
                n={n}
              />
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          {/* On a phone the rail becomes a scrolling row of chips. Same
              control, same one-shelf-at-a-time behaviour; a 200px column
              beside a 190px grid is not a layout. */}
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="w-40 shrink-0 rounded-[var(--radius-pill)] border px-3 py-1.5 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-xs)] outline-none"
            />
            {[...counts.entries()].map(([key, n]) => (
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
                {categoryTitle(key)}
                <span className="ml-1.5 [font-family:var(--font-numeric)] tabular-nums opacity-55">{n}</span>
              </button>
            ))}
          </div>

          <div className="flex items-baseline gap-3">
            <h2 className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
              {heading}
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
              {t("noResults", { query })}
            </p>
          )}

          {/* ── THE GRID ──────────────────────────────────────────────────
              One FIXED HEIGHT for every tile, TWO across at 1440 rather than
              three. Measured: three columns beside the 200px rail gives a
              296px frame, and a block composed at 620 then fitted into 296 is
              a table whose text is 7px. Two gives ~560, which fits at ~0.9 and
              is a specimen you can actually read.

              A height in pixels rather than `aspect-[5/4]`: the aspect utility
              silently produced no rule at all here — probed in the browser,
              `getComputedStyle(tile).aspectRatio` came back "auto" and every
              card collapsed to the 12px its own padding gave it. A number
              cannot fail that way, and the grid only needs the tiles to AGREE,
              not to hold a particular ratio.
              `min-w-0` on the item: a grid track is minmax(auto, 1fr), so
              without it the composed-then-scaled specimen inside reports a
              ~620px minimum and pushes the last column off a phone. Found by
              a hit-test sweep, not by looking. */}
          {/*
            FOUR ACROSS, NOT TWO — 21st.dev, photographed 2026-08-25.

            Their Card category runs four to a row on a 1440px window and every
            tile is the component at the size it will be used. Ours ran two,
            which made each card 440px wide: a Tag rendered at 440px is not a
            bigger picture of a Tag, it is a Tag with three hundred pixels of
            empty card beside it, and six of them filled a screen that should
            have held twenty.

            The founder has said this one more than once and it is written down
            now (founder-points 7e): the library pages copy 21st.dev, and it is
            not up for discussion any more.
          */}
          {/* ── THE FRONT DOOR, SECTIONED ────────────────────────────────
              21st.dev's /components, measured 2026-08-26: rows titled Newest /
              Popular / Shaders, four tiles each, a 「View all →」 on the right of
              every row. No category page, no everything page. See the note on
              `active` for why this replaced a two-tile front door. */}
          {!searching && active === null ? (
            <div className="mt-6 flex flex-col gap-10">
              {sections.map((sec) => (
                <section key={sec.key}>
                  <div className="mb-3 flex items-baseline gap-3">
                    <h3 className="[color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                      {categoryTitle(sec.key)}
                    </h3>
                    <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                      {sec.items.length}
                    </span>
                    <span className="flex-1" />
                    {/* Only where there is something the row is not showing --
                        a 「看全部」 next to a row that already IS all of it is a
                        control that does nothing. */}
                    {sec.items.length > ROW && (
                      <button
                        type="button"
                        onClick={() => setActive(sec.key)}
                        className="-my-2 inline-flex min-h-11 items-center [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)]"
                      >
                        {t("filterAll")} {sec.items.length} →
                      </button>
                    )}
                  </div>
                  <ul className="grid grid-cols-1 items-start gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {sec.items.slice(0, ROW).map((entry) => (
                      <Tile
                        key={entry.name}
                        entry={entry}
                        short={CONTROL_SHELVES.has(sec.key)}
                        style={style}
                        palette={palette}
                        locale={locale}
                        firstPage={firstPage}
                        t={t}
                        onZoom={setZoomed}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="mt-6 grid grid-cols-1 items-start gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((entry) => (
                <Tile
                  key={entry.name}
                  entry={entry}
                  short={short}
                  style={style}
                  palette={palette}
                  locale={locale}
                  firstPage={firstPage}
                  t={t}
                  onZoom={setZoomed}
                />
              ))}
            </ul>
          )}

          <p className="mt-12 max-w-xl [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
            {t("moreComing")}
          </p>
        </div>
      </div>

      {/* Rendered at real size in the customer's own style, on their own
          ground — the same tokens the editor canvas uses, so what is shown here
          is what lands on the page. */}
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
                className="rounded-[var(--radius-md)] px-3 py-1.5 [background-color:var(--color-paper)] [color:var(--color-canvas)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]"
              >
                {t("useIt")}
              </Link>
              <button
                type="button"
                onClick={() => setZoomed(null)}
                aria-label={t("close")}
                className="rounded-[var(--radius-md)] px-3 py-1.5 [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)]"
              >
                ✕
              </button>
            </div>
            <div className={`${chrome.mount} min-h-0 overflow-auto`}>
              <StyleScope
                register={style} palette={palette} className="ds-ground [background-color:var(--color-canvas)]"
              >
                <div className="[padding:var(--pad-card-lg)]">
                  <Render
                    config={config}
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

/** One shelf in the rail.
 *
 *  The count rides on the right and is always dimmer than the label: it is a
 *  qualifier, not the thing being named. Tabular so twelve rows of digits form
 *  a column rather than a ragged edge — the detail that makes 21st's rail read
 *  as an index rather than as a list of links. */
function RailItem({
  active,
  onClick,
  label,
  n,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  n: number;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left transition-colors [font-size:var(--text-xs)] ${
          active
            ? "[background-color:var(--color-ink-850)] [color:var(--color-paper)] [font-weight:var(--fw-medium)]"
            : "[color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-900)] hover:[color:var(--color-paper)]"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="[font-family:var(--font-numeric)] tabular-nums opacity-55">{n}</span>
      </button>
    </li>
  );
}
