"use client";

import { useEffect, useState } from "react";
import { usePuck, type Data } from "@puckeditor/core";
import { useTranslations } from "next-intl";

/**
 * Replaces Puck's built-in header, and adds the conversational edit bar beside
 * it.
 *
 * Two problems solved in one place, because they are the same place on screen.
 *
 * 1. Puck ships its own toolbar -- "Page", undo/redo, "Publish" -- in English
 *    and unstyled by this app's tokens. In a product sold to Malaysian-Chinese
 *    SME owners it was the loudest remaining seam: the one control a customer
 *    must press to keep their work was labelled in a language the rest of the
 *    product had stopped using, and it said "Publish", a web-publishing word
 *    for an action that means "save my design".
 *
 * 2. Drag-and-drop is not how most of these customers will actually edit. They
 *    were promised a system that understands their business; expecting them to
 *    discover that a table's columns live in a panel on the right is expecting
 *    them to learn a tool. The edit bar lets them say it instead -- "把'客户'改
 *    成'病人'" -- which is the path Durable and Framer both landed on: keep the
 *    visual editor, put a conversational route beside it, not instead of it.
 *
 * Rendered through `overrides.header`, so it sits inside Puck's own context and
 * drives real editor state through `usePuck` rather than shadowing it: undo and
 * redo are Puck's own history, the save button hands over Puck's live data
 * exactly as its Publish button did, and an AI edit is dispatched as a normal
 * `setData` with history recorded -- so the undo button undoes it like anything
 * else.
 */
export function EditorChrome({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: (data: Data) => void;
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
  // Selecting a block opens the panel; deselecting closes it. Puck already
  // treats `itemSelector` as the selection, so this is following its own state
  // rather than inventing a parallel one.
  const hasSelection = appState.ui.itemSelector != null;
  useEffect(() => {
    dispatch({ type: "setUi", ui: { rightSideBarVisible: hasSelection } });
  }, [hasSelection, dispatch]);

  const [instruction, setInstruction] = useState("");
  const [thinking, setThinking] = useState(false);
  const [reply, setReply] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const text = instruction.trim();
    if (!text || thinking) return;

    setThinking(true);
    setReply(null);
    try {
      const res = await fetch("/api/portal/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: appState.data, instruction: text }),
      });

      if (!res.ok) {
        setReply({ tone: "warn", text: t("aiFailed") });
        return;
      }

      const result = (await res.json()) as {
        layout: Data;
        explanation: string;
        applied: number;
        skipped: { reason: string }[];
      };

      if (result.applied > 0) {
        // `recordHistory` is what puts the edit on the undo stack. Without it a
        // customer who dislikes what the AI did has no way back, which would
        // make the feature something to be afraid of rather than something to
        // try.
        dispatch({ type: "setData", data: result.layout, recordHistory: true });
        setInstruction("");
      }

      // Partial application is reported honestly. Four changes landing and one
      // being dropped is a normal outcome here, and a customer who is not told
      // will assume the whole request was understood.
      const skippedNote = result.skipped.length ? `（${result.skipped.length} 项没能改）` : "";
      setReply({
        tone: result.applied > 0 ? "ok" : "warn",
        text: (result.explanation || t("aiNoChange")) + skippedNote,
      });
    } catch {
      setReply({ tone: "warn", text: t("aiFailed") });
    } finally {
      setThinking(false);
    }
  }

  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-md text-[15px] transition-colors disabled:opacity-30 [color:var(--color-paper-dim)] enabled:hover:[background-color:var(--color-ink-850)] enabled:hover:[color:var(--color-paper)]";

  return (
    // One row, not two. The first version stacked a row carrying the page name
    // and the save controls on top of the edit bar -- and the page name was
    // already spelled out, highlighted, in the page tabs directly above it. So
    // the editor spent 45px of a 900px window restating something the customer
    // was looking at, and pushed their own system further down for it. The
    // controls moved down here; the duplicate row is gone.
    <div className="border-b [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
      <form onSubmit={handleAsk} className="flex flex-wrap items-center gap-2 px-4 py-2">
        <span className="text-[12px] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
          {t("aiLabel")}
        </span>
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={thinking}
          maxLength={500}
          placeholder={t("aiPlaceholder")}
          aria-label={t("aiLabel")}
          className="min-w-[220px] flex-1 rounded-md border px-3 py-1.5 text-[13px] outline-none disabled:opacity-60 [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]"
        />
        <button
          type="submit"
          disabled={thinking || !instruction.trim()}
          className="rounded-md border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-40 [border-color:var(--color-ink-800)] [color:var(--color-paper)] enabled:hover:[background-color:var(--color-ink-850)]"
        >
          {thinking ? t("aiThinking") : t("aiSubmit")}
        </button>

        {/* A rule rather than a gap: undo/redo/save act on the whole page,
            the field to their left acts through the AI. Same row, different
            job, and the separator is what says so. */}
        <span aria-hidden="true" className="mx-1 h-6 w-px [background-color:var(--color-ink-800)]" />

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

        {reply && (
          <span
            role="status"
            className={
              reply.tone === "ok"
                ? "w-full text-[12px] [color:var(--color-jade-bright)]"
                : "w-full text-[12px] [color:var(--color-brass-bright)]"
            }
          >
            {reply.text}
          </span>
        )}
      </form>
    </div>
  );
}
