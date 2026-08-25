"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet } from "@/design-system/editor/sheet";
import { useEditorUi } from "@/design-system/editor/editor-ui";
import type { Data } from "@puckeditor/core";
import { PagePreview } from "@/app/[locale]/portal/page-preview";
import { scopeClasses } from "@/lib/portal/palettes";
import { CornerSlider } from "@/design-system/editor/corners";
import { StyleScope } from "@/design-system/editor/style-scope";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * The 风格 press in the top bar.
 *
 * Its own component rather than a node built in editor-client, because
 * `useEditorUi` has to be called from INSIDE the provider and editor-client is
 * the component that renders it — a hook there would read the fallback shape
 * and the button would do nothing.
 */
export function StyleButton({ label }: { label: string }) {
  const { openSheet, sheet } = useEditorUi();
  const on = sheet?.kind === "style";
  return (
    <button
      type="button"
      onClick={(e) => openSheet({ kind: "style" }, e.currentTarget)}
      aria-expanded={on}
      className={`rounded-md px-2.5 py-1.5 [font-size:var(--text-xs)] transition-colors ${
        on
          ? "[background-color:var(--color-ink-850)] [color:var(--color-paper)]"
          : "[color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * 风格, without leaving the page it changes.
 *
 * It was two presses and a navigation — 更多 → 风格 — which took the customer
 * off their own system to a page of samples, made them choose from memory, and
 * sent them back. Durable's Themes sits in the top bar and swaps the site under
 * you while you look at it, which is the whole reason a customer trusts the
 * choice: they are not comparing two screenshots in their head.
 *
 * Nothing here re-fetches or re-navigates. editor-client holds `activeStyle` in
 * state and passes it to the class that scopes the canvas, so pressing a tile
 * repaints the customer's real page — their own words, their own tables — in
 * the new register on the same frame. The database call goes out behind that
 * and only ever un-does the choice if it fails.
 *
 * PALETTES ARE NOT HERE. Layout and colour are two axes and the second one has
 * eleven values; a sheet with 88 combinations in it is the style page again,
 * only smaller. The link at the foot goes to the page that does that job
 * properly.
 */
export function StyleSheet({
  active,
  palette,
  pending,
  failed,
  onPick,
  onShuffle,
  shuffling,
  corners,
  onCorners,
  layout,
  onLayout,
  pages_,
  locale,
  styles,
  labels,
}: {
  active: StyleName;
  palette: string | null;
  pending: StyleName | null;
  failed: boolean;
  onPick: (next: StyleName) => void;
  /** Press once, get a different register AND a different palette. */
  onShuffle: () => void;
  shuffling: boolean;
  /** The register's radius ladder, scaled. 1 is the register as designed. */
  corners: number;
  onCorners: (next: number) => void;
  /** 排法 — a named arrangement, or null to follow the register. */
  layout: string | null;
  onLayout: (next: string | null) => void;
  /** Up to four of the customer's own pages. Every tile plays through them. */
  pages_: { key: string; label: string; data: Data }[];
  locale: string;
  /** [name, one-line tag] in the order they are offered. */
  styles: { name: StyleName; tag: string }[];
  labels: {
    title: string;
    current: string;
    failed: string;
    more: string;
    shuffle: string;
    shuffleNote: string;
    corners: string;
    layout: string;
    layoutOptions: { key: string | null; label: string }[];
  };
}) {
  const { sheet, closeSheet } = useEditorUi();

  return (
    <Sheet
      open={sheet?.kind === "style"}
      onClose={closeSheet}
      title={labels.title}
    >
      <div className="px-3 py-3">
        {/*
          重掷 — Durable's Shuffle, and the founder marked it 拿 on 2026-08-25.

          WHY IT IS WORTH A BUTTON. Seventeen registers times twenty-six
          palettes is four hundred and forty-two combinations, and an owner who
          cannot say what he wants — which is most of them, and is the whole
          reason this product exists — will scroll a list of seventeen, pick the
          third, and never see the other four hundred. One press that lands
          somewhere he did not choose is how a person discovers a preference
          they could not have described. It costs nothing here: both axes
          already persist, so this is two random draws and the RPC that was
          already being called.

          It never repeats what is on screen. A shuffle that gives you the same
          page back reads as a broken button rather than as a coincidence.
        */}
        <button
          type="button"
          onClick={onShuffle}
          disabled={shuffling}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 [background-color:var(--color-ink-850)] [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] transition-colors hover:[background-color:var(--color-ink-800)] disabled:opacity-50"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M2 4h2.2c1 0 1.9.5 2.4 1.3l2.8 4.4c.5.8 1.4 1.3 2.4 1.3H14M2 12h2.2c1 0 1.9-.5 2.4-1.3l.6-1M14 4h-1.6c-1 0-1.9.5-2.4 1.3l-.3.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path
              d="M12.4 2.4 14 4l-1.6 1.6M12.4 9.4 14 11l-1.6 1.6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {labels.shuffle}
          <span className="[color:var(--color-paper-dim)] [font-weight:var(--fw-regular)]">
            · {labels.shuffleNote}
          </span>
        </button>

        {/*
          排法 — Durable's 「Try a different layout set」, and the half of
          DASHBOARD_COMPOSITION that was missing. The compositions have existed
          since the morning of 2026-08-25 and were welded to the register, so
          the only way to read 台账's table-first page was to become 台账 and give
          up your own colours, type and density.

          FIVE, NAMED BY WHAT THEY ARE. There is one composition per register
          but they are not seventeen ideas -- they are five, each held by three
          or four registers. 「表格先行」 is a sentence about an owner's own day;
          「用台账的排法」 is a question about a register he may never have opened.
        */}
        <div className="mb-3 rounded-[var(--radius-md)] px-3 py-2.5 [background-color:var(--color-ink-850)]">
          <div className="mb-2 [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
            {labels.layout}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {labels.layoutOptions.map((opt) => {
              const on = (layout ?? null) === opt.key;
              return (
                <button
                  key={opt.key ?? "follow"}
                  type="button"
                  onClick={() => onLayout(opt.key)}
                  aria-pressed={on}
                  className={`rounded-[var(--radius-pill)] px-3 py-1 [font-size:var(--text-xs)] transition-colors ${
                    on
                      ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
                      : "[background-color:var(--color-ink-900)] [color:var(--color-paper-dim)] hover:[color:var(--color-paper)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <CornerSlider value={corners} onChange={onCorners} label={labels.corners} />

        {failed ? (
          <p
            role="status"
            className="mb-2 rounded-[var(--radius-md)] px-2.5 py-2 [background-color:var(--color-ink-850)] [color:var(--color-clay-bright)] [font-size:var(--text-xs)]"
          >
            {labels.failed}
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {styles.map(({ name, tag }) => {
            const current = name === active;
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => onPick(name)}
                  aria-current={current}
                  className={`block w-full overflow-hidden rounded-[var(--radius-md)] text-left transition-colors ${
                    current
                      ? "[border:2px_solid_var(--color-primary)]"
                      : "[border:1px_solid_var(--color-ink-800)] hover:[border-color:var(--color-paper-dim)]"
                  }`}
                >
                  {/*
                    THE CUSTOMER'S OWN PAGE, IN THAT REGISTER.

                    It was a hand-built quotation table -- three rows of
                    「Taman Desa 三房翻新 · RM 48,500」 -- and the founder's
                    reaction on seeing it was the right one: 「为什么要做报价单
                    到底是谁教你做报价单的 不能是从dashboard第一页开始」. A person
                    choosing a register is deciding what their WHOLE SYSTEM will
                    look like, and the tile was showing them one artefact from
                    one page, drawn by hand, that no longer even matched what
                    the register would produce -- the compositions landed on
                    2026-08-25 and this sample never knew about them.

                    `PagePreview` has done this correctly for the home screen's
                    page cards since it was written: compose at desktop width,
                    scale down, render live through the register-aware config.
                    Its own docblock says the tile IS the product. It just was
                    not being used here.
                  */}
                  <StyleScope register={name} palette={palette} className="block">
                    <PageReel pages={pages_} />
                  </StyleScope>
                </button>
                <span className="mt-1.5 flex items-baseline gap-2">
                  <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                    {name[0].toUpperCase() + name.slice(1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                    {tag}
                  </span>
                  {current ? (
                    <span className="shrink-0 [color:var(--color-primary)] [font-size:var(--text-xs)]">
                      {labels.current}
                    </span>
                  ) : null}
                  {pending === name ? (
                    <span className="shrink-0 [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                      …
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        <Link
          href={`/${locale}/portal/styles`}
          className="mt-4 block rounded-[var(--radius-md)] px-2.5 py-2 text-center [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          {labels.more}
        </Link>
      </div>
    </Sheet>
  );
}

/**
 * The tile, playing.
 *
 * 「做成可以preview 好像一个video 这样的 客户就可以看到dashboard页面啊 其他的页面啊
 * 然后客户就会去选」 — 2026-08-25.
 *
 * A register is a decision about a SYSTEM. A tile showing one page can only
 * answer 「这一页长什么样」, and the customer is being asked something bigger. So
 * the tile cycles: their overview, their clients, their payments, their
 * quotations, each for two and a half seconds, in that register.
 *
 * ── WHY IT SAYS WHICH PAGE ───────────────────────────────────────────────
 *
 * A miniature that changes every 2.5 seconds with no label is a tile that
 * flickers. The page's own name in the corner turns the same motion into
 * information: you are watching a system, and this is the payments page of it.
 *
 * ── WHY ONE TIMER FOR THE WHOLE SHEET ────────────────────────────────────
 *
 * Seventeen tiles each with their own interval would drift apart within a
 * minute and the sheet would look like seventeen slot machines. One index,
 * held by the sheet, means every tile turns the page at the same moment and
 * the column reads as one comparison — which is what a register picker is for:
 * the SAME page, in seventeen designs, side by side.
 *
 * ── WHY IT STOPS WHEN THE TAB IS HIDDEN ──────────────────────────────────
 *
 * Each turn re-renders seventeen scaled page trees. Doing that to a tab
 * nobody is looking at is a laptop fan and nothing else.
 */
function PageReel({ pages }: { pages: { key: string; label: string; data: Data }[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (pages.length < 2) return;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      setI((n: number) => (n + 1) % pages.length);
    };
    const id = setInterval(tick, 2500);
    return () => clearInterval(id);
  }, [pages.length]);

  const page = pages[Math.min(i, pages.length - 1)];
  if (!page) return null;

  return (
    <span className="relative block">
      <PagePreview key={page.key} data={page.data} />
      {pages.length > 1 ? (
        <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded-[var(--radius-pill)] px-2 py-0.5 [background-color:oklch(0.16_0.012_265/0.72)] [color:#fff] [font-size:10px]">
          {page.label}
        </span>
      ) : null}
    </span>
  );
}
