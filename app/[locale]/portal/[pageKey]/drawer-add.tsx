"use client";

import { useRef, type ReactNode } from "react";
import { usePuck } from "@puckeditor/core";
import { useEditorUi } from "@/design-system/editor/editor-ui";

/**
 * CLICK A BLOCK TO ADD IT.
 *
 * Puck's palette is drag-only. That is a fine interaction for a designer with
 * a mouse and a wide screen, and a bad one for the person this product is for:
 * a contractor on a laptop trackpad, or on a phone, who has never used a page
 * builder. Dragging needs you to know the target exists before you start
 * moving — clicking does not.
 *
 * This was not a hunch. Automating the palette to test the eight new blocks,
 * every click timed out, because there is nothing to click: each label matches
 * two nodes, one of them `pointer-events: none`, and neither responds to a
 * press. If a test harness aiming at exact coordinates cannot add a block, a
 * customer with a trackpad is not going to do better.
 *
 * Drag still works exactly as before. This only adds a second way in.
 */
export function ClickToAdd({ name, children }: { name: string; children: ReactNode }) {
  const { dispatch, appState } = usePuck();
  const { sheet, closeSheet } = useEditorUi();
  const down = useRef<{ x: number; y: number } | null>(null);

  /** Where a new block should land: inside the shell's main slot, at the end.
   *  Every page this product builds is one SystemShell holding a `sidebar` and
   *  a `main` slot (see lib/templates/industry-template.ts), so appending to
   *  the ROOT would put the block beside the shell rather than inside the
   *  page — visually off the bottom of the canvas, which reads as "nothing
   *  happened". Falls back to the root zone for a page that has no shell.
   *
   *  UNLESS THE ＋ SAID OTHERWISE. When this palette was opened from the ＋ in
   *  the gap between two blocks (insert-affordance.tsx), that gap is the
   *  destination and appending to the end would be wrong — it is the entire
   *  reason the affordance exists. The end-of-main fallback below is still what
   *  happens when the palette is opened without a target. */
  const destination = () => {
    if (sheet?.kind === "insert") return { zone: sheet.zone, index: sheet.index };
    const root = appState.data.content?.[0];
    const id = root?.props?.id;
    if (!root || typeof id !== "string") {
      return { zone: "root:default-zone", index: appState.data.content?.length ?? 0 };
    }
    const main = (root.props as Record<string, unknown>).main;
    return {
      zone: `${id}:main`,
      index: Array.isArray(main) ? main.length : 0,
    };
  };

  const add = () => {
    const { zone, index } = destination();
    dispatch({
      type: "insert",
      componentType: name,
      destinationIndex: index,
      destinationZone: zone,
    });
    // The sheet has done its job. Leaving it open over the block that just
    // appeared hides the result of the press.
    if (sheet?.kind === "insert") closeSheet();
  };

  return (
    // A drag ends in a click event too, so a bare onClick would add a second
    // copy every time somebody drags one in. Only a press that stayed put
    // counts as a click.
    <div
      role="button"
      tabIndex={0}
      title="点一下加进页面,或者拖过去"
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        const from = down.current;
        down.current = null;
        if (!from) return;
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 5) return;
        add();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          add();
        }
      }}
      className="group/add flex w-full cursor-pointer flex-col gap-1.5 rounded-[var(--radius-md)] focus-visible:outline focus-visible:outline-2 focus-visible:[outline-color:var(--color-paper-dim)]"
    >
      {children}
    </div>
  );
}
