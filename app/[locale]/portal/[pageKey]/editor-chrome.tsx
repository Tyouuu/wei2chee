"use client";

import { useEffect, type ReactNode } from "react";
import { usePuck, type Data } from "@puckeditor/core";
import { useTranslations } from "next-intl";
import { VersionHistoryDialog } from "./version-history";
import { BarMenu, barMenuItem } from "@/design-system/editor/bar-menu";
import {
  PreviewButton,
  usePreviewMode,
} from "@/design-system/editor/preview-toggle";
import { formatTime } from "@/lib/format-date";

/**
 * Replaces Puck's built-in header.
 *
 * Puck ships its own toolbar — "Page", undo/redo, "Publish" — in English and
 * unstyled by this app's tokens. In a product sold to Malaysian-Chinese SME
 * owners it was the loudest remaining seam: the one control a customer must
 * press to keep their work was labelled in a language the rest of the product
 * had stopped using, and it said "Publish", a web-publishing word for an action
 * that means "save my design".
 *
 * Rendered through `overrides.header`, so it sits inside Puck's own context and
 * drives real editor state through `usePuck` rather than shadowing it: undo and
 * redo are Puck's own history, and the save button hands over Puck's live data
 * exactly as its Publish button did.
 *
 * The conversational editing that used to live here as a single text field is
 * now a panel of its own — see ai-assistant.tsx for why a one-shot box was the
 * feature stated rather than built. What remains here is the button that opens
 * it, and the save state.
 */
export function EditorChrome({
  saving,
  autosaving,
  onSave,
  dirty,
  savedAt,
  historyOpen,
  onOpenHistory,
  onCloseHistory,
  paid,
  pageKey,
  locale,
  nav,
  tools,
  finish,
  publish,
  overflow,
}: {
  saving: boolean;
  /** A save the customer did not ask for, running in the background. Reported
   *  differently from an explicit one: an owner who sees 「保存中…」 they did not
   *  start assumes they pressed something. */
  autosaving: boolean;
  onSave: (data: Data) => void;
  /** Edited since the last successful save. Drives the indicator, and the
   *  beforeunload guard in editor-client. */
  dirty: boolean;
  savedAt: number | null;
  /** Owned by editor-client, not held here. Puck re-creates the `header`
   *  override's render function on every editor render -- and restoring a
   *  version IS an editor render -- so state kept in this component would be
   *  wiped by its own result, closing the dialog before the customer saw the
   *  confirmation. Same reason the assistant's transcript lives up there. */
  historyOpen: boolean;
  onOpenHistory: () => void;
  onCloseHistory: () => void;
  /** 🔴 2026-09-05：这一栏**不再挡历史**。
   *  原本的理由是「没付款的客户根本没有伺服器副本，所以没有历史可看，
   *  而一颗永远通往空清单的按钮比没有按钮更糟」—— 那句话在
   *  20260905410000 之后是假的：没付款的人存得进伺服器，
   *  `save_project_page` 照样替他写版本历史，`restore_page_version`
   *  照样退得回去（`check:handoff` ③ 验过）。
   *  **一个存得进去、看不到历史的编辑器，才是那句话真正在描述的东西。** */
  paid: boolean;
  pageKey: string;
  locale: string;
  /** Controls that act on the whole page rather than on one block -- 风格 today.
   *  Sits beside 预览 because that is the pair Durable keeps in the open
   *  (Themes / Customize / Preview) and the pair a customer reaches for while
   *  looking at the page rather than at a block. */
  tools?: ReactNode;
  /** The handoff -- 「确认设计,交给我们建系统」. Rendered immediately before 保存
   *  设计 so the bar reads left to right as the two steps it is: save what you
   *  made, then give it to us. It used to sit beside the page switcher on the
   *  far LEFT, which was harmless while it only appeared after the first save
   *  and odd once it was there from the start. */
  finish?: ReactNode;
  /** 发布 -- the 官网's public address, on the website page only. Sits before
   *  the handoff and the save so the bar still reads left to right as the
   *  order things happen in: make it, put it online, then hand the system
   *  over. Durable keeps its Publish in exactly this corner. */
  publish?: ReactNode;
  /** The editor's page navigation, style link, locale switcher and sign-out —
   *  everything that used to be a second bar above this one. Passed as a node
   *  rather than moved as markup because it is built in editor-client, outside
   *  Puck's provider, and this component is inside it. See the `topNav` comment
   *  there for why the merge had to happen this way round. */
  nav?: ReactNode;
  /** The 更多 menu: everything that used to sit in the open on the right and
   *  did not need to. Built in editor-client because its entries are links and
   *  a sign-out handler that live there. */
  overflow?: ReactNode;
}) {
  const t = useTranslations("portal.editor");
  const { appState, history, dispatch } = usePuck();
  const { previewing } = usePreviewMode();

  // BOTH COLUMNS STAY COLLAPSED, and this effect is what keeps them that way.
  //
  // The history of this line is the history of the panel: it started as
  // `rightSideBarVisible: hasSelection && !assistantOpen`, became
  // unconditionally `true` when the assistant moved inside the column, and is
  // now unconditionally `false` because the column is gone as a column. Its
  // contents float -- see editor-client.tsx's `fields`, `drawer` and `actionBar`
  // overrides, and design-system/editor/sheet.tsx.
  //
  // It has to be an effect rather than only the `ui` prop on <Puck>: Puck's own
  // chrome can still dispatch `setUi` (its layer tree and its keyboard
  // shortcuts both do), and a single stray toggle would slide a 400px column
  // back over the canvas with no way for the customer to close it, because the
  // button that used to do that is gone.
  useEffect(() => {
    dispatch({
      type: "setUi",
      ui: { rightSideBarVisible: false, leftSideBarVisible: false },
    });
  }, [dispatch]);

  // Ctrl/Cmd+S. Every tool a customer already uses binds it, and a product
  // that ignores it teaches people their reflex does not work here — which is
  // worse than not binding it, because the browser's own "save page" dialog
  // opens instead.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) onSave(appState.data as Data);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appState.data, onSave, saving]);

  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-md [font-size:var(--text-base)] transition-colors disabled:opacity-30 [color:var(--color-paper-dim)] enabled:hover:[background-color:var(--color-ink-850)] enabled:hover:[color:var(--color-paper)]";

  return (
    // ONE BAND, not three. `flex-wrap` and the scrolling page list inside `nav`
    // are what let this hold both halves on a narrow window: it wraps to a
    // second line rather than pushing the document wider than the viewport,
    // which is the failure this bar has already had once at 390px.
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2 [font-size:var(--text-sm)] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]"
      // PREVIEW REALLY MEANS NOTHING OF OURS ON THE SCREEN. Hidden rather than
      // unmounted: this component owns the Ctrl+S binding and the version
      // dialog, and unmounting would drop both for as long as the customer was
      // looking at their page.
      style={previewing ? { display: "none" } : undefined}
    >
      {nav}
      {/* THE 「Ask AI」 BUTTON IS STILL GONE, and stays gone.
          The founder's objection was 「把这个AI修改放在这里谁会去按啦」 — the
          product's single most valuable feature was a toolbar button that
          opened a panel, so most customers never met it. It spent a while as a
          permanent right-hand column; it now floats at the foot of the canvas
          with its composer already typeable (design-system/editor/ai-dock.tsx).
          What has not changed is the rule: it is never something you have to
          know to press. */}

      {/* THE 「+ 加东西」 BUTTON IS GONE TOO, and for the opposite reason to the
          AI one above. That button was fine; what it opened was the problem --
          a 54-tile column down the side of the canvas, and a block that landed
          at the END of the page wherever you were actually looking.

          Adding is now the ＋ 加一段 that appears in the gap between two blocks
          (design-system/editor/insert-affordance.tsx). It opens the same
          palette, in a sheet, and inserts AT that gap. That is strictly more
          discoverable than a toolbar button: it appears where the customer is
          already pointing, rather than needing to be found first. */}
      <span className="flex-1" />

      {/* Save STATE, not just a save button. A product that only ever shows a
          button leaves the customer with no answer to "did that work" other
          than pressing it again. */}
      <span
        role="status"
        className={`[font-size:var(--text-xs)] ${dirty && !autosaving ? "[color:var(--color-brass-bright)]" : "[color:var(--color-paper-dim)]"}`}
      >
        {saving
          ? t("saving")
          : autosaving
            ? t("autosaving")
            : dirty
              ? t("unsaved")
              : savedAt
                ? // The actual clock time, not "just now" -- which stopped
                  // being true a minute after it was rendered and never
                  // updated, i.e. it asserted something false about the
                  // customer's data for as long as the tab stayed open.
                  t("savedAtTime", { time: formatTime(savedAt, locale) })
                : ""}
      </span>

      {tools}

      <PreviewButton label={t("previewCta")} />

      {overflow}

      <button
        type="button"
        onClick={onOpenHistory}
        className="rounded-md px-2.5 py-1.5 [font-size:var(--text-xs)] transition-colors [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
      >
        {t("historyCta")}
      </button>

      <VersionHistoryDialog
        open={historyOpen}
        onClose={onCloseHistory}
        pageKey={pageKey}
        locale={locale}
        // Recorded on Puck's own history stack, so restoring the wrong version
        // is undone with the same button as everything else.
        onRestored={(layout) =>
          dispatch({ type: "setData", data: layout, recordHistory: true })
        }
      />

      <button
        type="button"
        onClick={history.back}
        disabled={!history.hasPast}
        aria-label={t("undo")}
        title={t("undo")}
        className={iconButton}
      >
        ↺
      </button>
      <button
        type="button"
        onClick={history.forward}
        disabled={!history.hasFuture}
        aria-label={t("redo")}
        title={t("redo")}
        className={iconButton}
      >
        ↻
      </button>
      {publish}
      {finish}

      {/* 🔴 2026-09-05：「保存设计」从顶栏搬进「更多」。
        它跟旁边那颗「确认设计，交给我们建系统」并排，两颗都写着「设计」，
        而 9-05 之后「交给我们建」**自己会先保存** —— 两颗按钮做重叠的事，
        一个装修老板分不出该按哪一颗，而那正好是他上门 demo 的最后一秒。

        拿掉它不会掉东西：第一次保存之后**自动保存接手**（左边那一格会写
        「已保存 15:04」），Ctrl/⌘+S 照旧（就在这个档案上面那支 effect），
        而「更多」里还有一颗写出来的。这是 Google 文件 / Figma / Notion
        的形状 —— 少一个要他决定的东西。 */}
    </div>
  );
}
