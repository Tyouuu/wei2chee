"use client"

import { useContext } from "react"
import { NavAxisContext } from "./nav-axis"

/**
 * 顶栏 —— 页面上方那一条细的。
 *
 * ── 为什么这一条在（2026-09-02）────────────────────────────────────────────
 * 老板：「复刻不到他们的设计吗 就是全部复刻」。把我们的一页跟 Studio Admin
 * 并排放到原尺寸，剩下最大的一个结构差就是这个：**他们有一条顶栏，我们的页面
 * 从画布最上缘直接开始**。二十八个实拍的后台里，二十八个都有。
 *
 * Tabler、shadcn-admin、Ant Design Pro、TailAdmin 也都有，而且都是同一个形状：
 * 一条 40–48px 的细条，左边讲「你在哪」，右边放几样常用的。
 *
 * ── 里面放什么，跟为什么不放搜索框 ────────────────────────────────────────
 * Studio Admin 那条的主角是一个搜索框。**我们不放**，理由不是做不到，是
 * [任务 15](../../docs/founder-tasks.md)：这个仓库砍掉过一个 ⌘K，砍的理由是
 * 它搜不到东西。一个搜不到东西的框放在每一页最上面，是把那个错误放大十二倍。
 * （表格自己那个框是真的会筛的，那是另一回事。）
 *
 * 所以这一条只放**两样都是真的**的东西：
 *   左 —— 面包屑：这一页属於哪一组、叫什么。客户系统的侧栏是分组的
 *         （日常 / 工作 / 对外），而在这之前**没有任何地方讲过你在哪一组**。
 *   右 —— 今天的日期。一个每天在开单、收钱、排工的人，日期不是装饰。
 *
 * ── 它是一个 slot，不是画死的 ──────────────────────────────────────────────
 * 页面框架不知道这一页叫什么 —— 那是 `buildPageLayout` 才知道的事。
 * 所以框架开一个格子，产生器往里面放这一块；没有放的风格，那个格子是空的，
 * 空的 slot 什么都不画，其余几套一个像素都不会动。
 */
export function SystemBar({
  crumbs = [],
  date,
}: {
  /** 从大到小：分组、页名。空的就不画。 */
  crumbs?: string[]
  /** 今天。**由外面给**，不在这里 `new Date()` —— 一个自己读时钟的组件
   *  在伺服器跟浏览器会算出两个值，而且缩图跟列印每拍一次就换一个日期。 */
  date?: string
}) {
  const axis = useContext(NavAxisContext)
  const shown = crumbs.filter(Boolean)
  if (!shown.length && !date) return null
  return (
    <div
      className={`flex w-full shrink-0 items-center justify-between [gap:var(--gap-inline)] [padding-block:var(--pad-control-y)] ${
        /* 侧栏在上面的时候这一条会跟它叠成两条横线，所以那种版式下它靠内距
           跟页面拉开，不再画自己的下缘线。 */
        axis === "top" ? "" : "[border-bottom:var(--hairline)_solid_var(--border-subtle)]"
      }`}
    >
      <nav
        aria-label="breadcrumb"
        className="flex min-w-0 items-center gap-1.5 [font-size:var(--text-xs)] [color:var(--color-on-canvas-dim)]"
      >
        {shown.map((c, i) => (
          <span key={`${c}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 ? (
              <span aria-hidden="true" className="opacity-50">
                /
              </span>
            ) : null}
            <span
              className={
                i === shown.length - 1
                  ? "truncate [color:var(--color-on-canvas)] [font-weight:var(--fw-medium)]"
                  : "truncate"
              }
            >
              {c}
            </span>
          </span>
        ))}
      </nav>
      {date ? (
        <span className="tnum shrink-0 [font-size:var(--text-xs)] [color:var(--color-on-canvas-dim)]">
          {date}
        </span>
      ) : null}
    </div>
  )
}
