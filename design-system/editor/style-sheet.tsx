"use client";

import Link from "next/link";
import { Sheet } from "@/design-system/editor/sheet";
import { useEditorUi } from "@/design-system/editor/editor-ui";
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
                  <StyleScope register={name} palette={palette} className="block">
                    <StyleSample />
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
 * The smallest thing that shows what a LAYOUT decides.
 *
 * Not a palette swatch — these eight differ in density, type, rules and radius,
 * and four coloured dots would make them look identical, which is exactly the
 * complaint that started the retint (「看起来真的没什么区别」). So it is a table
 * with a heading, a header row and three rows: the one artefact every one of
 * these businesses recognises, and the one place where 紧凑 and 大字 and 合约
 * cannot possibly look the same.
 *
 * Every value here is a token, so the fragment re-resolves entirely inside
 * whichever `scopeClasses` wraps it.
 */
function StyleSample() {
  const rows = [
    ["Taman Desa 三房翻新", "RM 48,500"],
    ["Bukit Jalil 厨房改造", "RM 22,800"],
    ["Cheras 店面装修", "RM 96,000"],
  ];
  return (
    <span className="block w-full [background-color:var(--color-canvas)] [padding:var(--pad-card)]">
      <span className="mb-2 block [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
        报价单
      </span>
      <span className="block overflow-hidden [background-color:var(--color-ink-900)] [border-radius:var(--radius-md)] [border:var(--hairline)_solid_var(--color-ink-800)]">
        <span className="flex items-center justify-between [background-color:var(--color-table-head-bg)] px-2.5 py-1.5">
          <span className="[color:var(--color-table-head-fg)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
            报价内容
          </span>
          <span className="[color:var(--color-table-head-fg)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
            金额
          </span>
        </span>
        {rows.map(([what, amount]) => (
          <span
            key={what}
            className="flex items-center justify-between gap-2 border-t px-2.5 py-1.5 [border-color:var(--color-ink-800)]"
          >
            <span className="min-w-0 truncate [color:var(--color-paper)] [font-size:var(--text-xs)]">
              {what}
            </span>
            <span className="shrink-0 [color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
              {amount}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
