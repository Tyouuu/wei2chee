"use client";

import { useEffect } from "react";
import { usePuck } from "@puckeditor/core";

/**
 * Keeps the rail IN THE CANVAS honest about a rename that happened outside it.
 *
 * ── THE PROBLEM, EXACTLY ──────────────────────────────────────────────────
 *
 * 页面 writes to `project_pages`, which is where every rail in the product gets
 * its words: the portal's own sidebar, the page cards on the home screen, the
 * specification, and the customer's generated rail. All of those are server
 * components and `router.refresh()` fixes them.
 *
 * The canvas is not one of them. Puck reads `data` exactly once, in a lazy
 * `useState` initialiser inside its provider (verified against the installed
 * 0.23.0 bundle — see the note on `key` in editor-client.tsx), so a refreshed
 * server render never reaches it. Renaming 报价单 and watching the rail keep
 * saying Quotations reads as a control that did not work.
 *
 * Remounting Puck would fix it and would also throw away anything the customer
 * had typed since their last save, which is a much worse trade than a stale
 * word.
 *
 * ── WHY AN EVENT AND NOT A PROP ───────────────────────────────────────────
 *
 * The sheet that renames is mounted OUTSIDE Puck's provider (it has to be — it
 * is chrome, not canvas), so it cannot dispatch. This component is inside, and
 * a window event is the smallest thing that crosses that boundary without
 * either side importing the other. It carries the whole list rather than one
 * key, so a reorder and a rename are the same message.
 */

export const RAIL_SYNC_EVENT = "formae:pages-changed";

export type RailSyncDetail = { pages: { key: string; label: string }[] };

/** Fired by the chrome; heard by the canvas. */
export function announcePages(pages: { key: string; label: string }[]) {
  window.dispatchEvent(
    new CustomEvent<RailSyncDetail>(RAIL_SYNC_EVENT, { detail: { pages } }),
  );
}

export function RailSync() {
  const { appState, dispatch } = usePuck();

  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<RailSyncDetail>).detail;
      if (!detail?.pages?.length) return;
      const label = new Map(detail.pages.map((p) => [p.key, p.label]));
      const order = new Map(detail.pages.map((p, i) => [p.key, i]));

      // Walk every slot: the rail lives inside SystemShell's `sidebar`, and
      // hunting for it by a hard-coded id is how this breaks the first time a
      // page is built with a different one.
      let touched = false;
      const walk = (nodes: unknown[]): unknown[] =>
        nodes.map((n) => {
          const node = n as { type?: string; props?: Record<string, unknown> };
          if (!node?.props) return n;
          const props: Record<string, unknown> = { ...node.props };

          if (node.type === "RailNav" && Array.isArray(props.items)) {
            const items = (props.items as { href?: string; label?: string }[]).map((it) => {
              // The href's last segment is the page key -- the same match
              // rail-nav.tsx itself uses to decide which item is current.
              const key = String(it.href ?? "").split("/").filter(Boolean).pop() ?? "";
              const next = label.get(key);
              return next && next !== it.label ? { ...it, label: next } : it;
            });
            const sorted = [...items].sort(
              (a, b) =>
                (order.get(String(a.href ?? "").split("/").filter(Boolean).pop() ?? "") ??
                  Number.MAX_SAFE_INTEGER) -
                (order.get(String(b.href ?? "").split("/").filter(Boolean).pop() ?? "") ??
                  Number.MAX_SAFE_INTEGER),
            );
            if (JSON.stringify(sorted) !== JSON.stringify(props.items)) {
              props.items = sorted;
              touched = true;
            }
          }

          for (const [k, v] of Object.entries(props)) {
            if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "type" in x)) {
              props[k] = walk(v as unknown[]);
            }
          }
          return { ...node, props };
        });

      const content = walk(appState.data.content as unknown[]);
      if (!touched) return;
      dispatch({
        type: "setData",
        data: { ...appState.data, content: content as typeof appState.data.content },
      });
    }

    window.addEventListener(RAIL_SYNC_EVENT, onChanged);
    return () => window.removeEventListener(RAIL_SYNC_EVENT, onChanged);
  }, [appState.data, dispatch]);

  return null;
}
