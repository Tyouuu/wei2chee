"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Range = "7d" | "30d" | "90d" | "12m"

const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "12m", label: "Last 12 Months" },
]

const STATS_BY_RANGE: Record<
  Range,
  { label: string; value: string; delta: string; up: boolean }[]
> = {
  "7d": [
    { label: "Revenue", value: "$11.4k", delta: "+3.1%", up: true },
    { label: "Active Users", value: "2,140", delta: "+1.2%", up: true },
    { label: "Conversion", value: "3.31%", delta: "+0.2%", up: true },
    { label: "Avg. Session", value: "4m 02s", delta: "-0.4%", up: false },
  ],
  "30d": [
    { label: "Revenue", value: "$48.2k", delta: "+12.5%", up: true },
    { label: "Active Users", value: "8,941", delta: "+4.3%", up: true },
    { label: "Conversion", value: "3.24%", delta: "-0.8%", up: false },
    { label: "Avg. Session", value: "4m 12s", delta: "+1.1%", up: true },
  ],
  "90d": [
    { label: "Revenue", value: "$142.7k", delta: "+9.8%", up: true },
    { label: "Active Users", value: "26,304", delta: "+7.6%", up: true },
    { label: "Conversion", value: "3.18%", delta: "-1.4%", up: false },
    { label: "Avg. Session", value: "4m 26s", delta: "+2.3%", up: true },
  ],
  "12m": [
    { label: "Revenue", value: "$571.0k", delta: "+22.1%", up: true },
    { label: "Active Users", value: "98,612", delta: "+18.4%", up: true },
    { label: "Conversion", value: "3.02%", delta: "-2.9%", up: false },
    { label: "Avg. Session", value: "4m 41s", delta: "+5.0%", up: true },
  ],
}

const chartData = [
  { month: "Jan", sessions: 1840 },
  { month: "Feb", sessions: 2120 },
  { month: "Mar", sessions: 1760 },
  { month: "Apr", sessions: 2580 },
  { month: "May", sessions: 2340 },
  { month: "Jun", sessions: 3120 },
  { month: "Jul", sessions: 2210 },
  { month: "Aug", sessions: 2860 },
  { month: "Sep", sessions: 2480 },
  { month: "Oct", sessions: 3340 },
  { month: "Nov", sessions: 2720 },
  { month: "Dec", sessions: 3010 },
]

const chartConfig = {
  sessions: { label: "Sessions", color: "var(--primary)" },
} satisfies ChartConfig

/**
 * EVERY WORD THIS SECTION SHOWS, IN ONE OBJECT.
 *
 * The section was pulled from the @7Ovr registry with its own copy baked in as
 * module-level consts. That made it un-editable: the editor's AI writes into
 * PROPS (`set_text` in lib/portal/layout-ops.ts), and a block whose words live
 * in its source has no prop to write into. Selecting one and pressing 改文字
 * opened a panel with a single dropdown -- change the whole section, or nothing.
 *
 * Lifting the consts here changes nothing on screen: the component falls back
 * to exactly these values when no `copy` is passed. What it adds is a surface
 * the AI can reach, so a customer can say "put my own prices in" and get their
 * own prices rather than Acme's.
 *
 * GENERATED. Re-run the opener rather than editing this block by hand.
 */
export const copy = { RANGES, STATS_BY_RANGE, chartData, chartConfig }
export type Copy = typeof copy


export default function DashboardBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { RANGES, STATS_BY_RANGE, chartData, chartConfig } = { ...copy, ...override }
  const [range, setRange] = React.useState<Range>("30d")
  const stats = STATS_BY_RANGE[range]

  return (
    <section className="flex min-h-svh w-full items-stretch justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Overview
          </h1>
          <Select
           
            value={range}
            onValueChange={(value) => setRange(value as Range)}
          >
            <SelectTrigger aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl font-bold tracking-tight">
                  {stat.value}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Badge variant={stat.up ? "secondary" : "destructive"}>
                  {stat.up ? (
                    <IconPlaceholder
                      lucide="ArrowUpRight"
                      tabler="IconArrowUpRight"
                      hugeicons="ArrowUpRightIcon"
                      phosphor="ArrowUpRight"
                      remixicon="RiArrowRightUpLine"
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                  ) : (
                    <IconPlaceholder
                      lucide="ArrowDownRight"
                      tabler="IconArrowDownRight"
                      hugeicons="ArrowDownRightIcon"
                      phosphor="ArrowDownRight"
                      remixicon="RiArrowRightDownLine"
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                  )}
                  {stat.delta}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Vs Last Period
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Monthly traffic</CardTitle>
            <CardDescription>Sessions over the last 12 months</CardDescription>
            <CardAction>
              <a
                href="#"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground"
              >
                View Report
                <IconPlaceholder
                  lucide="ArrowRight"
                  tabler="IconArrowRight"
                  hugeicons="ArrowRightIcon"
                  phosphor="ArrowRight"
                  remixicon="RiArrowRightLine"
                  className="size-4"
                  aria-hidden="true"
                />
              </a>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="h-48 w-full [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-ring [&_.recharts-surface:focus-visible]:outline-solid"
            >
              <BarChart
                aria-label="Sessions by month"
                accessibilityLayer
                data={chartData}
                margin={{ top: 24 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey="sessions"
                  fill="var(--color-sessions)"
                  maxBarSize={48}
                >
                  <LabelList
                    dataKey="sessions"
                    position="top"
                    offset={8}
                    className="fill-muted-foreground"
                    fontSize={11}
                    formatter={(value) =>
                      (Number(value) / 1000).toFixed(1) + "k"
                    }
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
