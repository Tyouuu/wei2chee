"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A drop-down for the editor's one bar.
 *
 * WHY THIS EXISTS. The bar was measured at FIFTEEN controls in 50px:
 * ← 我的系统 · 总览 · 客户 · 收款 · 报价单 · 项目 · 系统需求书 · 风格 · 中文 · EN ·
 * 登出 · 历史 · ↺ · ↻ · 保存设计. Durable's equivalent bar carries about seven,
 * most of them icons, and its page switcher is a single 「Page: Home ▾」. Fifteen
 * pieces of Chinese text at 13px is not a toolbar a shop owner scans, it is a
 * list they have to read — and it is most of what still made this screen feel
 * unlike the reference.
 *
 * BUILT ON <details>, not on a popover library or a useState + document
 * listener. The element already gives keyboard support, Escape-to-close and
 * correct focus semantics for free, and it cannot get stuck open in a React
 * tree that Puck re-renders on every canvas change — which a boolean in state
 * demonstrably can, since Puck re-creates the whole `header` override function
 * each time (the same hazard that moved the version dialog's state up to
 * editor-client).
 */
export function BarMenu({
  label,
  align = "start",
  children,
}: {
  label: ReactNode;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement | null>(null);

  // Click-away and Escape. <details> handles neither on its own: without this a
  // menu opened by accident stays open behind whatever the customer does next.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && ref.current?.open) ref.current.open = false;
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 py-1.5 [color:var(--color-paper-dim)] marker:hidden hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        // Safari still paints the disclosure triangle without this.
        style={{ listStyle: "none" }}
      >
        {label}
        <span aria-hidden className="[font-size:9px] opacity-70">
          ▾
        </span>
      </summary>
      <div
        className={`absolute z-50 mt-1.5 min-w-[176px] overflow-hidden rounded-[var(--radius-lg)] border py-1 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] ${
          align === "end" ? "right-0" : "left-0"
        }`}
        style={{ boxShadow: "var(--shadow-overlay, 0 14px 34px rgba(6,14,26,.5))" }}
        // Any press inside is a choice; close so the customer sees the result
        // rather than the menu they just used.
        onClick={() => {
          if (ref.current) ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}

/** One row in a BarMenu. Shared so every entry has the same height and hover,
 *  whether it is a <Link>, a <button> or a locale switcher. */
export const barMenuItem =
  "flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left [font-size:var(--text-sm)] [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]";
