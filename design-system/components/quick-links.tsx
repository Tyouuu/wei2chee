"use client"

import Link from "next/link"
import { useRegisterProp } from "@/design-system/editor/style-scope"
import { railIcon } from "./rail-icons"

/**
 * 快捷入口 —— 一张卡，里面是几个「直接去那一页」。
 *
 * ── 为什么有这一块 ────────────────────────────────────────────────────────
 * 老板 2026-09-03：`你先把人家的组件做进来啊 我没看到多少啊`。
 *
 * 两倍并排看下来，Ant Design Pro 的工作台右边那张「快速开始 / 便捷导航」
 * 是我们**整个库里没有的一种东西**：不是清单（没有内容），不是指标（没有数字），
 * 是一排**通往别处的门**。Zoho 的手机首页、Odoo 的模块格子、
 * Gojek 的圆图标墙，全部是同一件东西的不同画法。
 *
 * ── 它讲的每一句话都是真的 ────────────────────────────────────────────────
 * ⚠️ 每一格都是一个**真的网址**，指向他自己已经有的那一页。
 * 没有网址的格子**不画** —— 这个仓库禁的就是一颗按下去没有反应的按钮
 * （⌘K 那个假搜索框就是因为这个被砍的）。所以这一块不会凭空造出
 * 「发票」「报表」这种他还没有的入口。
 *
 * ⚠️ 它跟侧栏不重复的地方在於**它是挑过的**：侧栏列全部，这里只放
 * 「今天最可能要按的那几个」。Ant 那一张也是这样 —— 侧栏十几项，
 * 快速开始只有六个。
 */
export type QuickLink = {
  label: string
  href: string
  /** `rail-icons` 里的名字。认不得就不画图标，只留字。 */
  iconName?: string
}

export function QuickLinks({
  heading,
  links,
  shape,
}: {
  heading?: string
  links: QuickLink[]
  /**
   * 三种画法，而它们不是同一张图的三种漆：
   * `chips` 一排药丸（Ant 的做法）·
   * `tiles` 方格子，图标在上、字在下（Zoho / Odoo 的模块墙）·
   * `rows`  一行一个，右边一个箭头（Studio Admin 的快捷动作）
   */
  shape?: "chips" | "tiles" | "rows"
}) {
  const pref = useRegisterProp<"chips" | "tiles" | "rows">("QuickLinks", "shape")
  const look = shape ?? pref ?? "chips"
  /* 没有网址的不画。一格通往哪里都不去，就不是一个入口。 */
  const shown = (links ?? []).filter((l) => l?.label && l?.href && l.href !== "#")
  if (!shown.length) return null

  return (
    <section className="flex flex-col [gap:var(--gap-stack)]">
      {heading ? (
        <h3 className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
          {heading}
        </h3>
      ) : null}

      {/* 🔴 方格子的宽度是**固定的**，不是「整条分成四份」（2026-09-03 看图改的）。
          摆在一张整页宽的卡里的时候，`grid-cols-4` 会让四个图标各占三百像素，
          中间空一大片 —— Odoo / Zoho 那道模块墙是**密**的：格子小、靠左排、
          多几个就往右接下去。 */}
      {look === "tiles" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] [gap:var(--gap-inline)]">
          {shown.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              className="flex flex-col items-center gap-1.5 [border-radius:var(--radius-md)] [padding-block:var(--pad-card)] text-center transition-colors [transition-duration:var(--dur-fast)] hover:[background:var(--color-ink-850)]"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center [background:var(--color-ink-850)] [border-radius:var(--radius-sm)] [color:var(--color-paper-dim)]"
              >
                {railIcon(l.iconName, "h-[18px] w-[18px]")}
              </span>
              <span className="min-w-0 truncate [color:var(--color-paper)] [font-size:var(--text-xs)]">
                {l.label}
              </span>
            </Link>
          ))}
        </div>
      ) : look === "rows" ? (
        <div className="flex flex-col">
          {shown.map((l, i) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              className={`flex items-center justify-between [gap:var(--gap-inline)] [padding-block:var(--pad-control-y)] [color:var(--color-paper)] [font-size:var(--text-sm)] transition-colors [transition-duration:var(--dur-fast)] hover:[color:var(--color-primary)] ${
                i > 0 ? "[border-top:var(--hairline)_solid_var(--border-subtle)]" : ""
              }`}
            >
              <span className="flex min-w-0 items-center [gap:var(--gap-inline)]">
                <span aria-hidden className="[color:var(--color-paper-dim)]">
                  {railIcon(l.iconName, "h-[15px] w-[15px]")}
                </span>
                <span className="truncate">{l.label}</span>
              </span>
              {/* 一个「往那边去」的记号。Studio Admin 的每一张卡右上角也是这个。 */}
              <span aria-hidden className="shrink-0 [color:var(--color-paper-dim)]">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M5 11 11 5M6 5h5v5" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap [gap:var(--gap-inline)]">
          {shown.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              className="inline-flex items-center [gap:var(--gap-inline)] [border:var(--hairline)_solid_var(--border-subtle)] [border-radius:var(--radius-control)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] [color:var(--color-paper)] [font-size:var(--text-xs)] transition-colors [transition-duration:var(--dur-fast)] hover:[border-color:var(--color-primary)] hover:[color:var(--color-primary)]"
            >
              <span aria-hidden className="[color:var(--color-paper-dim)]">
                {railIcon(l.iconName, "h-[14px] w-[14px]")}
              </span>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
