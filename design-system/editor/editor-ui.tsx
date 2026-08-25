"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * THE ONE PIECE OF STATE THAT MAKES THE EDITOR LOOK LIKE DURABLE.
 *
 * The founder sent four screenshots of Durable and said 「我还是觉得durable的
 * 好看更简单操作一点 你可以改吗 就是别人用得好的东西 我们就要去抄啊」. Counting
 * what was actually on screen in each product explains the difference better
 * than any adjective: Durable, at rest, shows ONE bar. This editor showed six
 * things — a nav row, a style row, a draft banner, a toolbar, a 58px icon rail
 * and a permanent 400px properties column — and the customer's own system came
 * sixth.
 *
 * Durable's answer is not a nicer panel. It is that nothing is docked. You
 * click a block and a small toolbar appears under it; press one of its buttons
 * and a sheet floats over the canvas; press escape and the screen is the
 * customer's system again. Every panel is a guest.
 *
 * So the panels become sheets, and a sheet needs exactly two things shared
 * across parts of the tree that cannot see each other: WHICH sheet is open,
 * and WHERE to render it. Puck's overrides (`actionBar`, `fields`, `drawer`)
 * render deep inside Puck's own layout in three different places; the sheet has
 * to appear above all of them. This context is how the button in one override
 * opens the panel rendered by another.
 *
 * WHY A PORTAL HOST RATHER THAN document.body. The editor's chrome is scoped to
 * Ledger by a CSS-module class on a wrapper (see editor-client.tsx) because
 * ledger.css cannot be imported at :root without colliding with the marketing
 * site's own --color-* names. A sheet portalled to document.body would land
 * outside that scope and render in the marketing palette — every token it reads
 * would resolve to the wrong value. The host is a div INSIDE the scoped
 * wrapper, so the cascade still reaches it.
 */

export type Sheet =
  /** One block, two tabs. Was two sheets -- 换款式 and 改文字 -- anchored to the
   *  same block with a title bar each; see editor-sheets.tsx for why they
   *  merged and why the two toolbar buttons did not. */
  | { kind: "block"; tab: "content" | "design" }
  /** The whole page's register — 风格. Opened from the top bar, not from a
   *  block, so it has no anchor and docks like the others. */
  | { kind: "style" }
  /** 页面 — rename and reorder. A decision about the whole system rather
   *  than about the block under the cursor, so it docks like 风格 does. */
  | { kind: "pages" }
  /** Opened from the ＋ affordance between two blocks, so it carries where the
   *  new block should land rather than appending to the end like the toolbar's
   *  drawer did. */
  | { kind: "insert"; zone: string; index: number }
  | null;

/**
 * How wide a sheet is, and how much room the canvas gives up for it.
 *
 * ONE WIDTH FOR EVERY SHEET, on purpose. They used to be 470 (换款式) and 420
 * (改文字), which meant the panel jumped sideways every time the customer
 * switched between the two buttons on the same block.
 *
 * The gutter is the width plus the two margins around it. The canvas takes it
 * as padding while a sheet is open, so the block being edited reflows into the
 * room that is left instead of sitting underneath the panel that edits it.
 */
export const SHEET_WIDTH = 440;
export const SHEET_GUTTER = SHEET_WIDTH + 32;

/**
 * Is the window wide enough to give up 472px and still show a system?
 *
 * Below this the sheet keeps its old centred placement and the canvas keeps
 * all of its width — a 1100px window minus the gutter leaves 628px, which is
 * under what a five-column record table renders without clipping, so docking
 * there would trade one covered block for a broken one.
 *
 * `useSyncExternalStore` rather than useState+useEffect for the same reason
 * editor-client's `narrow` uses it: the server has no viewport, so it answers
 * false and the client's first render agrees.
 */
const DOCKABLE = "(min-width: 1180px)";
const subscribeDockable = (onChange: () => void) => {
  const mq = window.matchMedia(DOCKABLE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

export function useDockable() {
  return useSyncExternalStore(
    subscribeDockable,
    () => window.matchMedia(DOCKABLE).matches,
    () => false,
  );
}

type EditorUi = {
  /** The assistant's manual open/close, or null to follow the selection.
   *  Held here rather than inside AiDock, which Puck remounts -- see the
   *  measurement beside the useState below. */
  dockOpen: boolean | null;
  setDockOpen: (v: boolean | null) => void;
  sheet: Sheet;
  openSheet: (s: NonNullable<Sheet>, anchor?: HTMLElement | null) => void;
  closeSheet: () => void;
  /** Set by editor-client once its scoped wrapper has mounted. Null on the
   *  first render, which is why every consumer must handle it. */
  host: HTMLElement | null;
  setHost: (el: HTMLElement | null) => void;
  /** What the open sheet should sit under.
   *
   *  Whoever opens the sheet passes its own element rather than the sheet
   *  going looking for the selected block: Puck renders the `actionBar`
   *  override inside an overlay it has already positioned over that block, and
   *  the ＋ affordance sits in the gap it would insert into, so in both cases
   *  the button IS the right anchor. Querying `[data-puck-component]` by id
   *  would re-derive, less reliably, a position the DOM already holds. */
  anchor: HTMLElement | null;
  /** Pixels the canvas should hold clear on its right while a sheet is open.
   *  0 when nothing is open, or when the window is too narrow to spare it. */
  gutter: number;
};

const Ctx = createContext<EditorUi | null>(null);

export function EditorUiProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // THE ASSISTANT'S OPEN STATE LIVES HERE, NOT INSIDE AiDock.
  //
  // It was a useState in AiDock, which sits inside Puck's `preview` override --
  // a subtree React remounts whenever editor-client re-renders, because the
  // `overrides` object literal gives it new function identities. Measured on
  // 2026-08-23: one keystroke in 用讲的改 reset it to null, the dock collapsed
  // to 0x0, focus went to <body>, and the next keystroke went nowhere. This
  // provider is mounted above <Puck> and survives.
  const [dockOpen, setDockOpen] = useState<boolean | null>(null);

  const dockable = useDockable();

  const openSheet = useCallback(
    (s: NonNullable<Sheet>, el?: HTMLElement | null) => {
      setAnchor(el ?? null);
      setSheet(s);
    },
    [],
  );
  const closeSheet = useCallback(() => setSheet(null), []);

  // EVERY SHEET DOCKS, 加一段 INCLUDED.
  //
  // It used to be the one exception, on the argument that a gallery of blocks
  // to add has nothing underneath it worth watching. That argument was about
  // the customer's PAGE and forgot the editor's own furniture: floating, the
  // palette landed on top of the selected block's toolbar AND the AI dock, so
  // pressing ＋ put three dark panels on the screen at overlapping depths. The
  // founder's word for the screenshot was 「整体很乱」, and he is right — Durable
  // never has two panels open over each other.
  //
  // Docked, there is exactly one panel, always at the same edge, and the page
  // reflows beside it like it does for 换款式 and 改文字.
  const gutter = dockable && sheet ? SHEET_GUTTER : 0;

  const value = useMemo(
    () => ({ sheet, openSheet, closeSheet, host, setHost, anchor, gutter, dockOpen, setDockOpen }),
    [sheet, openSheet, closeSheet, host, anchor, gutter, dockOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Where every sheet is portalled to.
 *
 * Rendered by editor-client inside its own scoped chrome wrapper and left
 * empty; the sheets fill it. `position: fixed` children do not care that this
 * div has no size, but they DO care which ancestor they inherit custom
 * properties from — see the class comment above for why document.body is the
 * wrong answer.
 */
export function SheetHost() {
  const { setHost } = useEditorUi();
  return <div ref={setHost} />;
}

/**
 * Returns a no-op shape rather than throwing when there is no provider.
 *
 * mobile-editor.tsx renders AiAssistant outside this provider, and Puck
 * re-creates every override render function on each editor render — a hook that
 * threw here would turn an ordering detail into a blank screen. Nothing that
 * calls this needs the sheet to exist; they need to know whether it does.
 */
export function useEditorUi(): EditorUi {
  return (
    useContext(Ctx) ?? {
      dockOpen: null,
      setDockOpen: () => {},
      sheet: null,
      openSheet: () => {},
      closeSheet: () => {},
      host: null,
      setHost: () => {},
      anchor: null,
      gutter: 0,
    }
  );
}
