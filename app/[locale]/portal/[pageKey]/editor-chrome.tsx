"use client";

import { useEffect } from "react";
import { usePuck, type Data } from "@puckeditor/core";
import { useTranslations } from "next-intl";
import { VersionHistoryDialog } from "./version-history";
import { formatTime } from "@/lib/format-date";

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
  autosaving,
  onSave,
  dirty,
  savedAt,
  historyOpen,
  onOpenHistory,
  onCloseHistory,
  paid,
  pageKey,
  locale,
}: {
  saving: boolean;
  /** A save the customer did not ask for, running in the background. Reported
   *  differently from an explicit one: an owner who sees 「保存中…」 they did not
   *  start assumes they pressed something. */
  autosaving: boolean;
  onSave: (data: Data) => void;
  /** Edited since the last successful save. Drives the indicator, and the
   *  beforeunload guard in editor-client. */
  dirty: boolean;
  savedAt: number | null;
  /** Owned by editor-client, not held here. Puck re-creates the `header`
   *  override's render function on every editor render -- and restoring a
   *  version IS an editor render -- so state kept in this component would be
   *  wiped by its own result, closing the dialog before the customer saw the
   *  confirmation. Same reason the assistant's transcript lives up there. */
  historyOpen: boolean;
  onOpenHistory: () => void;
  onCloseHistory: () => void;
  /** History is a paid-tier surface for the same reason saving is: a free
   *  customer has no server-side copy of anything, so there is no history to
   *  show and a button leading to a permanently empty list is a worse answer
   *  than no button. */
  paid: boolean;
  pageKey: string;
  locale: string;
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
  // ALWAYS VISIBLE NOW. This used to read
  // `rightSideBarVisible: hasSelection && !assistantOpen`, because the column
  // held the block's fields and the assistant was a fourth column that
  // appeared beside everything. Two things competed for one slot and the
  // assistant hid the fields when it opened.
  //
  // The assistant lives INSIDE that column now, above the fields, so the
  // column is never empty and never has to be hidden: with nothing selected
  // it is the assistant, and selecting a block adds the block's own fields
  // beneath it. See the `fields` override in editor-client.tsx.
  useEffect(() => {
    dispatch({ type: "setUi", ui: { rightSideBarVisible: true } });
  }, [dispatch]);

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
    "flex h-8 w-8 items-center justify-center rounded-md [font-size:var(--text-base)] transition-colors disabled:opacity-30 [color:var(--color-paper-dim)] enabled:hover:[background-color:var(--color-ink-850)] enabled:hover:[color:var(--color-paper)]";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
      {/* THE 「Ask AI」 BUTTON IS GONE.
          The founder's objection was 「把这个AI修改放在这里谁会去按啦」 — the
          product's single most valuable feature was a toolbar button that
          opened a panel, which meant most customers never met it at all. It is
          now a permanent column on the right instead of a thing you have to
          know to press. */}
      <span className="flex-1" />

      {/* Save STATE, not just a save button. A product that only ever shows a
          button leaves the customer with no answer to "did that work" other
          than pressing it again. */}
      <span
        role="status"
        className={`[font-size:var(--text-xs)] ${dirty && !autosaving ? "[color:var(--color-brass-bright)]" : "[color:var(--color-paper-dim)]"}`}
      >
        {saving
          ? t("saving")
          : autosaving
            ? t("autosaving")
            : dirty
              ? t("unsaved")
              : savedAt
                ? // The actual clock time, not "just now" -- which stopped
                  // being true a minute after it was rendered and never
                  // updated, i.e. it asserted something false about the
                  // customer's data for as long as the tab stayed open.
                  t("savedAtTime", { time: formatTime(savedAt, locale) })
                : ""}
      </span>

      {paid ? (
        <button
          type="button"
          onClick={onOpenHistory}
          className="rounded-md px-2.5 py-1.5 [font-size:var(--text-xs)] transition-colors [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          {t("historyCta")}
        </button>
      ) : null}

      <VersionHistoryDialog
        open={historyOpen}
        onClose={onCloseHistory}
        pageKey={pageKey}
        locale={locale}
        // Recorded on Puck's own history stack, so restoring the wrong version
        // is undone with the same button as everything else.
        onRestored={(layout) => dispatch({ type: "setData", data: layout, recordHistory: true })}
      />

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
        className="rounded-md px-3.5 py-1.5 [font-size:var(--text-sm)] transition-colors disabled:opacity-60 [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]"
      >
        {saving ? t("saving") : t("saveCta")}
      </button>
    </div>
  );
}
