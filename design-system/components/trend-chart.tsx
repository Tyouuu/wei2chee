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

export type TrendKind = "bar" | "line" | "area"

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
  kind: TrendKind
  /** Prefixed to the tooltip figure. "RM" for money, "" for counts. */
  unit?: string
  points: TrendPoint[]
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
export function TrendChart({ title, caption, frame, kind, unit = "", points }: TrendChartProps) {
  const w = useSystemWords()
  const hostRef = useRef<HTMLElement>(null)
  const barRadius = useStyleRadius(hostRef, 4)

  // `v` rather than a descriptive key on purpose: ChartContainer emits the
  // series colour as `--color-<key>`, and this design system already owns the
  // whole `--color-*` namespace (--color-paper, --color-canvas, --color-ink-900
  // …). A key like "revenue" is safe today and collides the day someone adds a
  // token by that name; a one-letter key cannot.
  const config = {
    v: { label: title || w.value, color: "var(--chart-1)" },
  } satisfies ChartConfig

  const data = points.map((p) => ({ label: p.label, v: Number(p.value) || 0 }))

  /** 12,340 -> "12.3k". A money axis at full length ("RM 12,340") is four
   *  times the width of the tick it labels and pushes the plot into a third of
   *  the card. Every reference dashboard shortens it; none of them omits it. */
  const tick = (n: number) =>
    Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n)

  const axis = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
        <header className="flex flex-col [gap:var(--gap-tight,4px)]">
          <h3 className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {title}
          </h3>
          {caption ? (
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">{caption}</p>
          ) : null}
        </header>
      ) : null}

      {/* aspect-auto cancels ChartContainer's own aspect-video: in the editor's
          narrow canvas a 16:9 box collapses to about 120px tall and the bars
          stop being readable, while on a full-width page it would grow past the
          fold. A fixed height is the only one of the three that holds at both
          widths. */}
      <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
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
    </section>
  )
}
