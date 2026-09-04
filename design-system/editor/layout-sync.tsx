"use client";

import { useEffect } from "react";
import { usePuck } from "@puckeditor/core";
import { relayout } from "@/lib/portal/relayout";
import type { PuckLayout } from "@/lib/portal/layout-ops";

/**
 * Moves the blocks in the canvas when 排法 changes on a page that is already
 * saved.
 *
 * ── THE BUG ───────────────────────────────────────────────────────────────
 *
 * 排法 writes `projects.layout`, and the page is generated on every read until
 * the customer first saves. After that the arrangement is theirs and
 * generation stops -- which is the right rule, and is why the five buttons
 * were written as 「write the column, reload」.
 *
 * The comment in editor-client said this path was 「only ever reached from a
 * page that has never been saved」. That was an assumption, not a guard: the
 * buttons are shown either way. On a saved page they wrote the column, lit up
 * (`aria-pressed`) and the page did not move. A control that reports success
 * and changes nothing is worse than a disabled one, because the owner believes
 * it and stops looking for the problem.
 *
 * ── WHY NOT REGENERATE ────────────────────────────────────────────────────
 *
 * Regenerating would throw away every word they typed, every column they added
 * and every row they edited -- a far worse bug than the one being fixed. So
 * the real blocks are moved instead, which is the same answer the session
 * working on the assistant reached for the same request on the same day.
 *
 * ── WHY AN EVENT ──────────────────────────────────────────────────────────
 *
 * The 风格 sheet is chrome and is mounted OUTSIDE Puck's provider, so it cannot
 * dispatch. This is inside. Identical shape to rail-sync.tsx, and for the same
 * reason: a window event is the smallest thing that crosses that boundary
 * without either side importing the other.
 *
 * It lands on the undo stack (`recordHistory`), because this moves blocks the
 * customer owns and they have to be able to take it back.
 */

export const LAYOUT_SYNC_EVENT = "formae:layout-changed";

export type LayoutSyncDetail = { style: string | null; layout: string | null };

/** Fired by the chrome; heard by the canvas. */
export function announceLayout(style: string | null, layout: string | null) {
  window.dispatchEvent(
    new CustomEvent<LayoutSyncDetail>(LAYOUT_SYNC_EVENT, { detail: { style, layout } }),
  );
}

export function LayoutSync() {
  const { appState, dispatch } = usePuck();

  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<LayoutSyncDetail>).detail;
      if (!detail) return;
      const before = appState.data as unknown as PuckLayout;
      const after = relayout(before, detail.layout);
      // `relayout` returns the same object when nothing moved, so this is also
      // the guard against pushing an identical state onto the undo stack.
      if (after === before) return;
      dispatch({ type: "setData", data: after as never, recordHistory: true });
    }
    window.addEventListener(LAYOUT_SYNC_EVENT, onChanged);
    return () => window.removeEventListener(LAYOUT_SYNC_EVENT, onChanged);
  }, [appState.data, dispatch]);

  return null;
}
