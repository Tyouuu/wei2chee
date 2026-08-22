"use client";

import { useState } from "react";
import { usePreviewMode } from "@/design-system/editor/preview-toggle";

/**
 * 「这是根据你的生意自动生成的初稿」 — the same message, no longer a band.
 *
 * It used to be a full-width strip above the canvas, which made the chrome two
 * bands tall (measured: 38px + 50px = 88px before the customer saw anything of
 * their own) at a point where the whole exercise was getting to one. Durable
 * has no such strip at all.
 *
 * Three changes, none of them to what it says:
 *
 *   IT SITS ON THE CANVAS, not above it. It is a note about the content, so it
 *   belongs with the content -- and it scrolls away as soon as the customer
 *   starts working, which a fixed band never did.
 *
 *   IT CAN BE DISMISSED. It was unclosable and only disappeared after the first
 *   save, so a customer who read it and then spent an hour designing kept
 *   paying 38px for a sentence they had already understood. Deliberately NOT
 *   persisted: it costs nothing to show once per visit, and remembering it in
 *   localStorage would mean a customer who dismissed it on a phone never sees
 *   it on the laptop where they actually design.
 *
 *   IT DISAPPEARS IN PREVIEW, along with everything else of ours.
 */
export function DraftNotice({
  title,
  body,
  dismiss,
}: {
  title: string;
  body: string;
  dismiss: string;
}) {
  const [gone, setGone] = useState(false);
  const { previewing } = usePreviewMode();
  if (gone || previewing) return null;

  return (
    // TOP-RIGHT, not top-centre. Centred, it landed square on the page's own
    // heading -- the first thing a customer reads on their new system was
    // covered by a note telling them it was a draft. Every generated page puts
    // its title top-left and leaves the opposite corner empty, so that is where
    // this goes, and it still costs zero bands of chrome.
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end px-5 pt-4">
      <div
        className="pointer-events-auto flex max-w-[440px] flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-lg)] border px-3.5 py-2 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
        style={{ boxShadow: "var(--shadow-overlay, 0 10px 26px rgba(6,14,26,.34))" }}
      >
        <span className="[color:var(--color-paper)] [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)]">
          {title}
        </span>
        <span className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">{body}</span>
        <button
          type="button"
          onClick={() => setGone(true)}
          className="ml-auto shrink-0 rounded-md px-2 py-1 [font-size:var(--text-micro)] [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          {dismiss}
        </button>
      </div>
    </div>
  );
}
