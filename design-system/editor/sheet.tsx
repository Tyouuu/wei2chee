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

      // The same floor for both arrangements: the top of the canvas, never the
      // top of the window. A sheet that clears 12px sits ON the editor's own
      // bar -- over 保存设计, 发布 and the handoff -- and 加一段 opened from a
      // block near the top of a short page did exactly that. Seen in a
      // screenshot; there is no measurement that would have caught it, because
      // the arithmetic was right about the WINDOW and wrong about the product.
      const canvasTop =
        document.querySelector("[data-editor-canvas]")?.getBoundingClientRect()
          .top ?? 12;
      const floor = Math.max(12, canvasTop + 8);

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
        const a = anchor?.getBoundingClientRect();
        const wanted = a && a.width > 0 ? a.top : floor;
        el.style.width = `${w}px`;
        el.style.left = `${vw - w - 16}px`;
        el.style.top = `${Math.max(floor, Math.min(wanted, vh - h - 12))}px`;
        el.style.maxHeight = `${Math.max(220, vh - floor - 16)}px`;
        return;
      }

      /*
        NOT DOCKABLE — SO IT RISES FROM THE BOTTOM.

        This is Durable's shape, and it is taken for the half of their argument
        that is actually better than ours rather than for the whole of it.

        On a wide window our arrangement wins and stays: the sheet pins right
        and the canvas gives up the same width as padding, so the block being
        edited reflows and stays completely visible beside the panel editing it.
        Durable's bottom sheet covers the foot of their canvas, which is exactly
        the defect the docked version was written to fix (see the note at the
        top of this file: 换款式 on 重点数字卡 used to cover the card).

        On a NARROW window there is no width to give up, and what was here
        before was the panel floating over the block — the same covering
        problem, on the screen with the least room to spare. A bottom sheet is
        the right object there: full width, anchored to an edge instead of to a
        block, and it is the shape every phone the owner has ever used puts a
        panel in.

        So: docked when there is room, a bottom sheet when there is not, and
        never a card floating over the thing it edits.
      */
      el.style.width = `${vw}px`;
      el.style.left = "0px";
      // 68vh leaves a third of the canvas visible above it, which is the least
      // that still reads as "a panel over my page" rather than "a new screen".
      const sheetH = Math.min(el.scrollHeight + 8, Math.round(vh * 0.68));
      el.style.top = `${vh - sheetH}px`;
      el.style.maxHeight = `${sheetH}px`;
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
        // A bottom sheet is not a card that happens to be at the bottom: it is
        // square where it meets the edge and round where it rises, with no
        // border on the three sides that are off-screen. Rounding all four
        // corners of a full-width panel flush to the bottom leaves two little
        // gaps of canvas under it, which reads as a misplaced card.
        className={`fixed z-[60] flex flex-col overflow-hidden [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] ${
          docked
            ? "rounded-[var(--radius-lg)] border"
            : "rounded-t-[var(--radius-lg)] border-t border-x-0 border-b-0 border-t"
        }`}
        style={{
          display: open ? "flex" : "none",
          // Docked it can use the whole window height, because nothing is
          // underneath it any more.
          // Docked, the real cap is set in `place()` from the canvas top; as a
          // bottom sheet it is set there too, from 68vh.
          boxShadow: docked
            ? "var(--shadow-overlay, 0 18px 46px rgba(6,14,26,.5))"
            : "0 -14px 40px rgba(6,14,26,.45)",
        }}
      >
        {/* The handle. Every bottom sheet the owner has ever seen has one, and
            it is the only thing that says "this rose from the edge" rather than
            "this is a panel that happens to be down here". */}
        {docked ? null : (
          <div className="flex shrink-0 justify-center pt-2" aria-hidden>
            <span className="h-1 w-9 rounded-full [background-color:var(--color-ink-700)]" />
          </div>
        )}
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
