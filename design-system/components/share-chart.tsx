"use client"

import { Cell, Pie, PieChart } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

/**
 * 占比 — how the money splits between stages, in three different objects.
 *
 * ── WHY A SECOND CHART COMPONENT ──────────────────────────────────────────
 *
 * TrendChart answers "how much, over time" and offers bar / line / area.
 * Measured across the eighteen registers on 2026-08-25: ten of them chose
 * `bar`. That is not eighteen registers agreeing; it is an axis with three
 * options where two of them (line, area) suit only a handful of briefs, so
 * everything else falls into the third. An axis whose options are not equally
 * usable is an axis with one option.
 *
 * Ant Design Pro's own dashboard carries a donut beside its bar chart -- a
 * different QUESTION (how does the whole split up) needing a different object.
 * Adding it widens the vocabulary rather than redistributing it, which is the
 * only way eighteen designs stop rhyming: the founder's test is 「换个配色它还
 * 是不是另一个设计」, and a ring, a pie and a row of stacked bars answer yes.
 *
 * ── WHY `bars` IS ONE OF THE THREE ────────────────────────────────────────
 *
 * Not every register can hold a circle. 台账 is hairlines and right-angles, 码
 * is a monospace grid, 瑞士 is a printed sheet -- a ring in any of them is a
 * borrowed object. `bars` is the same fact drawn as proportion: one row per
 * stage, a filled track, the figure right. It is also the only one of the
 * three that stays readable at 200px wide, which is where it lands when a
 * register puts it beside something else.
 */

export type ShareSlice = {
  label: string
  value: number
  /** A token reference. The caller picks from the palette's categorical hues so
   *  that a register with no jade still resolves to something in its own set. */
  color: string
}

/* 🔴 三种变成五种（2026-09-02）。
   老板：「你没有帮我去加轴的吗 怪不得你一直复刻不到」。他讲对了，而且量得出来：
   二十根轴里**有十根只有两三种**，而一根只有两种的轴，十五套风格里必然有八套
   共用同一个值 —— 到那时候唯一还能分开它们的就只剩颜色，
   而那正好是他这两天一直在骂的那件事。

   加的两种都是**别人页面上真的有、而我们画不出来**的东西：
   `gauge`  半圆的表 —— TailAdmin 整页就靠这一个物件撑起来
   `stack`  一条堆叠条 —— 一整条就是全部，每一段是一块，Ant Design Pro 用它 */
export type ShareShape = "donut" | "pie" | "bars" | "gauge" | "stack"

export function ShareChart({
  title,
  caption,
  unit = "",
  slices,
  shape,
  frame,
}: {
  title?: string
  caption?: string
  unit?: string
  slices: ShareSlice[]
  /** No default — `undefined` is how the register wins. */
  shape?: ShareShape
  /** Same three frames as TrendChart, for the same reason: 墨 and 瑞士 have no
   *  card to put a chart in. */
  frame?: "card" | "outline" | "bare"
}) {
  const look: ShareShape = shape ?? "donut"
  const rows = (slices ?? []).filter((s) => Number(s.value) > 0)
  if (!rows.length) return null

  const total = rows.reduce((n, s) => n + Number(s.value), 0)
  const fmt = (n: number) => `${unit}${unit ? " " : ""}${n.toLocaleString("en-MY")}`

  // One-letter key for the same collision reason trend-chart.tsx documents:
  // ChartContainer emits `--color-<key>` into the same namespace as the design
  // tokens, so "share" or "value" is one rename away from a silent clash.
  const config = { v: { label: title || "", color: "var(--chart-1)" } } satisfies ChartConfig

  const body =
    look === "stack" ? (
      /* 一条堆叠条。跟 `bars` 的差别不是画法，是**问题不一样**：
         bars 一行一段，问的是「每一段各占多少」；stack 一整条，
         问的是「整个加起来是多少，而它被切成几块」。 */
      <div className="flex flex-1 flex-col [gap:var(--gap-stack)]">
        <div
          className="flex h-[14px] w-full overflow-hidden [border-radius:var(--radius-sm)]"
          style={{ background: "var(--color-ink-800)" }}
        >
          {rows.map((s) => (
            <div
              key={s.label}
              className="h-full"
              style={{ width: `${total ? (s.value / total) * 100 : 0}%`, background: s.color }}
            />
          ))}
        </div>
        <ul className="flex flex-wrap [gap:var(--gap-stack)]">
          {rows.map((s) => (
            <li key={s.label} className="flex items-center [gap:var(--gap-inline)] [font-size:var(--text-xs)]">
              <span
                aria-hidden
                className="h-[9px] w-[9px] flex-none [border-radius:var(--radius-sm)]"
                style={{ background: s.color }}
              />
              <span className="truncate">{s.label}</span>
              <span className="tnum [font-weight:var(--fw-medium)]">{fmt(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : look === "gauge" ? (
      /* 半圆的表。第一段是「已经到手的」，剩下的是槽。
         ⚠️ 它读的是**第一段占全部多少** —— 一个半圆没有第三段的位置，
         硬塞第三段会画出一个没有人读得懂的东西。 */
      <div className="flex flex-1 flex-wrap items-center [gap:var(--gap-stack)]">
        <div className="relative h-[100px] w-[184px] flex-none">
          <svg viewBox="0 0 184 100" className="h-full w-full" aria-hidden="true">
            <path
              d="M 16 92 A 76 76 0 0 1 168 92"
              fill="none"
              stroke="var(--color-ink-800)"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <path
              d="M 16 92 A 76 76 0 0 1 168 92"
              fill="none"
              stroke={rows[0]?.color ?? "var(--color-primary)"}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${238.8 * (total ? (rows[0]?.value ?? 0) / total : 0)} 238.8`}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 text-center">
            <span className="tnum [font-size:var(--text-stat,var(--text-title))] [font-weight:var(--fw-semibold)] [color:var(--color-on-canvas)]">
              {total ? Math.round(((rows[0]?.value ?? 0) / total) * 100) : 0}%
            </span>
          </div>
        </div>
        <ul className="flex min-w-[140px] flex-1 flex-col [gap:calc(var(--gap-inline)*0.6)]">
          {rows.map((s) => (
            <li key={s.label} className="flex items-center [gap:var(--gap-inline)] [font-size:var(--text-xs)]">
              <span
                aria-hidden
                className="h-[9px] w-[9px] flex-none [border-radius:var(--radius-sm)]"
                style={{ background: s.color }}
              />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="tnum flex-none [font-weight:var(--fw-medium)]">{fmt(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : look === "bars" ? (
      <div className="flex flex-col [gap:var(--gap-inline)]">
        {rows.map((s) => {
          const pct = (Number(s.value) / total) * 100
          return (
            <div key={s.label} className="flex flex-col [gap:calc(var(--gap-inline)*0.4)]">
              <div className="flex items-baseline [gap:var(--gap-inline)] [font-size:var(--text-xs)]">
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="tnum flex-none text-[color:var(--color-on-canvas-dim)]">
                  {pct.toFixed(0)}%
                </span>
                <span className="tnum flex-none [font-weight:var(--fw-medium)]">
                  {fmt(Number(s.value))}
                </span>
              </div>
              {/* A track and a fill, not a rounded pill: the registers that ask
                  for `bars` are the ones with no round corners to spend. The
                  radius comes from the token, so a soft register still softens
                  it if it ever picks this shape. */}
              <div
                className="h-[6px] w-full overflow-hidden [border-radius:var(--radius-sm)]"
                style={{ background: "var(--color-ink-800)" }}
              >
                <div
                  className="h-full"
                  style={{ width: `${pct}%`, background: s.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    ) : (
      <div className="flex flex-1 flex-wrap items-center [gap:var(--gap-stack)]">
        <ChartContainer config={config} className="aspect-auto h-[168px] w-[168px] flex-none">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="label" formatter={(v) => fmt(Number(v))} />}
            />
            <Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              // The hole is the whole difference between the two shapes, and it
              // is not decoration: a donut has a middle to put the total in,
              // which is the number an owner actually wants. A pie has to spend
              // a label on it instead.
              innerRadius={look === "donut" ? 46 : 0}
              outerRadius={74}
              paddingAngle={look === "donut" ? 2 : 0}
              strokeWidth={0}
            >
              {rows.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="flex min-w-[140px] flex-1 flex-col [gap:calc(var(--gap-inline)*0.6)]">
          {rows.map((s) => (
            <li
              key={s.label}
              className="flex items-center [gap:var(--gap-inline)] [font-size:var(--text-xs)]"
            >
              <span
                aria-hidden
                className="h-[9px] w-[9px] flex-none [border-radius:var(--radius-sm)]"
                style={{ background: s.color }}
              />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="tnum flex-none [font-weight:var(--fw-medium)]">
                {fmt(Number(s.value))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <section
      className={`flex flex-col [gap:var(--gap-inline)] ${
        frame === "bare"
          ? ""
          : frame === "outline"
            ? "[background:var(--card)] [border:var(--border-card-width)_solid_var(--border)] [border-radius:var(--radius)] [padding:var(--pad-card)]"
            : "[background:var(--card)] [border:var(--border-card-width)_solid_var(--border-subtle)] [border-radius:var(--radius)] [padding:var(--pad-card)] [box-shadow:var(--shadow-card)]"
      }`}
    >
      {title ? (
        <header className="flex flex-col [gap:var(--gap-tight,4px)]">
          <h3 className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {title}
          </h3>
          {caption ? (
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">{caption}</p>
          ) : null}
        </header>
      ) : null}
      {body}
    </section>
  )
}
