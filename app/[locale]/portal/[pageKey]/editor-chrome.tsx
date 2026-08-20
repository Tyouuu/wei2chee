"use client";

import { useEffect } from "react";
import { usePuck, type Data } from "@puckeditor/core";
import { useTranslations } from "next-intl";

/**
 * Replaces Puck's built-in header.
 *
 * Puck ships its own toolbar — "Page", undo/redo, "Publish" — in English and
 * unstyled by this app's tokens. In a product sold to Malaysian-Chinese SME
 * owners it was the loudest remaining seam: the one control a customer must
 * press to keep their work was labelled in a language the rest of the product
 * had stopped using, and it said "Publish", a web-publishing word for an action
 * that means "save my design".
 *
 * Rendered through `overrides.header`, so it sits inside Puck's own context and
 * drives real editor state through `usePuck` rather than shadowing it: undo and
 * redo are Puck's own history, and the save button hands over Puck's live data
 * exactly as its Publish button did.
 *
 * The conversational editing that used to live here as a single text field is
 * now a panel of its own — see ai-assistant.tsx for why a one-shot box was the
 * feature stated rather than built. What remains here is the button that opens
 * it, and the save state.
 */
export function EditorChrome({
  saving,
  onSave,
  dirty,
  savedAt,
  assistantOpen,
  onToggleAssistant,
}: {
  saving: boolean;
  onSave: (data: Data) => void;
  /** Edited since the last successful save. Drives the indicator, and the
   *  beforeunload guard in editor-client. */
  dirty: boolean;
  savedAt: number | null;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
}) {
  const t = useTranslations("portal.editor");
  const { appState, history, dispatch } = usePuck();

  // The fields panel follows the selection instead of standing open.
  //
  // Measured, not assumed: at 1440px the panel is a permanent 290px column,
  // and with nothing selected it holds a single heading ("整个页面") and no
  // controls -- 20% of the window showing nothing. What it cost was on the
  // other side of the screen: the canvas got 792px, the generated system's
  // rail takes 220 of it, and RecordTable's own `min-w-[520px]` then overflows
  // the remainder by 21px. So every table on every page had its 状态 column
  // sliced down the middle. That reads as a broken product, and it was being
  // caused by an empty panel.
  //
  // The assistant occupies the same column, so opening it also closes the
  // fields panel: two panels competing for one column is how an editor starts
  // feeling arbitrary.
  const hasSelection = appState.ui.itemSelector != null;
  useEffect(() => {
    dispatch({ type: "setUi", ui: { rightSideBarVisible: hasSelection && !assistantOpen } });
  }, [hasSelection, assistantOpen, dispatch]);

  // Ctrl/Cmd+S. Every tool a customer already uses binds it, and a product
  // that ignores it teaches people their reflex does not work here — which is
  // worse than not binding it, because the browser's own "save page" dialog
  // opens instead.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) onSave(appState.data as Data);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appState.data, onSave, saving]);

  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-md text-[15px] transition-colors disabled:opacity-30 [color:var(--color-paper-dim)] enabled:hover:[background-color:var(--color-ink-850)] enabled:hover:[color:var(--color-paper)]";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
      <button
        type="button"
        onClick={onToggleAssistant}
        aria-pressed={assistantOpen}
        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
          assistantOpen
            ? "[background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]"
            : "border [border-color:var(--color-ink-800)] [color:var(--color-paper)] hover:[background-color:var(--color-ink-850)]"
        }`}
      >
        <span
          aria-hidden="true"
          className="grid h-4.5 w-4.5 place-items-center rounded-full px-1 text-[9.5px] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
        >
          AI
        </span>
        {t("aiOpen")}
      </button>

      <span className="flex-1" />

      {/* Save STATE, not just a save button. A product that only ever shows a
          button leaves the customer with no answer to "did that work" other
          than pressing it again. */}
      <span
        role="status"
        className={`text-[12px] ${dirty ? "[color:var(--color-brass-bright)]" : "[color:var(--color-paper-dim)]"}`}
      >
        {saving ? t("saving") : dirty ? t("unsaved") : savedAt ? t("savedJustNow") : ""}
      </span>

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
        onClick={() => onSave(appState.data as Data)}
        disabled={saving}
        title={t("saveShortcut")}
        className="rounded-md px-3.5 py-1.5 text-[13px] transition-colors disabled:opacity-60 [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]"
      >
        {saving ? t("saving") : t("saveCta")}
      </button>
    </div>
  );
}
