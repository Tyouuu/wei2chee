"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SHEET_WIDTH, useEditorUi } from "@/design-system/editor/editor-ui";

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
 * POSITION -- and this is the part that was wrong.
 *
 * It used to centre itself horizontally on the block and sit under it. Every
 * block in a generated system is full-width, so "centred on the block" means
 * "over the middle of the block": the founder pressed 换款式 on 重点数字卡, and
 * the panel covered the very card whose shape he was choosing. You picked a
 * variant and could not see what you had picked.
 *
 * So when the window can spare the room (see `useDockable`), the sheet pins to
 * the right edge and the CANVAS gives up the same width as padding -- the block
 * reflows into what is left and stays completely visible beside the panel that
 * edits it. The gutter is applied in editor-client; this file only has to agree
 * about where the panel goes.
 *
 * Below that width there is nothing to give up, so it keeps the old behaviour:
 * under the block, above it if that overflows, clamped to the viewport.
 */
export function Sheet({
  open,
  title,
  onClose,
  anchor,
  width = SHEET_WIDTH,
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
  const { host, gutter } = useEditorUi();
  const docked = gutter > 0;
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

      if (docked) {
        // Pinned to the right edge, in the gutter the canvas is holding open.
        // Vertically it still follows the block -- a panel that always started
        // at the top of the window would be a long way from a block near the
        // bottom -- but it never runs off either end.
        //
        // The floor is the TOP OF THE CANVAS, not the top of the window. 风格
        // is opened from a button in the editor's own bar, so its anchor sits
        // at y≈24 and the panel was landing on top of 保存设计 and the handoff
        // button -- caught in a screenshot, not in a measurement.
        const canvas = document
          .querySelector("[data-editor-canvas]")
          ?.getBoundingClientRect();
        const floor = canvas ? canvas.top + 8 : 12;
        const a = anchor?.getBoundingClientRect();
        const wanted = a && a.width > 0 ? a.top : floor;
        el.style.width = `${w}px`;
        el.style.left = `${vw - w - 16}px`;
        el.style.top = `${Math.max(floor, Math.min(wanted, vh - h - 12))}px`;
        el.style.maxHeight = `${Math.max(220, vh - floor - 16)}px`;
        return;
      }

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
  }, [open, anchor, width, docked]);

  if (!host) return null;

  return createPortal(
    <>
      {/* Click-away, but only when the sheet is floating over the page.
          Transparent rather than dimmed: the point of the sheet is that the
          customer can still see their page change behind it when they press a
          variant, and a scrim would defeat that.

          Docked, this layer is actively wrong. The canvas is holding a gutter
          open beside the panel precisely so the customer can keep working with
          it there, and a full-screen catcher would turn their first click on
          another block into "close the panel" -- one wasted click on every
          block after the first. Escape and ✕ still close it. */}
      {docked ? null : (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-[59]"
          style={{ display: open ? "block" : "none" }}
        />
      )}
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-label={typeof title === "string" ? title : undefined}
        className="fixed z-[60] flex flex-col overflow-hidden rounded-[var(--radius-lg)] border [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
        style={{
          display: open ? "flex" : "none",
          // Docked it can use the whole window height, because nothing is
          // underneath it any more.
          // Docked, the real cap is set in `place()` from the canvas top.
          maxHeight: docked ? undefined : "74vh",
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
