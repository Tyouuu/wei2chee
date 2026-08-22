"use client";

import { useRef, type ReactNode } from "react";
import { usePuck } from "@puckeditor/core";
import { useEditorUi } from "@/design-system/editor/editor-ui";

/**
 * ＋ 加一段 — the blue line that appears in the gap under a block when the
 * pointer is over it, and Durable's "Add Section" from the founder's second
 * screenshot.
 *
 * WHAT IT REPLACES. Adding a block used to mean: find 「+ 加东西」 in the
 * toolbar, open a 54-tile drawer down the left of the screen, find the tile,
 * click it, and have the block land at the END of the page — then drag it to
 * where you actually wanted it. Four of those five steps exist because the
 * palette had no idea where you were pointing. This one does: the ＋ sits in
 * the gap it will insert into, and hands that position to the sheet.
 *
 * WHY IT IS RENDERED PER-COMPONENT rather than once per gap. Puck exposes
 * `componentOverlay`, which wraps each block and knows that block's id and
 * hover state; there is no "gap" element to hang anything on. Drawing the
 * affordance at the BOTTOM edge of each block gives one per gap anyway, and it
 * inherits Puck's own hover tracking instead of a second implementation of it.
 */
export function InsertAffordance({
  children,
  hover,
  isSelected,
  componentId,
}: {
  children: ReactNode;
  hover: boolean;
  isSelected: boolean;
  componentId: string;
}) {
  const { getSelectorForId } = usePuck();
  const { openSheet, sheet } = useEditorUi();
  const ref = useRef<HTMLButtonElement | null>(null);

  // Stays up while ITS OWN sheet is open, so the customer can see which gap
  // they are adding into while they pick. `sheet.kind === "insert"` alone would
  // light every gap on the page at once.
  const sel = getSelectorForId(componentId);
  const mine =
    sheet?.kind === "insert" && !!sel && sheet.zone === sel.zone && sheet.index === sel.index + 1;
  const show = hover || isSelected || mine;

  return (
    <>
      {children}
      {/* `pointer-events-none` on the rail, `auto` on the button: Puck sets
          `pointer-events: none` on everything inside a component so a click
          lands on the block rather than on its content, and an overlay that
          swallowed pointer events across the block's full width would make the
          block itself unclickable. Only the pill takes events. */}
      <div
        className="pointer-events-none absolute inset-x-0 z-30 flex h-6 items-center justify-center"
        style={{ bottom: -13, opacity: show ? 1 : 0, transition: "opacity 120ms" }}
      >
        <span
          aria-hidden
          className="absolute inset-x-2 h-[2px] rounded-[1px]"
          style={{ backgroundColor: "var(--color-primary)", opacity: show ? 0.55 : 0 }}
        />
        <button
          ref={ref}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!sel) return;
            openSheet({ kind: "insert", zone: sel.zone, index: sel.index + 1 }, ref.current);
          }}
          className="pointer-events-auto relative rounded-full px-2.5 py-0.5 [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] shadow-sm"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-on-primary)",
          }}
        >
          ＋ 加一段
        </button>
      </div>
    </>
  );
}
