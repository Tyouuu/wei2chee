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
  note,
  date,
  monogram,
  axis: axisProp,
  bleed = false,
}: {
  /** 从大到小：分组、页名。空的就不画。 */
  crumbs?: string[]
  /** 今天。**由外面给**，不在这里 `new Date()` —— 一个自己读时钟的组件
   *  在伺服器跟浏览器会算出两个值，而且缩图跟列印每拍一次就换一个日期。 */
  date?: string
  /**
   * 右边那颗圆头像里的一到两个字。
   *
   * 🔴 2026-09-03 组件清单报出来的：**六个参考页每一页的右上角都有一颗圆头像**，
   * 我们六套一个都没有 —— 我们把它画在侧栏底下，而那个位置在 1000px 高的
   * 画面里常常掉到折线以下，等於没有。
   * ⚠️ 它不是一颗按钮：这一条是「你在哪一页」，不是操作。点得下去的头像
   * 在侧栏底下那个，这里只是**认人**。
   */
  monogram?: string
  /**
   * 侧栏在旁边还是在上面。
   *
   * 🔴 **本来是读 context 的，而那个 context 到不了这里**（2026-09-03）：
   * `SystemShell` 只把 `NavAxisProvider` 包在侧栏那一段上，这一条画在它外面，
   * 所以 `useContext` 永远拿到预设的 `"side"`。
   * 后果有两个，两个都静静地存在了很久：顶栏那几套的头像**没有被挡掉**
   * （同一屏两颗），而这一条**永远画自己的下缘线**，就算上面已经有一条顶栏。
   * 一个读不到的 context 跟一个没有写过的判断，在档案里长得一模一样。
   * 现在由外面明讲，context 只当后备。
   */
  axis?: "side" | "top"
  /**
   * 这一条**长在内容的内距里面**，还是**横过整个内容区**。
   *
   * 🔴 2026-09-04 加的，逐字照 arhamkhnz 的 `dashboard/layout.tsx`：
   *   <header className="flex h-12 shrink-0 items-center gap-2 border-b …">
   *     <div className="flex w-full items-center justify-between px-4 lg:px-6">
   * 也就是 **48px 高 · 有下边线 · 横过整个内容区 · 里面自己 24px 内距**，
   * 而内容那一块另外有 `p-6` —— **两层内距，不是一层**。
   *
   * 我们本来只有 `inline` 那一种：面包屑跟内容左右对齐、上下用内距拉开。
   * 那读起来是「内容的第一行」；他们那一条读起来是「这个视窗的横梁」。
   * **换个配色两者还是两个东西**，所以它是一根轴不是一个数值（重点 7c）。
   */
  bleed?: boolean
  /**
   * 一句关於**他这门生意**的话，画在面包屑右边。
   *
   * 🔴 2026-09-04 加的，而它是一次**适应**不是一次复刻（老板：`看看要怎么去
   * 调整适应我们的情况`）。参考页的横梁上是搜索框跟四颗圆钮；我们没有那四件
   * （搜索今天找不到东西，[任务 15](../../docs/founder-tasks.md)），
   * 而我们有他们永远不会有的一件：**两分钟问卷问出来的那一句**
   * （「你的报价到收订金之间拖太久了。」）。
   *
   * 它本来住在总览的页面标题里。总览照参考拿掉标题之后，那一句**没有家了**
   * —— 而它是整个产品唯一一句证明「我们真的听了你讲那两分钟」的话。
   * 一个算出来却到不了画面的值，正是这个仓库犯过十七次的那件事。
   *
   * ⚠️ **只有总览给它**。其余每一页的页面标题底下本来就有自己的说明，
   * 两个都画就是同一屏讲两次。
   */
  note?: string
}) {
  const ctxAxis = useContext(NavAxisContext)
  const axis = axisProp ?? ctxAxis
  const shown = crumbs.filter(Boolean)
  /* 🔴 顶栏那几套不画头像（2026-09-03，放大两倍才看到）。
     `RailNav` 的顶栏**自己右上角就有一颗**，所以中台跟图纸那两页
     **同一屏上有两颗头像**：一颗在顶栏、一颗孤零零挂在面包屑那一行右边。
     它当初是为侧栏那几套加的 —— 那几套的头像画在侧栏最底下，
     在 1000px 高的画面里常常掉到折线以下，等於没有。顶栏那几套没有这个问题。
     Tabler 自己那一页也只有一颗（而且带着名字跟职称）。 */
  const wantsFace = Boolean(monogram) && axis !== "top"
  if (!shown.length && !date && !wantsFace && !note) return null
  /* 满幅那一种：固定 48px 高、自己的左右内距、一条下边线横过整个内容区。
     ⚠️ 侧栏在上面的时候**不给**满幅：那会跟顶栏叠成两条横梁，
     而参考页只有一条。 */
  const wide = bleed && axis !== "top"
  return (
    <div
      className={`flex w-full shrink-0 items-center justify-between [gap:var(--gap-inline)] ${
        wide
          ? "h-12 [padding-inline:var(--pad-card-lg)] [border-bottom:var(--hairline)_solid_var(--border-subtle)]"
          : `[padding-block:var(--pad-control-y)] ${
              /* 侧栏在上面的时候这一条会跟它叠成两条横线，所以那种版式下它靠内距
                 跟页面拉开，不再画自己的下缘线。 */
              axis === "top" ? "" : "[border-bottom:var(--hairline)_solid_var(--border-subtle)]"
            }`
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
      {note ? (
        <span className="hidden min-w-0 flex-1 truncate text-right [color:var(--color-on-canvas-dim)] [font-size:var(--text-xs)] md:block">
          {note}
        </span>
      ) : null}
      <div className="flex shrink-0 items-center [gap:var(--gap-inline)]">
        {date ? (
          <span className="tnum [font-size:var(--text-xs)] [color:var(--color-on-canvas-dim)]">
            {date}
          </span>
        ) : null}
        {/* 🔴 `rounded-full`，不是 `--radius-pill`（2026-09-03）。
            三套风格把「药丸」的圆角设成 0–3px（台账 3 · 瑞士 0 · 招牌 0）——
            那是它们**状态标签**的身份（直角的小标签），而它顺手把头像也弄成了
            圆角方块。尺子报「缺 头像」，而画面上那个字章明明在。
            **一颗头像是一个形状，不是一级圆角** —— 六个参考页里六个都是圆的。
            这跟这个仓库自己写过的那句是同一条：药丸的 999px 不是圆角，是形状。 */}
        {wantsFace ? (
          <span
            aria-hidden
            /* 这两个字是**他自己的名字** —— `check:en` 会把它当成英文页上的中文，
               而它本来就该是中文。跟 console 那两处同一个做法。 */
            data-their-words
            className="grid size-7 shrink-0 place-items-center rounded-full [background:var(--color-primary-soft)] [color:var(--color-primary)] [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)]"
          >
            {monogram?.slice(0, 2)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
