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
        {/* 🔴 14px → 20px，2026-09-01。
            `check:consistency` 量出来：十一页里有六页**整页最大的字就是 14px**，
            而首页是 56px。一个工作台从头到尾只有 14–18px，不是「干净」，
            是**没有层次** —— 眼睛没有地方落下。
            老板：`我要更有设计感 一点 不是单纯的好坏 我要的是提升`。
            20px 是这一层唯一动的东西：它不抢客户预览的颜色，只把「你在哪一页」
            这句话讲清楚。 */}
        <h1 className="truncate [font-size:var(--text-lg)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)] [letter-spacing:-0.01em]">
          {title}
        </h1>
        {/* 🔴 副标不再 `truncate`（2026-09-07，老板报的）。
            它是一句**话**，不是一个名字 —— 切在句子中间的一句话，
            读起来不是「太长」，是「坏了」，而且它永远不会变成读得懂的。
            标题照旧 truncate：那是一个名字，切了还认得出来。

            ⚠️ 代价写出来：在 390 上一句长的说明会让这条吸顶的横梁高一到两行。
            那是对的那一边 —— 他读一次就往下滚，而一句读不完的话，
            他每一次打开都读不完。 */}
        {subtitle && (
          <p className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
            {subtitle}
          </p>
        )}
      </div>
      {/* 🔴 `shrink-0` 拿掉，换成会换行。
          2026-09-01：规格书那一页的顶栏放了三个控件（回编辑器 · 列印 · 交接），
          在 390px 上 `shrink-0` 让它们不肯缩也不肯换行 ——
          **整页横滚 20px**，而这一页本来是没有横滚的。
          `check:consistency` 当场抓到，那是我自己造的回归。
          外层本来就有 `flex-wrap`，这里跟着换行就好；
          其余八个 surface 只会从「挤爆」变成「换一行」，不会更差。 */}
      {children && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
