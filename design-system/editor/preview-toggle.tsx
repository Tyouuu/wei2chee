"use client";

import { usePuck } from "@puckeditor/core";

/**
 * 预览 — see the system with nothing of Formae's on the screen.
 *
 * Durable's top bar has exactly one control that is neither a menu nor Publish,
 * and it is this. It matters more here than it does there: what this product
 * SELLS is "here is what your system will look like", and until now there was
 * no way for the customer to look at their own system without the editor's
 * selection outlines, hover rails and ＋ affordances drawn over it. They could
 * only ever see the tool, never the thing.
 *
 * It rides Puck's own `previewMode` rather than a second rendering path.
 * `interactive` is Puck's documented UiState value for "stop treating this as a
 * canvas" -- overlays off, drag off, the page behaving as a page. Rendering the
 * data through <Render> in a separate overlay instead would have meant a second
 * code path that could drift from the editor's, and would have thrown away
 * scroll position on every toggle.
 *
 * editor-client hides the bar, the draft notice and the assistant dock off the
 * same flag, so preview really is an empty screen with their system in it, plus
 * one way back.
 */
export function usePreviewMode() {
  const { appState, dispatch } = usePuck();
  const previewing = appState.ui.previewMode === "interactive";
  const setPreviewing = (on: boolean) =>
    dispatch({ type: "setUi", ui: { previewMode: on ? "interactive" : "edit" } });
  return { previewing, setPreviewing };
}

export function PreviewButton({ label }: { label: string }) {
  const { previewing, setPreviewing } = usePreviewMode();
  return (
    <button
      type="button"
      onClick={() => setPreviewing(!previewing)}
      aria-pressed={previewing}
      className="rounded-md px-2.5 py-1.5 [font-size:var(--text-xs)] transition-colors [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
    >
      {label}
    </button>
  );
}

/**
 * The way back, and the only thing Formae draws while previewing.
 *
 * Floated bottom-centre rather than put back in a bar, because a bar is exactly
 * what preview exists to remove -- and bottom-centre rather than a corner
 * because a customer who has just scrolled their own page needs to find it
 * without hunting. Escape works too: this mode is a detour, and every detour
 * should have the same exit as the sheets do.
 */
export function ExitPreview({ label }: { label: string }) {
  const { previewing, setPreviewing } = usePreviewMode();
  if (!previewing) return null;
  return (
    <button
      type="button"
      onClick={() => setPreviewing(false)}
      className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full px-4 py-2 [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] [background-color:var(--color-canvas)] [color:var(--color-paper)]"
      style={{ boxShadow: "0 10px 30px rgba(6,14,26,.45)" }}
    >
      {label}
    </button>
  );
}
