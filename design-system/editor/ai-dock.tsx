"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePuck } from "@puckeditor/core";
import { usePreviewMode } from "@/design-system/editor/preview-toggle";
import { useEditorUi } from "@/design-system/editor/editor-ui";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("portal.editor");
  const { previewing } = usePreviewMode();
  const { selectedItem } = usePuck();
  const { gutter, sheet, dockOpen: manual, setDockOpen: setManual } = useEditorUi();
  const blockId =
    typeof selectedItem?.props?.id === "string" ? selectedItem.props.id : null;
  // AND IT CLOSES WHILE A PANEL IS OPEN. The selection rule above is right for
  // a resting editor and wrong the moment the customer opens 加一段 or 换款式:
  // the block is still selected, so the dock stayed expanded and the screen had
  // the palette on the right, the block's toolbar over the table, and a 340px
  // assistant card across the middle. 「整体很乱」 was the founder's word for
  // that screenshot, and it was three panels rather than any one of them.
  //
  // A sheet means the customer is doing something else. The dock goes back to
  // its slim line -- still there, still one press away -- and comes back on its
  // own when the sheet closes.
  const open = sheet ? false : (manual ?? Boolean(blockId));

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
      // Formae's own control, inside the customer's canvas -- see draft-notice
      // for why that needs saying out loud, and PAPER in app/globals.css.
      data-chrome="formae"
      /*
        z-50, ABOVE THE CUSTOMER'S PAGE AND EVERYTHING ON IT.

        It was z-40, the same layer a page block can reach. On 2026-08-26 the
        customer's own floating WhatsApp button arrived at z-40 bottom-right --
        the corner every product in this market puts one in, and the corner this
        dock sits in -- and the two drew on top of each other.

        Ours moves, not theirs. This is Formae's control inside somebody else's
        page: their button belongs where their visitors expect it, and a piece
        of our chrome that a page can cover is a piece of chrome the owner
        cannot reach to undo whatever covered it.
      */
      className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-end pb-4 pl-4"
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
            {t("aiDockTitle")}
          </span>
          <span className="ml-auto whitespace-nowrap pl-2 [font-size:var(--text-xs)]">
            {open ? t("collapse") : t("expand")}
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
