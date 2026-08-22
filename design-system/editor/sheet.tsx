"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEditorUi } from "@/design-system/editor/editor-ui";

/**
 * A panel that floats over the canvas instead of standing beside it.
 *
 * This is the shape in the founder's Durable screenshots: press 「Design」 on a
 * block's floating toolbar and a card appears above the page, big, with the
 * options in it; press escape or click away and the screen is the page again.
 *
 * WHY IT IS ALWAYS MOUNTED. `visible` toggles CSS, never the children. The
 * fields sheet is fed by Puck's own `fields` override, and unmounting that
 * subtree every time the sheet closes would rebuild every field editor — and,
 * worse, drop the focus and scroll position of a customer who was halfway
 * through typing a column name when they clicked the canvas. Keeping it mounted
 * costs one hidden div and makes open/close free.
 *
 * WHY IT PORTALS. Puck renders the `fields` override inside a grid column that
 * `rightSideBarVisible: false` collapses to 0px, and the `actionBar` override
 * inside a transformed overlay in the canvas. Both clip their children. The
 * portal lifts the panel out to a host div that editor-client owns — see
 * editor-ui.tsx for why that host is not document.body.
 *
 * POSITION. Anchored under the selected block when there is room, and pinned to
 * the bottom of the canvas when there is not, which is the case that actually
 * matters: the customer selects the last block on a long page and the anchor
 * would otherwise put the sheet off-screen. Both are clamped to the viewport.
 */
export function Sheet({
  open,
  title,
  onClose,
  anchor,
  width = 460,
  children,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  /** The element the sheet belongs to, used to place it. Null centres it. */
  anchor?: HTMLElement | null;
  width?: number;
  children: ReactNode;
}) {
  const { host } = useEditorUi();
  const ref = useRef<HTMLDivElement | null>(null);

  // Escape closes, which is the gesture every floating panel in every tool the
  // customer already uses answers to. Bound on the document rather than the
  // sheet because the customer's focus is usually still on the canvas.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Placement runs on open and on resize, reading the anchor's live rect.
  // Deliberately NOT on scroll: the sheet is position:fixed and a page that
  // re-lays-out the panel under a scrolling finger reads as jitter.
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;

    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(width, vw - 24);
      const h = el.offsetHeight || 320;
      let left = (vw - w) / 2;
      let top = Math.max(12, (vh - h) / 2);

      const a = anchor?.getBoundingClientRect();
      if (a && a.width > 0) {
        left = a.left + a.width / 2 - w / 2;
        // Under the block if it fits, above it if not, and never off either
        // edge of the window.
        top = a.bottom + 46;
        if (top + h > vh - 12) top = Math.max(12, a.top - h - 14);
        if (top + h > vh - 12) top = Math.max(12, vh - h - 12);
      }
      el.style.width = `${w}px`;
      el.style.left = `${Math.max(12, Math.min(left, vw - w - 12))}px`;
      el.style.top = `${top}px`;
    };

    place();
    // The fields sheet grows as Puck resolves async fields, so re-place when
    // its own height changes rather than only on window resize.
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, width]);

  if (!host) return null;

  return createPortal(
    <>
      {/* Click-away. Transparent rather than dimmed: the point of the sheet is
          that the customer can still see their page change behind it when they
          press a variant, and a scrim would defeat that. */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-[59]"
        style={{ display: open ? "block" : "none" }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-label={typeof title === "string" ? title : undefined}
        className="fixed z-[60] flex max-h-[74vh] flex-col overflow-hidden rounded-[var(--radius-lg)] border [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
        style={{
          display: open ? "flex" : "none",
          boxShadow: "var(--shadow-overlay, 0 18px 46px rgba(6,14,26,.5))",
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b px-3.5 py-2.5 [border-color:var(--color-ink-800)]">
          <span className="truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关掉"
            className="ml-auto grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </>,
    host,
  );
}
