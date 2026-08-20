"use client";

import { usePuck, type Data } from "@puckeditor/core";
import { useTranslations } from "next-intl";

/**
 * Replaces Puck's built-in header.
 *
 * Puck ships its own toolbar -- "Page", undo/redo, and a "Publish" button --
 * all in English, all unstyled by this app's tokens. In a product sold to
 * Malaysian-Chinese SME owners, whose every other word on screen is Chinese,
 * that toolbar was the loudest remaining seam: the one control a customer must
 * press to keep their work was labelled in a language the rest of the product
 * had stopped using, and it said "Publish", which is a web-publishing word for
 * an action that actually means "save my design".
 *
 * Rendered through `overrides.header`, so it sits inside Puck's own context and
 * can drive the real editor state (`usePuck`) rather than faking it: undo and
 * redo are Puck's own history, and the save button hands over Puck's live data
 * exactly as its Publish button did.
 */
export function EditorChrome({
  pageLabel,
  saving,
  onSave,
}: {
  /** Which of the five pages is open, already localised by the caller. */
  pageLabel: string;
  saving: boolean;
  onSave: (data: Data) => void;
}) {
  const t = useTranslations("portal.editor");
  const { appState, history } = usePuck();

  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-md text-[15px] transition-colors disabled:opacity-30 [color:var(--color-paper-dim)] enabled:hover:[background-color:var(--color-ink-850)] enabled:hover:[color:var(--color-paper)]";

  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-2 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
      <span className="truncate text-[13px] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
        {pageLabel}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={history.back}
          disabled={!history.hasPast}
          aria-label={t("undo")}
          title={t("undo")}
          className={iconButton}
        >
          ↺
        </button>
        <button
          type="button"
          onClick={history.forward}
          disabled={!history.hasFuture}
          aria-label={t("redo")}
          title={t("redo")}
          className={iconButton}
        >
          ↻
        </button>

        <button
          type="button"
          onClick={() => onSave(appState.data)}
          disabled={saving}
          className="rounded-md px-3.5 py-1.5 text-[13px] transition-colors disabled:opacity-60 [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]"
        >
          {saving ? t("saving") : t("saveCta")}
        </button>
      </div>
    </div>
  );
}
