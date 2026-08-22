"use client";

import { useEffect, useRef } from "react";
import {
  registerOverlayPortal,
  usePuck,
  type ComponentData,
} from "@puckeditor/core";
import { usePreviewMode } from "@/design-system/editor/preview-toggle";

/**
 * Type on the page instead of in a panel.
 *
 * Every `<Inline>` in puck-config leaves a `[data-inline-field]` span in the
 * canvas. This component — rendered once, inside the editor, inside Puck's
 * provider — turns those spans into editable text and writes what is typed back
 * into the block's props.
 *
 * Five steps become two. The founder's own count of the old way was 「选中 →
 * 改文字 → 面板 → 在面板里找到那一格 → 打字」, against Durable's press-the-words-
 * and-type.
 *
 * ── THE FOUR THINGS THAT MAKE THIS HARD ───────────────────────────────────
 *
 * 1. CHINESE INPUT. The one that does not exist in the product being copied, so
 *    there was nothing to copy. Typing 中文 goes through an IME: the span holds
 *    half-composed pinyin and an open candidate list for as long as the
 *    customer is choosing characters. Read the DOM during that window and what
 *    lands in the database is 「zhon」. So nothing is ever committed while
 *    `composing` is true, and Enter and Escape are passed through untouched
 *    during composition — there they mean "accept this candidate" and "cancel
 *    it", and stealing them would make the editor unusable in Chinese while
 *    looking perfect in English.
 *
 * 2. PUCK TURNS POINTER EVENTS OFF INSIDE A BLOCK. That is what makes a whole
 *    block one draggable target: everything inside `[data-puck-component]` gets
 *    `pointer-events: none` in edit mode, and only elements carrying
 *    `data-puck-overlay-portal` get them back. An unregistered span is not
 *    merely un-clickable, it is not even the event's target — the click lands
 *    on the block and `closest()` finds nothing. Measured on the first browser
 *    check: 4 markers on the page, 0 of them enterable. So every marker is
 *    registered through Puck's own `registerOverlayPortal` up front, and again
 *    after any render that replaced it.
 *
 * 3. THE CLICK THAT STARTS THE EDIT ALSO CHANGES THE SELECTION, and Puck
 *    re-renders the canvas for that — which throws away the very node the caret
 *    was just put in. Second browser check: the span went editable and was gone
 *    before anything could be typed into it. So the edit is tracked as
 *    {id, field}, never as an element, and re-attached to whatever node
 *    currently answers to that pair. Text typed so far is carried across by
 *    hand, because the re-rendered node comes back holding the OLD prop value —
 *    nothing has been committed yet.
 *
 * 4. NOT EVERY STRING IS TEXT. 「RM 71,300」 is a computed figure, the table rows
 *    are data, the trend is an array of numbers, and a RecordTable's caption is
 *    its accessible name rather than anything on screen. Only what puck-config
 *    explicitly wraps in `<Inline>` is editable, which is why the marker is
 *    opt-in per field: a customer who can click every string on the page and
 *    finds half of them refuse is worse off than one who can click four and has
 *    all four work.
 *
 * COMMIT ON BLUR, NEVER ON KEYSTROKE. A dispatch re-renders the block, which
 * replaces the node the caret is in. Per-keystroke would drop the caret to the
 * start of the line on every letter. Blur — and Enter, which blurs — is also
 * what puts exactly one entry on Puck's undo stack per edit, so 撤销 takes back
 * a sentence rather than a letter.
 */

/** Puck's own constant for the top-level zone, from `rootAreaId:rootZone` in
 *  0.23.0's bundle. Not exported by the package. */
const ROOT_ZONE = "root:default-zone";

type Edit = {
  id: string;
  field: string;
  original: string;
  text: string;
  /** Still waiting to have the whole value selected. Stays true across the
   *  re-render the opening click causes -- the first attach lands on a node
   *  React is about to throw away, so consuming this there would leave the
   *  caret sitting at the end of an unselected heading (measured: typing "ABC"
   *  on 「业务总览」 produced 「业务总览ABC」 rather than 「ABC」). The customer's
   *  first keystroke is what actually retires it. */
  selectAll: boolean;
};

export function InlineEditing() {
  const { appState, dispatch } = usePuck();
  // Preview means nothing of Formae's on the screen, and a dotted underline
  // under every heading is very much ours. It also has to actually stop
  // working, not just stop showing: someone judging their finished system
  // should not be able to put a caret in it by accident.
  const { previewing } = usePreviewMode();
  const enabled = !previewing;

  // Read through refs so the listeners can be bound once and still see the
  // current tree. Rebinding them on every appState change would tear down the
  // in-flight edit's own listeners mid-word.
  const stateRef = useRef(appState);
  stateRef.current = appState;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const edit = useRef<Edit | null>(null);
  const composing = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    /**
     * Where a block actually lives, by id.
     *
     * A generated system is not a flat list: 页面标题, 重点数字卡 and the rest sit
     * in SLOTS inside 系统外壳, so `data.content` holds one entry -- the shell --
     * and searching it by id finds nothing for any block a customer can see.
     * Third browser check: the click and the typing both worked and the commit
     * silently put the old words back, because the id was not in `content`.
     *
     * The selection is not a usable fallback either, and for a reason worth
     * writing down: Puck selects a block from a click handler on ITS OWN
     * overlay, and the whole point of registering these spans as overlay
     * portals is that the click lands on the span instead. So an inline edit
     * never selects anything, and `ui.itemSelector` still points at whatever
     * was selected before -- which would write this heading onto a different
     * block.
     *
     * So the tree is walked. A slot is a prop whose value is an array of
     * component data, and its zone is `parentId:propName`, which is Puck's own
     * `zoneCompound` convention (verified against 0.23.0's resolver, which
     * dispatches `replace` against exactly that string).
     */
    const locate = (
      id: string,
    ): { index: number; zone: string; item: ComponentData } | null => {
      const isComponentList = (v: unknown): v is ComponentData[] =>
        Array.isArray(v) &&
        v.length > 0 &&
        typeof v[0] === "object" &&
        v[0] !== null &&
        "type" in v[0] &&
        "props" in v[0];

      const walk = (
        items: ComponentData[],
        zone: string,
      ): { index: number; zone: string; item: ComponentData } | null => {
        for (let i = 0; i < items.length; i++) {
          const entry = items[i];
          if (entry.props?.id === id) return { index: i, zone, item: entry };
          const parentId = entry.props?.id;
          if (typeof parentId !== "string") continue;
          for (const [key, value] of Object.entries(entry.props ?? {})) {
            if (!isComponentList(value)) continue;
            const hit = walk(value, `${parentId}:${key}`);
            if (hit) return hit;
          }
        }
        return null;
      };

      return walk(stateRef.current.data.content ?? [], ROOT_ZONE);
    };

    const nodeFor = (e: Edit) =>
      document.querySelector<HTMLElement>(
        `[data-inline-id="${CSS.escape(e.id)}"][data-inline-field="${CSS.escape(e.field)}"]`,
      );

    /** Put the caret in whichever node currently represents the edit. */
    const attach = () => {
      const e = edit.current;
      if (!e) return;
      const el = nodeFor(e);
      if (!el || el.getAttribute("contenteditable")) return;

      // The re-rendered node carries the old prop value; nothing is committed
      // until blur, so anything already typed has to be carried over by hand.
      if (el.textContent !== e.text) el.textContent = e.text;
      el.setAttribute("contenteditable", "plaintext-only");
      el.focus();

      const range = document.createRange();
      range.selectNodeContents(el);
      // The whole value while nothing has been typed yet -- the common edit is
      // "replace this", not "fix a letter in the middle of this" -- and the end
      // of it once the customer is mid-word.
      if (!e.selectAll) range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };

    const detach = () => {
      document
        .querySelectorAll<HTMLElement>("[data-inline-field][contenteditable]")
        .forEach((el) => el.removeAttribute("contenteditable"));
    };

    const commit = () => {
      const e = edit.current;
      if (!e) return;
      const el = nodeFor(e);
      // Read the DOM one last time -- `text` is kept current by the input
      // handler, but a paste or an IME commit can land between the last input
      // event and the blur.
      const live =
        el && !composing.current ? (el.textContent ?? e.text) : e.text;
      edit.current = null;
      composing.current = false;
      detach();

      // textContent, not innerText: a paste can bring markup in and only the
      // words are ever wanted. Whitespace is collapsed because every field this
      // is used on is a single-line text field in puck-config.
      const text = live.replace(/\s+/g, " ").trim();
      if (!text || text === e.original) {
        // Empty is not an edit, it is a customer who selected everything and
        // pressed delete. Put the words back rather than shipping a blank
        // heading they then cannot click on to fix.
        if (el && el.textContent !== e.original) el.textContent = e.original;
        return;
      }

      const found = locate(e.id);
      if (!found) {
        if (el) el.textContent = e.original;
        return;
      }
      const { item, ...selector } = found;

      dispatchRef.current({
        type: "replace",
        destinationIndex: selector.index,
        destinationZone: selector.zone,
        data: { ...item, props: { ...item.props, [e.field]: text } },
      });
    };

    const cancel = () => {
      const e = edit.current;
      if (!e) return;
      const el = nodeFor(e);
      edit.current = null;
      composing.current = false;
      detach();
      if (el) el.textContent = e.original;
    };

    // Every marker has to be a Puck overlay portal BEFORE it is clicked, or the
    // click never reaches it (see 2 above). Puck re-creates these nodes on
    // every canvas render, so this runs again whenever the subtree changes;
    // `data-inline-ready` keeps it to one registration per node. The same sweep
    // re-attaches an edit whose node was just replaced (see 3).
    const sweep = () => {
      document
        .querySelectorAll<HTMLElement>("[data-inline-field]")
        .forEach((el) => {
          if (el.dataset.inlineReady) return;
          registerOverlayPortal(el);
          el.dataset.inlineReady = "1";
        });
      if (edit.current) attach();
    };

    const onClick = (e: MouseEvent) => {
      const hit = (e.target as HTMLElement | null)?.closest?.(
        "[data-inline-field]",
      );
      if (hit instanceof HTMLElement) {
        const id = hit.getAttribute("data-inline-id");
        const field = hit.getAttribute("data-inline-field");
        if (!id || !field) return;
        if (edit.current?.id === id && edit.current.field === field) return;
        commit();
        const original = (hit.textContent ?? "").trim();
        edit.current = { id, field, original, text: original, selectAll: true };
        // Select it as well. Puck cannot do this itself here -- its own click
        // handler lives on the overlay these spans deliberately punch through
        // -- and without it, typing on a heading would leave the toolbar and
        // the assistant pointing at whatever was selected before.
        const where = locate(id);
        if (where) {
          dispatchRef.current({
            type: "setUi",
            ui: { itemSelector: { index: where.index, zone: where.zone } },
          });
        }
        // After Puck has finished re-rendering for the selection this same
        // click causes. Attaching immediately would put the caret in a node
        // that is about to be thrown away.
        requestAnimationFrame(attach);
        return;
      }
      if (edit.current) commit();
    };

    const onInput = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!edit.current || !el?.hasAttribute?.("data-inline-field")) return;
      if (composing.current) return;
      edit.current.selectAll = false;
      edit.current.text = el.textContent ?? "";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!edit.current) return;
      // During composition these keys belong to the IME's candidate list.
      // `e.isComposing` covers browsers that fire keydown before
      // compositionend; the ref covers the rest.
      if (composing.current || e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!edit.current || !el?.hasAttribute?.("data-inline-field")) return;
      // A node that left the document was replaced by a render, not blurred by
      // the customer -- the sweep re-attaches. Committing here would end the
      // edit every time Puck re-rendered for an unrelated reason.
      if (!document.contains(el)) return;
      commit();
    };

    const onCompositionStart = () => {
      composing.current = true;
    };
    const onCompositionEnd = (e: CompositionEvent) => {
      composing.current = false;
      const el = e.target as HTMLElement | null;
      if (edit.current && el?.hasAttribute?.("data-inline-field")) {
        edit.current.selectAll = false;
        edit.current.text = el.textContent ?? edit.current.text;
      }
    };

    sweep();
    const mo = new MutationObserver(sweep);
    mo.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("compositionstart", onCompositionStart, true);
    document.addEventListener("compositionend", onCompositionEnd, true);
    return () => {
      mo.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener(
        "compositionstart",
        onCompositionStart,
        true,
      );
      document.removeEventListener("compositionend", onCompositionEnd, true);
      detach();
    };
  }, [enabled]);

  // Turns on the hover treatment in puck-theme.css. Nothing else renders.
  useEffect(() => {
    const root = document.querySelector(".portal-editor-scope");
    if (!root) return;
    if (enabled) root.setAttribute("data-inline-on", "");
    else root.removeAttribute("data-inline-on");
    return () => root.removeAttribute("data-inline-on");
  }, [enabled]);

  return null;
}
