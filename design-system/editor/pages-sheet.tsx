"use client";

import { useState } from "react";
import { Sheet } from "@/design-system/editor/sheet";
import { useEditorUi } from "@/design-system/editor/editor-ui";

/**
 * 页面 — rename them, and put them in your own order.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * Durable's per-block Content tab lists the navigation as a drag-list with an
 * Edit on every row, and the founder marked it 拿 on 2026-08-25 with the reason
 * attached: 「老板第一个想改的就是这个 —— 他不叫 Quotations，他叫『报价单』」.
 *
 * The rename half was almost true already. `project_pages.title` has existed
 * since 20260820200000 and `pageLabel()` has always preferred it over the
 * trade's own noun — there was simply no control anywhere that set it, so a
 * column that decides what every page in the system is called was writable by
 * nobody. The reorder half was not possible at all: the order came from a fixed
 * rank in industry-template.ts.
 *
 * ── WHY NOT INSIDE THE RAIL BLOCK, WHICH IS WHERE DURABLE PUTS IT ────────
 *
 * Their navigation is a block on a page and its links are that block's props.
 * Ours is generated from `project_pages` — the rail is a VIEW of the system's
 * real page list, and the same list draws the portal's own sidebar, the page
 * cards on the home screen and the specification. Editing it inside one block
 * would either change one rail on one page (a lie, since the rail is the same
 * everywhere) or reach out of a block into the account's data, which is the
 * kind of hidden write nobody finds again. So it is a sheet on the editor,
 * beside 风格: both are decisions about the whole system rather than about the
 * block under the cursor.
 *
 * ── WHY HTML DRAG AND DROP AND NOT A LIBRARY ─────────────────────────────
 *
 * Six rows. dnd-kit is 40KB to move six rows, and the editor already carries
 * Puck's own drag layer — a second one is a second set of gestures for the
 * customer to tell apart. The arrows beside each row are not a fallback for
 * the drag; they are the control on a phone, where dragging a list row fights
 * the page's own scroll.
 */

export type EditablePage = {
  key: string;
  /** What it is called right now — the customer's title, or the trade's noun. */
  label: string;
  /** The customer's own title, or null when they have never named it. Kept
   *  apart from `label` so the field can show the real word as a PLACEHOLDER
   *  and an empty box can mean "go back to the default". */
  title: string | null;
};

/** Opens the sheet. Its own component because the top bar is assembled
 *  OUTSIDE EditorUiProvider — the same reason StyleButton exists. */
export function PagesButton({ label, className }: { label: string; className?: string }) {
  const { openSheet } = useEditorUi();
  return (
    <button type="button" onClick={() => openSheet({ kind: "pages" })} className={className}>
      {label}
    </button>
  );
}

export function PagesSheet({
  pages,
  onRename,
  onReorder,
  busy,
  labels,
}: {
  pages: EditablePage[];
  onRename: (key: string, title: string) => void;
  onReorder: (keys: string[]) => void;
  busy: boolean;
  labels: { title: string; note: string; rename: string; up: string; down: string };
}) {
  const { sheet, closeSheet } = useEditorUi();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);

  const move = (key: string, by: number) => {
    const i = pages.findIndex((p) => p.key === key);
    const j = i + by;
    if (i < 0 || j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next.map((p) => p.key));
  };

  const dropOn = (key: string) => {
    if (!dragKey || dragKey === key) return;
    const from = pages.findIndex((p) => p.key === dragKey);
    const to = pages.findIndex((p) => p.key === key);
    if (from < 0 || to < 0) return;
    const next = [...pages];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next.map((p) => p.key));
    setDragKey(null);
  };

  const commit = (key: string) => {
    setEditing(null);
    onRename(key, draft.trim());
  };

  return (
    <Sheet open={sheet?.kind === "pages"} onClose={closeSheet} title={labels.title}>
      <div className="px-3 py-3">
        <p className="mb-3 [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
          {labels.note}
        </p>

        <ul className="flex flex-col gap-1">
          {pages.map((page, i) => (
            <li
              key={page.key}
              draggable={!editing}
              onDragStart={() => setDragKey(page.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(page.key)}
              onDragEnd={() => setDragKey(null)}
              className={`flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors ${
                dragKey === page.key
                  ? "opacity-40"
                  : "[background-color:var(--color-ink-850)] hover:[background-color:var(--color-ink-800)]"
              }`}
            >
              {/* The grip is the affordance. Without it a draggable row looks
                  exactly like a row that is not draggable, which is how a
                  feature ships and is never found. */}
              <span
                aria-hidden
                className="shrink-0 cursor-grab select-none [color:var(--color-paper-dim)] [font-size:var(--text-sm)] leading-none"
              >
                ⠿
              </span>

              {editing === page.key ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commit(page.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(page.key);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  maxLength={24}
                  // The current word as a placeholder, so clearing the box and
                  // pressing enter visibly means "use that one again".
                  placeholder={page.label}
                  className="min-w-0 flex-1 rounded-[var(--radius-sm)] px-2 py-1 [background-color:var(--color-ink-900)] [color:var(--color-paper)] [font-size:var(--text-sm)] outline-none [border:var(--hairline)_solid_var(--color-primary)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(page.key);
                    setDraft(page.title ?? "");
                  }}
                  className="min-w-0 flex-1 truncate text-left [color:var(--color-paper)] [font-size:var(--text-sm)]"
                  title={labels.rename}
                >
                  {page.label}
                </button>
              )}

              <span className="flex shrink-0 items-center gap-0.5">
                <MoveButton
                  label={labels.up}
                  disabled={busy || i === 0}
                  onClick={() => move(page.key, -1)}
                  d="M8 4.5 4.5 8m3.5-3.5L11.5 8M8 4.5v7"
                />
                <MoveButton
                  label={labels.down}
                  disabled={busy || i === pages.length - 1}
                  onClick={() => move(page.key, 1)}
                  d="M8 11.5 4.5 8m3.5 3.5L11.5 8M8 11.5v-7"
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  d,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  d: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] [color:var(--color-paper-dim)] transition-colors hover:[background-color:var(--color-ink-900)] hover:[color:var(--color-paper)] disabled:opacity-30"
    >
      <span className="sr-only">{label}</span>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
