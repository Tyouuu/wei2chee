"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePuck } from "@puckeditor/core";
import { usePreviewMode } from "@/design-system/editor/preview-toggle";
import { useEditorUi } from "@/design-system/editor/editor-ui";

/**
 * The assistant, floating at the foot of the canvas instead of squeezed into
 * the bottom 40% of a properties column.
 *
 * This is Durable's bottom bar from the founder's first screenshot — a card
 * over the page with a prompt in it and a row of one-press examples.
 *
 * IT DEFAULTS TO OPEN, AND THAT IS THE WHOLE POINT. The last time this feature
 * was put behind a press the founder's response was 「把这个AI修改放在这里谁会去
 * 按啦」 — the product's central claim was a button most customers would never
 * find. So the composer is visible and typeable at rest; the minimise control
 * exists for the customer who wants to see the bottom of a long page, and it
 * remembers nothing, so the next page opens with the assistant showing again.
 *
 * WHY A CAP RATHER THAN A COLUMN. A conversation grows; a floating panel that
 * grows with it eventually covers the page it is editing. 46vh keeps the answer
 * and the last question visible while leaving the top half of the customer's
 * system in view — you can watch the page change while you read what changed.
 *
 * WHY THE SELECTION DECIDES WHETHER IT IS OPEN.
 *
 * "Defaults to open" was the right correction and the wrong constant. Put the
 * two products side by side at rest and Durable's bottom-right corner is empty
 * while this one had a 520×340 card sitting on the 金额 and 状态 columns of the
 * customer's own table — the founder's words for the first version were 「谁会
 * 去按啦」, and for this one, looking at the screenshots, 「我们那个 AI 框一直
 * 开着」. Both are true, and a fixed default cannot answer both.
 *
 * Durable's actual rule is neither: its re-write bar appears when you are
 * editing something and is not there when you are not. So the selection
 * decides. Nothing selected and it is one slim line — still visible, still one
 * press away, covering nothing. Select a block and it opens with that block's
 * verbs already in it, which is the moment it has something to say.
 *
 * The manual toggle still wins for the current selection, and resets when the
 * selection changes, so "I want to see the table under it" works without
 * turning into a preference the customer has to unset later.
 */
export function AiDock({ children }: { children: ReactNode }) {
  const [manual, setManual] = useState<boolean | null>(null);
  const { previewing } = usePreviewMode();
  const { selectedItem } = usePuck();
  const { gutter } = useEditorUi();
  const blockId =
    typeof selectedItem?.props?.id === "string" ? selectedItem.props.id : null;
  const open = manual ?? Boolean(blockId);

  // A different block is a different question -- drop the override so the new
  // selection gets the same treatment the last one did before it was toggled.
  useEffect(() => {
    setManual(null);
  }, [blockId]);

  // Preview means nothing of Formae's on the screen -- a floating assistant
  // over a page the customer is trying to judge defeats the point of the mode.
  // Returning null here loses the draft in the composer, which is the right
  // trade: preview is a deliberate detour, and the transcript itself lives in
  // editor-client's state and survives.
  if (previewing) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-end pb-4 pl-4"
      // The canvas scrolls under this. Only the card itself takes pointer
      // events, so the page behind stays clickable everywhere the card is not.
      // The right padding tracks the sheet gutter: with a panel docked on the
      // right, an assistant still pinned to the window's edge would sit on top
      // of it.
      style={{ paddingRight: `calc(1rem + ${gutter}px)` }}
    >
      <div
        className="pointer-events-auto flex flex-col overflow-hidden rounded-[var(--radius-lg)] border [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
        style={{
          // Collapsed it is exactly as wide as its own one line, so the corner
          // of the customer's page it stands on is as small as it can be.
          width: open ? "100%" : "auto",
          maxWidth: 520,
          maxHeight: open ? "min(340px, 40vh)" : undefined,
          boxShadow: "var(--shadow-overlay, 0 16px 40px rgba(6,14,26,.42))",
        }}
      >
        <button
          type="button"
          onClick={() => setManual(!open)}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-2 px-3.5 py-2 text-left [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)]"
        >
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-full [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-size:9px] [font-weight:var(--fw-semibold)]"
          >
            AI
          </span>
          <span className="whitespace-nowrap [color:var(--color-paper)] [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)]">
            用讲的改
          </span>
          <span className="ml-auto whitespace-nowrap pl-2 [font-size:var(--text-xs)]">
            {open ? "收起" : "打开"}
          </span>
        </button>
        {/* Kept mounted when collapsed: the transcript of what the assistant
            already changed is not something to throw away because the panel was
            in the way of a table for a moment. */}
        <div
          className="min-h-0 flex-1 flex-col"
          style={{ display: open ? "flex" : "none" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
