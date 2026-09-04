"use client"

import { useEffect, useRef, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useSystemWords } from "@/design-system/system-lang-context"

/* 🔴 第四种：`sum`（2026-09-02）。
   老板：「你不是有很多模版吗 做的好看一点啊 你还记得我们之前的做法吗
   就是复刻了 改成那种可以给客户编辑的代码」。

   这一种就是那个做法：Studio Admin 的 Qualified Lead Flow 那一格，
   图在左、**结论在右** —— 一个大数字、一句话、再一张小卡装一条进度。
   我们本来的图表卡只有图，读的人要自己从柱子里读出结论。
   他指着那一页说「真的很喜欢」，指的多半就是这一格。

   ⚠️ 右边那三样**全部是从同一份点算出来的**，一个都不是新资料：
   总和 · 期数 · 最后一期占总和多少。编不出一个「目标」来配那条进度条 ——
   一条没有人维护的目标线，就是[任务 40](../../docs/founder-tasks.md) 砍掉的
   那个百分比换一个位置回来。 */
export type TrendKind = "bar" | "line" | "area" | "sum"

export type TrendPoint = {
  /** The period in the owner's own words — "1月", "第一季", "上周". */
  label: string
  value: number
}

/** Where the chart lives: a raised card, a plain outlined one, or nothing at
 *  all. No default anywhere in the chain — `undefined` is how the register wins.
 *  See puck-config-client.tsx. */
export type TrendFrame = "card" | "outline" | "bare"

export type TrendChartProps = {
  title?: string
  caption?: string
  frame?: TrendFrame
  /** Optional, and it has to be: `kind` is one of the three shapes a register
   *  chooses, and a register's preference only reaches a component when the
   *  prop is ABSENT. It was required, so puck-config.tsx supplied it from
   *  defaultProps, so all fourteen preferences were dead. The fallback lives
   *  here now, which is the one place it cannot outrank anybody. */
  kind?: TrendKind
  /** Prefixed to the tooltip figure. "RM" for money, "" for counts. */
  unit?: string
  points: TrendPoint[]
  /**
   * 卡头右边那个「看多久」的开关，每一格是几期。
   *
   * 🔴 **四个参考页的图表卡头上都有一个控件，我们的卡头是空的**
   * （[任务 24](../../docs/founder-tasks.md) 从 8-26 就记着这一条）：
   * Tabler 是「Last 7 days ⌄」· Studio Admin 是「Last 12 months ⌄」·
   * TailAdmin 是三段（Overview / Sales / Revenue）＋一个日期范围 ·
   * Ant 是右上角一句「全部项目」。
   *
   * ⚠️ **它是真的会换的**，不是一颗装饰。按下去这张图真的少画几根柱子，
   * 底下那句说明的数字也跟着变。一个按了没反应的下拉，正是这个仓库
   * 禁的那种东西（⌘K 那个假搜索框就是因为这个被砍的）。
   *
   * 少於两格、或者最小的一格比手上的资料还长，就整个不画 ——
   * **一个只有一个选项的开关，不是开关。**
   */
  ranges?: number[]
  /**
   * 底下那句说明的**模子**，里面带一个 `{n}`（「最近 {n} 期」）。
   *
   * 有它才有上面那个开关：换了期数而说明还写着 12，那句话就变成假的。
   * 旧的页面存下来的只有已经填好数字的 `caption`，没有这个 —— 那些页面
   * 不长开关，画出来跟以前一个像素都不差。
   */
  captionTemplate?: string
}

/** A 14px radius belongs on a card, not on a 40px-wide bar, where it reads as a
 *  pill rather than a corner. Every style's radius still changes the bar — this
 *  only stops the roundest style from changing what the bar *is*. */
const MAX_BAR_RADIUS = 8

/**
 * Bars are the one thing on this chart that CSS cannot style. Recharts bakes
 * corner radius into the `d` of a `<path>`, so unlike every colour here it has
 * to arrive as a number rather than a var() the browser re-resolves. Reading it
 * back off the DOM is what keeps the bar honest to the style anyway: Ledger's
 * 3px stays a ledger corner, Hearth's 14px softens (to 8), Blueprint's 8px is
 * itself.
 *
 * The observer is not decoration. The editor's style switcher works by swapping
 * the scope class on an ancestor, which repaints every colour for free and
 * would leave exactly this one number stale — the customer would flip to Hearth
 * and see everything soften except the bars.
 */
function useStyleRadius(ref: React.RefObject<HTMLElement | null>, fallback: number) {
  const [radius, setRadius] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const read = () => {
      const n = Number.parseFloat(getComputedStyle(el).getPropertyValue("--radius"))
      setRadius(Number.isFinite(n) ? Math.max(0, Math.min(MAX_BAR_RADIUS, Math.round(n))) : fallback)
    }
    read()

    const scope = el.closest("[class*=scope]") ?? el
    const observer = new MutationObserver(read)
    observer.observe(scope, { attributes: true, attributeFilter: ["class", "style"] })
    return () => observer.disconnect()
  }, [ref, fallback])

  return radius
}

/**
 * A trend over time — the one thing every business system opens with and the
 * one thing this library could not draw.
 *
 * WHY IT EXISTS NOW AND NOT BEFORE. Not because a chart is hard, but because
 * until the shadcn variable contract was aliased into every style file
 * (design-system/tokens/*.css, "THE shadcn/ui CONTRACT") there was nowhere for
 * a chart to get its colours from. A chart is the component that most needs a
 * palette rather than a single accent: it needs a series colour, a grid that
 * recedes, an axis that is legible but quiet, and a tooltip surface that sits
 * above the page. Those are exactly --chart-1, --border, --muted-foreground and
 * --popover, and every style now answers all four. So this file names no colour
 * at all; Ledger draws it in rust, Hearth in teal, Blueprint in blue, and a
 * style added next year draws it in whatever that style says without this file
 * being opened.
 *
 * WHY THREE SHAPES AND NOT A CHART BUILDER. The customer picking this is a
 * contractor deciding whether their revenue page shows monthly bars or a line.
 * That is a real decision with three real answers. Stacking, dual axes and
 * secondary series are decisions about a chart, not about their business, and
 * every one of them is a way to make the page harder to read — so they are the
 * build team's job after the RM5,000, not a dropdown here.
 *
 * WHY NO Y AXIS. In a 460px editor canvas a value axis costs about 15% of the
 * width to render numbers the tooltip already gives on hover, and the shape of
 * the trend is what the customer is choosing between. The grid lines keep the
 * magnitudes comparable, which is the part the axis was actually for.
 */

/**
 * How tall the plot should be: 220, or whatever is left in a card the layout
 * has already made taller.
 *
 * THE PROBLEM THIS SOLVES, MEASURED 2026-08-26 across all sixteen registers.
 * Nine of them showed a chart card with a hundred to three hundred pixels of
 * bare card under the plot. `Columns` deliberately makes a side-by-side pair
 * the same height -- that is right, and every admin template does it -- but
 * the chart inside kept a fixed 220, so the emptiness did not disappear, it
 * moved INSIDE the card. Two cards of different heights read as one card and
 * one mistake; one stretched card with a hole in it reads as unfinished, which
 * is worse.
 *
 * WHY NOT `h-full flex-1`, WHICH IS THE OBVIOUS ANSWER AND WAS TRIED. A flex
 * child in a column starts at `flex-basis: 0`, and recharts' ResponsiveContainer
 * decides what to draw from the size it measures at first layout. Standing
 * alone at full width that measurement was zero and the chart rendered NOTHING
 * -- a titled card with 200px of blank under it. `min-h` does not help: it sets
 * the floor for LAYOUT, and the bad measurement happens before layout settles.
 *
 * So the height stays DEFINITE at every paint. It starts at 220, which is what
 * it always was, and a ResizeObserver raises it once the card's own height is
 * known. The fixed point is stable in both directions: standing alone the card
 * is header + gap + 220, so the sum comes back to 220 and nothing moves; in a
 * stretched cell the card's height is imposed by the grid, so the plot takes
 * whatever the header leaves.
 */
const PLOT_MIN = 220
/*
  AND A CEILING, because filling the card is not the goal -- the goal is that
  the card has no hole in it. 瓷 pairs a single chart against a cell holding TWO
  stacked blocks, and letting the plot take all of that gave a 590px slab of six
  bars: the hole was gone and the chart had stopped being a chart. Past about
  420 a bar chart of six periods gains no readability, it just gets taller, and
  every reference photographed on 2026-08-26 -- Tabler, Ant Design Pro, the
  admin dashboard this repo already borrows from -- keeps its plot inside that.

  A pair that is still uneven after the cap is a COMPOSITION problem: one block
  facing two. That is fixed per register in DASHBOARD_COMPOSITION, not here.
*/
const PLOT_MAX = 420

function usePlotHeight(host: React.RefObject<HTMLElement | null>) {
  const [h, setH] = useState(PLOT_MIN)

  useEffect(() => {
    const el = host.current
    if (!el || typeof ResizeObserver === "undefined") return

    const measure = () => {
      // Everything in the card that is not the plot: the header, and the gap
      // between it and the plot. Read off the box rather than assumed, because
      // both are register tokens and both differ by a factor of three between
      // 台账 and 炉.
      let used = 0
      for (const child of Array.from(el.children)) {
        if (child.getAttribute("data-plot") === "") continue
        used += (child as HTMLElement).offsetHeight
      }
      const gap = parseFloat(getComputedStyle(el).rowGap) || 0
      const gaps = Math.max(0, el.children.length - 1) * gap
      const pad =
        parseFloat(getComputedStyle(el).paddingTop) +
        parseFloat(getComputedStyle(el).paddingBottom)
      const room = el.clientHeight - pad - used - gaps
      const want = Number.isFinite(room) ? Math.round(room) : PLOT_MIN
      setH(Math.min(PLOT_MAX, Math.max(PLOT_MIN, want)))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [host])

  return h
}

export function TrendChart({
  title,
  caption,
  frame,
  kind = "bar",
  unit = "",
  points,
  ranges,
  captionTemplate,
}: TrendChartProps) {
  const w = useSystemWords()
  const hostRef = useRef<HTMLElement>(null)
  const barRadius = useStyleRadius(hostRef, 4)
  const plotHeight = usePlotHeight(hostRef)

  // `v` rather than a descriptive key on purpose: ChartContainer emits the
  // series colour as `--color-<key>`, and this design system already owns the
  // whole `--color-*` namespace (--color-paper, --color-canvas, --color-ink-900
  // …). A key like "revenue" is safe today and collides the day someone adds a
  // token by that name; a one-letter key cannot.
  const config = {
    v: { label: title || w.value, color: "var(--chart-1)" },
  } satisfies ChartConfig

  /* ── 卡头上那个「看多久」 ────────────────────────────────────────────────
     只在**真的有得选**的时候才出现：至少两格，而且每一格都短过手上的资料。
     默认是最长的那一格 —— 一进来看到的还是全部，跟以前一样。 */
  const spans = [...new Set(ranges ?? [])]
    .filter((n) => Number.isFinite(n) && n > 0 && n <= points.length)
    .sort((a, b) => a - b)
  const canSwitch = spans.length >= 2 && Boolean(captionTemplate)
  const [picked, setPicked] = useState<number | null>(null)
  const span = canSwitch ? (picked ?? spans[spans.length - 1]) : points.length
  const shown = canSwitch ? points.slice(-span) : points
  /* 说明跟着开关走 —— **但客户自己打的那一句先赢**。
     🔴 没有这一条的时候，`caption` 变成一个「存下来却永远画不出来」的字段，
     而 `site-fields.test.tsx` 当场就把它点名了（那把尺问的正是这件事）。
     他改过的字要看得到；等他真的去按了那个开关，那句话才换成会讲实话的模子
     —— 因为那时候「最近 12 期」已经是假的了。 */
  const captionText =
    canSwitch && picked !== null
      ? (captionTemplate as string).replace("{n}", String(span))
      : caption

  const data = shown.map((p) => ({ label: p.label, v: Number(p.value) || 0 }))

  /** 12,340 -> "12.3k". A money axis at full length ("RM 12,340") is four
   *  times the width of the tick it labels and pushes the plot into a third of
   *  the card. Every reference dashboard shortens it; none of them omits it. */
  const tick = (n: number) =>
    Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n)

  const axis = (
    <>
      {/* 🔴 面积那一种用**实线**，不是虚线（2026-09-04）。
          源代码：`<CartesianGrid vertical={false} strokeOpacity={0.5} />`
          —— 只有横线（我们本来就是），但那几条是**实的、半透明的**。
          虚线读起来像「这是估的」，实线读起来像「这是格线」，而他们那一页是后者。
          ⚠️ 只绑在 `area` 上，不改另外三种：柱状跟折线是别的风格照别的参考做的，
          一条改动扫过四种图，等於拿一个参考去覆盖另外三个。 */}
      {kind === "area" ? (
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
      ) : (
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
      )}
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
      {/* A SCALE DOWN THE LEFT.
          Every admin dashboard the founder sent has one -- shadcn-admin reads
          $0 / $1500 / $3000 / $4500 / $6000, Ant Design Pro reads 0 to 1200 in
          two-hundreds -- and ours had none, so the bars floated with nothing to
          measure them against. It is the difference between a chart and a
          picture of a chart, and it was the first thing that read as unfinished
          when the two were put side by side.

          `width={44}` rather than auto: Recharts measures the widest tick and
          reserves that, so a month with a five-figure total silently indents
          the whole plot. A fixed gutter keeps every register's chart starting
          at the same x. */}
      <YAxis
        tickLine={false}
        axisLine={false}
        width={44}
        tickMargin={6}
        tickFormatter={(v) => tick(Number(v))}
      />
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={(value) => `${unit}${unit ? " " : ""}${Number(value).toLocaleString("en-MY")}`}
          />
        }
      />
    </>
  )

  // WHY THIS SITS IN A CARD SINCE 2026-08-25. It used to be a bare <section>:
  // a heading, a caption and a chart floating directly on the page ground. On
  // the first screen that shipped it beside StatRow, ShelfList, WorkflowStrip
  // and RecordTable -- every one of which is in a card -- it was the single
  // block with no container, and it read as something that had failed to load
  // its frame rather than as a deliberate absence. All eleven competitors
  // photographed the same day card their charts.
  //
  // `frame` is an axis and not a constant because two registers genuinely have
  // no card to put it in: 墨 and 瑞士 separate with space and a rule, and a
  // shadowed box in either of them is the wrong object. Those ask for "bare",
  // which is what this component always was.
  return (
    <section
      ref={hostRef}
      className={`flex flex-col [gap:var(--gap-inline)] ${
        frame === "bare"
          ? ""
          : frame === "outline"
            ? "[background:var(--card)] [border:var(--border-card-width)_solid_var(--border)] [border-radius:var(--radius)] [padding:var(--pad-card)]"
            : "[background:var(--card)] [border:var(--border-card-width)_solid_var(--border-subtle)] [border-radius:var(--radius)] [padding:var(--pad-card)] [box-shadow:var(--shadow-card)]"
      }`}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between [gap:var(--gap-inline)]">
          <div className="flex min-w-0 flex-col [gap:var(--gap-tight,4px)]">
            <h3 className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
              {title}
            </h3>
            {captionText ? (
              <p className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">{captionText}</p>
            ) : null}
          </div>
          {canSwitch ? (
            <div
              className="flex shrink-0 items-center [border:var(--hairline)_solid_var(--border-subtle)] [border-radius:var(--radius-control)] [padding:2px]"
              role="group"
            >
              {spans.map((n) => {
                const on = n === span
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked(n)}
                    className="[border-radius:var(--radius-control)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [padding-block:3px] [padding-inline:var(--pad-control-x)]"
                    style={
                      on
                        ? { background: "var(--color-ink-850)", color: "var(--color-paper)" }
                        : { color: "var(--color-paper-dim)" }
                    }
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          ) : null}
        </header>
      ) : null}

      {/* `sum` 把这一格切成两栏：图在左，结论在右。
          其余三种照旧是一整格 —— 一个只有图的卡片是对的，
          只是它不是唯一对的那一种。 */}
      <div className={kind === "sum" ? "flex min-h-0 flex-1 flex-wrap [gap:var(--gap-stack)]" : "contents"}>
      <div className={kind === "sum" ? "flex min-w-[16rem] flex-1 flex-col" : "contents"}>
      {/* aspect-auto cancels ChartContainer's own aspect-video: in the editor's
          narrow canvas a 16:9 box collapses to about 120px tall and the bars
          stop being readable, while on a full-width page it would grow past the
          fold. A fixed height is the only one of the three that holds at both
          widths. */}
      {/* h-full + min-h + flex-1, not a fixed 200. The height was a constant
          because nothing above it ever had one; a bento cell does -- the
          chart is the tall block in a grid whose row heights are decided by
          the layout -- and a 200px chart in a 600px cell leaves four hundred
          pixels of card under it. Outside a stretched cell the section has
          no definite height, so h-full resolves to auto and the min holds
          the old behaviour exactly. */}
      {/*
        A DEFINITE HEIGHT, NOT `h-full flex-1`.

        `flex-basis: 0` in a column makes this box zero at first layout, and
        recharts' ResponsiveContainer decides what to draw from the size it
        measures then. Inside a Columns cell an `h-full` chain gave it a real
        number in time; standing alone at full width it did not, and the chart
        rendered NOTHING -- measured on 炉: a 1052x200 container with no
        `.recharts-surface` inside it at all. A card with a title and 200px of
        blank under it, on the register whose dashboard is meant to lead with
        its trend.

        `min-h` cannot fix that: it sets the floor for LAYOUT, and layout was
        already right. What was wrong is that the first measurement happened
        before the floor applied. A plain height is true at first paint.
      */}
      <ChartContainer
        config={config}
        data-plot=""
        className="aspect-auto w-full"
        style={{ height: plotHeight }}
      >
        {kind === "bar" ? (
          <BarChart data={data} margin={{ left: 0, right: 4, top: 4 }}>
            {axis}
            {/* maxBarSize: six periods across a full-width card gave 90px
                slabs -- Recharts divides the plot between however many points
                there are, so fewer points means fatter bars, which is exactly
                backwards. The references run about 40px with air between them,
                and a bar wider than its own label has stopped being a bar. */}
            <Bar
              dataKey="v"
              fill="var(--color-v)"
              radius={[barRadius, barRadius, 0, 0]}
              maxBarSize={46}
            />
          </BarChart>
        ) : kind === "line" ? (
          <LineChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
            {axis}
            <Line
              dataKey="v"
              stroke="var(--color-v)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ left: 0, right: 4, top: 4 }}>
            {axis}
            <Area
              dataKey="v"
              stroke="var(--color-v)"
              strokeWidth={2}
              fill="var(--color-v)"
              fillOpacity={0.16}
            />
          </AreaChart>
        )}
      </ChartContainer>
      </div>
      {/* 结论那一栏。只有 `sum` 画，而它讲的三件事全部是这几个点自己算出来的。 */}
      {kind === "sum" ? (
        (() => {
          const total = data.reduce((n, d) => n + d.v, 0)
          const last = data[data.length - 1]?.v ?? 0
          const pct = total ? Math.round((last / total) * 100) : 0
          return (
            <div className="flex min-w-[13rem] flex-1 flex-col justify-center [gap:var(--gap-stack)]">
              <div>
                <span className="tnum [font-size:var(--text-stat,var(--text-title))] [font-weight:var(--fw-semibold)] [color:var(--color-on-canvas)]">
                  {unit ? `${unit} ` : ""}
                  {total.toLocaleString("en-MY")}
                </span>
                {caption ? (
                  <p className="mt-1 max-w-[34ch] [color:var(--color-on-canvas-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
                    {caption}
                  </p>
                ) : null}
              </div>
              {/* 一张小卡装一条进度 —— Studio Admin 那一格里也是一张小卡，
                  而它在那里的作用是把「一个比例」跟上面那个总数分开读。 */}
              <div className="[background:var(--color-ink-850)] [border-radius:var(--radius-md)] [padding:var(--pad-card)]">
                <p className="[color:var(--color-on-canvas-dim)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] uppercase [letter-spacing:var(--tracking-label)]">
                  {data[data.length - 1]?.label ?? ""}
                </p>
                <p className="mt-1">
                  <span className="tnum [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [color:var(--color-on-canvas)]">
                    {unit ? `${unit} ` : ""}
                    {last.toLocaleString("en-MY")}
                  </span>
                </p>
                <div
                  className="mt-2 h-[6px] w-full overflow-hidden [border-radius:var(--radius-sm)]"
                  style={{ background: "var(--color-ink-800)" }}
                >
                  <div className="h-full" style={{ width: `${pct}%`, background: "var(--chart-1)" }} />
                </div>
                <p className="mt-1.5 tnum [color:var(--color-on-canvas-dim)] [font-size:var(--text-micro)]">
                  {pct}%
                </p>
              </div>
            </div>
          )
        })()
      ) : null}
      </div>
    </section>
  )
}
