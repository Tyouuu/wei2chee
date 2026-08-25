"use client";

import { useRef, type ReactNode } from "react";
import { ActionBar, usePuck } from "@puckeditor/core";
import { VARIANTS } from "@/design-system/editor/variants";
import { useEditorUi } from "@/design-system/editor/editor-ui";
import { useTranslations } from "next-intl";

/**
 * THE FLOATING TOOLBAR UNDER THE SELECTED BLOCK — Durable's `Design / Edit
 * content / ↑ ↓ 🗑` pill, which is the third screenshot the founder sent.
 *
 * It replaces a 400px column that stood open whether or not it had anything to
 * say. Two buttons here do what that column did, and neither of them exists
 * until a block is selected:
 *
 *   换款式  the pictures of alternative shapes (variant-picker.tsx)
 *   改文字  Puck's own fields for this block
 *
 * WHY PUCK'S `children` IS RENDERED RATHER THAN REPLACED. Everything after the
 * separator — move up, move down, duplicate, delete — is Puck's own set of
 * actions, wired to its history and its drag state. Re-implementing them to get
 * Chinese labels would mean re-implementing "what does delete do to a slot that
 * has children", which Puck already answers correctly. They are icons, so they
 * were never the part that needed translating.
 *
 * WHY 换款式 CAN BE ABSENT. Most blocks have no alternatives. A disabled or
 * empty 换款式 on 头像 is a worse toolbar than one with fewer buttons — it
 * teaches the customer that the button sometimes lies.
 */
export function BlockToolbar({
  label,
  children,
  parentAction,
}: {
  label?: string;
  children: ReactNode;
  parentAction: ReactNode;
}) {
  const t = useTranslations("portal.editor");
  const { selectedItem } = usePuck();
  const { openSheet, sheet } = useEditorUi();
  const ref = useRef<HTMLDivElement | null>(null);

  const type = selectedItem?.type;
  const hasVariants = !!(type && VARIANTS[type]?.length);

  /**
   * The sheet hangs off the BLOCK, not off this toolbar.
   *
   * Puck parks the action bar at the block's top-RIGHT corner, so centring a
   * 470px sheet on it pushed the sheet into the right edge of the window on
   * every wide block — measured: clamped hard against the margin, with the
   * canvas's whole left half empty. Centring on the block instead puts the
   * sheet over the thing being changed, which is where the customer is already
   * looking.
   *
   * `data-puck-component` carries the component id (verified against a live
   * canvas: dashboard-shell, dashboard-rail, dashboard-header …), so this is a
   * documented attribute lookup rather than a walk up the overlay's DOM, which
   * would break the moment Puck reshuffles its wrappers. Falls back to this
   * toolbar if the block cannot be found.
   */
  const anchorEl = (): HTMLElement | null => {
    const id = selectedItem?.props?.id;
    if (typeof id === "string") {
      const el = document.querySelector<HTMLElement>(`[data-puck-component="${CSS.escape(id)}"]`);
      if (el) return el;
    }
    return ref.current;
  };

  return (
    // The wrapper is only the fallback anchor -- see anchorEl() above for why
    // the sheet prefers the block itself.
    <div ref={ref}>
      <ActionBar label={label}>
        <ActionBar.Group>
          {/* BOTH BUTTONS SURVIVED THE MERGE, on purpose. They open the same
              sheet on different tabs (editor-sheets.tsx). One button would make
              换款式 -- the control that changes what a block IS, and the thing
              this product is built on -- something you find by opening a panel
              and reading a tab rather than something you press. */}
          {hasVariants ? (
            <ActionBar.Action
              onClick={() => openSheet({ kind: "block", tab: "design" }, anchorEl())}
              active={sheet?.kind === "block" && sheet.tab === "design"}
              label={t("changeVariant")}
            >
              <span className={pill(sheet?.kind === "block" && sheet.tab === "design")}>
                {t("changeVariant")}
              </span>
            </ActionBar.Action>
          ) : null}
          <ActionBar.Action
            onClick={() => openSheet({ kind: "block", tab: "content" }, anchorEl())}
            active={sheet?.kind === "block" && sheet.tab === "content"}
            label={t("editText")}
          >
            <span className={pill(sheet?.kind === "block" && sheet.tab === "content")}>
              {t("editText")}
            </span>
          </ActionBar.Action>
        </ActionBar.Group>
        <ActionBar.Separator />
        {parentAction}
        {children}
      </ActionBar>
    </div>
  );
}

/**
 * The pressed look for a labelled action.
 *
 * Puck marks an active action by COLOUR (--puck-color-interactive-inverse-active),
 * and Formae's chrome is monochrome -- it has no accent hue, so "resting light"
 * and "active light" would be the same white. A filled pill says "this sheet is
 * open" without needing a second colour.
 */
function pill(on: boolean) {
  return [
    "whitespace-nowrap rounded-[var(--radius-sm)] px-1.5 py-0.5 [font-size:var(--text-xs)]",
    on ? "[background-color:var(--color-ink-800)] [color:var(--color-paper)]" : "",
  ].join(" ");
}
