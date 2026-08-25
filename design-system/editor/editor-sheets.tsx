"use client";

import { Children, isValidElement, useEffect, type ReactNode } from "react";
import { usePuck } from "@puckeditor/core";
import { Sheet } from "@/design-system/editor/sheet";
import { VariantPicker } from "@/design-system/editor/variant-picker";
import { useEditorUi } from "@/design-system/editor/editor-ui";
import { puckConfig } from "@/design-system/editor/puck-config";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { useTranslations } from "next-intl";

/**
 * Fields a shop owner should never be shown first.
 *
 * The founder opened 改文字 on 重点数字卡 and the second and third things in the
 * panel were 「链接 /zh/portal/payments」 and a 走势 list of raw numbers —
 * 42000, 51000. A renovation contractor reading a route out of his own
 * dashboard does not think "advanced setting", he thinks he pressed something
 * wrong.
 *
 * They are HIDDEN, NOT REMOVED. Every one of them still does something real:
 * the link is where a card goes when you press it, the sparkline is the shape
 * of the trend. They move behind a 「进阶」 disclosure so the panel opens on the
 * three or four fields that are actually the customer's words, and the rest is
 * one press away for whoever wants it.
 *
 * Matched on field NAME, not on the component. Puck hands the `fields` override
 * its children as one element per field, keyed and propped with `fieldName`
 * (verified against 0.23.0's FieldsInternal: `fieldNames.map(fieldName =>
 * <FieldsChildMemo fieldName={fieldName} key={fieldName} />)`), so this needs
 * no cooperation from puck-config and cannot fall out of sync with it.
 */
const ADVANCED_FIELDS = new Set([
  "href", // 链接 — an app route on a card the customer is renaming
  "brandHref", // 首页链接 on the shell
  "clearAllHref", // 清空全部链接 on the filter chips
  "spark", // 走势（由旧到新）— an array of bare numbers
]);

function splitFields(children: ReactNode) {
  const plain: ReactNode[] = [];
  const advanced: ReactNode[] = [];
  Children.toArray(children).forEach((child) => {
    const name =
      isValidElement<{ fieldName?: string }>(child) &&
      typeof child.props.fieldName === "string"
        ? child.props.fieldName
        : null;
    (name && ADVANCED_FIELDS.has(name) ? advanced : plain).push(child);
  });
  return { plain, advanced };
}

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
  const t = useTranslations("portal.editor");
  const { selectedItem } = usePuck();
  const { sheet, closeSheet, openSheet, anchor } = useEditorUi();
  const name = blockLabel(selectedItem?.type);
  const { plain, advanced } = splitFields(children);

  // Deselecting has to close these, and it is not automatic: the sheet is
  // portalled out of Puck's layout, so nothing about losing the selection
  // unmounts it. Without this, clicking the canvas background left a 换款式
  // panel floating over a page with nothing selected, editing whatever had
  // been selected before.
  useEffect(() => {
    if (!selectedItem && sheet?.kind === "block") closeSheet();
  }, [selectedItem, sheet, closeSheet]);

  /*
    ONE SHEET, TWO TABS — 2026-08-25.

    There were two: 换款式 opened one panel and 改文字 opened another, both
    anchored to the same block, each with its own title bar, and switching
    between them meant closing one thing and opening another over the same
    words. Durable's is one sheet on the block with Content and Design across
    the top (screenshots d5 and d6), and the founder marked it 拿 with the
    plainest reason available: 「同一块东西有两个地方」.

    WHY THE TWO TOOLBAR BUTTONS SURVIVE. They open the same sheet on different
    tabs. Collapsing them into one button would make 换款式 -- the control that
    changes what a block IS, and the one this whole product is built on --
    something you find by opening a panel and reading a tab, rather than
    something you press.

    WHY THE FIELDS STAY MOUNTED WHILE THE DESIGN TAB IS SHOWING. `children` is
    Puck's live field tree; unmounting it throws away the caret and the focus
    of anyone who was mid-word when they went to look at the shapes. The tab
    hides it, exactly as Sheet hides the whole thing when closed.
  */
  const tab = sheet?.kind === "block" ? sheet.tab : "content";
  const setTab = (next: "content" | "design") =>
    openSheet({ kind: "block", tab: next }, anchor ?? undefined);

  return (
    <Sheet
      open={sheet?.kind === "block"}
      onClose={closeSheet}
      anchor={anchor}
      title={name}
    >
      <div
        role="tablist"
        className="flex gap-1 border-b px-2 pt-1 [border-color:var(--color-ink-800)]"
      >
        {(
          [
            ["content", t("tabContent")],
            ["design", t("tabDesign")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-t-[var(--radius-sm)] px-3 py-2 [font-size:var(--text-sm)] transition-colors ${
              tab === key
                ? "[color:var(--color-paper)] [font-weight:var(--fw-semibold)] [box-shadow:inset_0_-2px_0_var(--color-primary)]"
                : "[color:var(--color-paper-dim)] hover:[color:var(--color-paper)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* `hidden` rather than a branch — see the note above on the caret. */}
      <div hidden={tab !== "content"}>
        <div className="px-1 py-1">
          {plain}
          {advanced.length > 0 ? (
            // <details> rather than a useState toggle for the same reason
            // bar-menu.tsx uses one: Puck re-creates every override render
            // function on each editor render, and a boolean in this subtree
            // would be reset out from under a customer mid-edit. The element
            // keeps its own open state in the DOM.
            <details className="mt-2 border-t pt-2 [border-color:var(--color-ink-800)]">
              <summary className="cursor-pointer list-none rounded-[var(--radius-sm)] px-2 py-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]">
                {t("advanced")} · {advanced.length}
              </summary>
              <div className="pt-1">{advanced}</div>
            </details>
          ) : null}
        </div>
      </div>

      <div hidden={tab !== "design"}>
        <VariantPicker style={style} palette={palette} />
      </div>
    </Sheet>
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
  const t = useTranslations("portal.editor");
  const { sheet, closeSheet, anchor } = useEditorUi();
  return (
    <Sheet
      open={sheet?.kind === "insert"}
      onClose={closeSheet}
      anchor={anchor}
      title={t("addBlock")}
    >
      {/* TWO COLUMNS, TWELVE SHELVES, TEN OF THEM CLOSED.
          The grid itself is set in puck-theme.css against Puck's own
          ComponentList-content container -- Puck owns the element between this
          div and the tiles, so the columns cannot be declared here. `data-`
          attribute rather than a class because that stylesheet is global and
          this is the only palette that should be two across. */}
      <div data-insert-palette className="px-2.5 py-2">{children}</div>
    </Sheet>
  );
}
