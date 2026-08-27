"use client";

import type { ReactNode } from "react";
import { useEditorUi } from "@/design-system/editor/editor-ui";

/**
 * The canvas holds a strip clear on its right while a sheet is docked there.
 *
 * This is the whole of the fix for 「面板盖住了你正在改的那一块」. The panel used
 * to centre itself on the selected block, and every block in a generated system
 * is full-width, so 换款式 on 重点数字卡 covered the card whose shape it was
 * offering — the founder pressed a variant and could not see what he had
 * chosen.
 *
 * Padding rather than a width: the customer's page reflows into what is left,
 * so the block is still whole, still theirs, just narrower for as long as the
 * panel is open. A width or a transform would have scaled or clipped it, and a
 * clipped table is a worse answer than a covered one.
 *
 * Rendered as a component rather than a style computed in editor-client because
 * `useEditorUi` must be called inside the provider, and editor-client is the
 * component that renders it.
 */
export function CanvasGutter({
  className,
  children,
  ...rest
}: {
  className: string;
  children: ReactNode;
  /* Anything else lands on the div. It took only `className` and `children`,
     so `data-ground` -- which decides whether the canvas is a dark PAGE or a
     dark box on a light one -- was passed in and silently dropped. Ninth time
     in this repo that a value reached a component that had no parameter for
     it; a rest spread is the version that cannot happen again. */
} & Record<string, unknown>) {
  const { gutter } = useEditorUi();
  return (
    <div
      {...rest}
      className={className}
      style={{
        paddingRight: gutter,
        // Fast enough not to feel like a page load, slow enough that the
        // customer sees WHERE their page went rather than it teleporting.
        transition:
          "padding-right var(--dur, 160ms) var(--ease-out-quad, ease-out)",
      }}
    >
      {children}
    </div>
  );
}
