"use client";

import { useEffect, type ReactNode } from "react";
import { usePuck } from "@puckeditor/core";
import { Sheet } from "@/design-system/editor/sheet";
import { VariantPicker } from "@/design-system/editor/variant-picker";
import { useEditorUi } from "@/design-system/editor/editor-ui";
import { puckConfig } from "@/design-system/editor/puck-config";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/** The block's Chinese name, from the same config the palette reads, so the
 *  sheet title matches the tile the customer added it from. */
function blockLabel(type: string | undefined): string {
  if (!type) return "";
  const c = (puckConfig.components as Record<string, { label?: string }>)[type];
  return c?.label ?? type;
}

/**
 * The two sheets a selected block can open, plus the one rule that keeps them
 * honest: they close when the block goes away.
 *
 * Rendered from the `fields` override, which is the only place Puck hands over
 * the selected block's own field editors. That override still runs with
 * `rightSideBarVisible: false` — the flag only sets that grid column's width to
 * 0 (see index.css's `_PuckLayout--rightSideBarVisible_` rule), it does not stop
 * the subtree rendering — which is what makes it possible to take a docked
 * column and float it without re-implementing any of Puck's field types.
 */
export function BlockSheets({
  style,
  palette,
  children,
}: {
  style: StyleName;
  palette: string | null;
  /** Puck's own fields for the selected block. */
  children: ReactNode;
}) {
  const { selectedItem } = usePuck();
  const { sheet, closeSheet, anchor } = useEditorUi();
  const name = blockLabel(selectedItem?.type);

  // Deselecting has to close these, and it is not automatic: the sheet is
  // portalled out of Puck's layout, so nothing about losing the selection
  // unmounts it. Without this, clicking the canvas background left a 换款式
  // panel floating over a page with nothing selected, editing whatever had
  // been selected before.
  useEffect(() => {
    if (!selectedItem && (sheet?.kind === "variant" || sheet?.kind === "fields")) closeSheet();
  }, [selectedItem, sheet, closeSheet]);

  return (
    <>
      <Sheet
        open={sheet?.kind === "variant"}
        onClose={closeSheet}
        anchor={anchor}
        width={470}
        title={`${name} · 换款式`}
      >
        <VariantPicker style={style} palette={palette} />
      </Sheet>

      {/* ALWAYS MOUNTED, even closed. `children` is Puck's live field tree; a
          sheet that unmounted it on close would throw away the focus and
          caret of anyone who clicked the canvas mid-word. Sheet toggles
          display, never the children. */}
      <Sheet
        open={sheet?.kind === "fields"}
        onClose={closeSheet}
        anchor={anchor}
        width={420}
        title={`${name} · 改文字`}
      >
        <div className="px-1 py-1">{children}</div>
      </Sheet>
    </>
  );
}

/**
 * The block palette, as a sheet opened from the ＋ between two blocks.
 *
 * Fed by the `drawer` override, so it is the same drawer as before — same
 * tiles, same live previews, same click-to-add — with the docking removed. The
 * founder's objection to the old arrangement was that 54 tiles stood open
 * beside a canvas he was trying to look at; the tiles were never the problem.
 */
export function InsertSheet({ children }: { children: ReactNode }) {
  const { sheet, closeSheet, anchor } = useEditorUi();
  return (
    <Sheet
      open={sheet?.kind === "insert"}
      onClose={closeSheet}
      anchor={anchor}
      width={520}
      title="加一段"
    >
      <div className="px-3 py-3">{children}</div>
    </Sheet>
  );
}
