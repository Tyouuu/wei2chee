import type { ReactNode } from "react";

/**
 * The bar at the top of every screen inside the shell.
 *
 * WHY IT EXISTS SEPARATELY FROM THE RAIL. The rail answers "where can I go";
 * this answers "where am I, and what can I do here". Splitting them is what
 * lets each screen carry its own actions without every screen inventing its own
 * header — the thing that made the old home page own the product's only
 * navigation.
 *
 * `sticky` because these screens scroll and the actions on the right (save,
 * hand off, browse) should not scroll away from the content they act on.
 */
export function PageBar({
  title,
  subtitle,
  children,
}: {
  title: string;
  /** 一句话说明。⚠️ 收 ReactNode 不是 string —— 有些页面的副标要**在浏览器里
   *  定住一个数字**（询价那一页的「几封新的」，见 inbox-count.tsx），
   *  而那只能是一个 client 组件。 */
  subtitle?: ReactNode;
  /** Actions, right-aligned. */
  children?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b px-8 py-3 [background-color:color-mix(in_srgb,var(--color-canvas)_88%,transparent)] [backdrop-filter:blur(8px)] [border-color:var(--color-ink-800)]">
      <div className="min-w-0">
        <h1 className="truncate [font-size:var(--text-sm)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
