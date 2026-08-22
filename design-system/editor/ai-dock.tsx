"use client";

import { useState, type ReactNode } from "react";

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
 */
export function AiDock({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-end px-4 pb-4"
      // The canvas scrolls under this. Only the card itself takes pointer
      // events, so the page behind stays clickable everywhere the card is not.
    >
      <div
        className="pointer-events-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-[var(--radius-lg)] border [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
        style={{
          maxHeight: open ? "min(340px, 40vh)" : undefined,
          boxShadow: "var(--shadow-overlay, 0 16px 40px rgba(6,14,26,.42))",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-2 px-3.5 py-2 text-left [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)]"
        >
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-full [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-size:9px] [font-weight:var(--fw-semibold)]"
          >
            AI
          </span>
          <span className="[color:var(--color-paper)] [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)]">
            用讲的改
          </span>
          <span className="ml-auto [font-size:var(--text-xs)]">{open ? "收起" : "打开"}</span>
        </button>
        {/* Kept mounted when collapsed: the transcript of what the assistant
            already changed is not something to throw away because the panel was
            in the way of a table for a moment. */}
        <div className="min-h-0 flex-1 flex-col" style={{ display: open ? "flex" : "none" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
