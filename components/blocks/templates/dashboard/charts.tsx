"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
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

type RangeKey = "7d" | "30d" | "90d"

type DataPoint = {
  label: string
  visitors: number
  signups: number
}

const datasets: Record<RangeKey, DataPoint[]> = {
  "7d": [
    { label: "Mon", visitors: 4_120, signups: 312 },
    { label: "Tue", visitors: 4_780, signups: 348 },
    { label: "Wed", visitors: 5_240, signups: 401 },
    { label: "Thu", visitors: 4_960, signups: 377 },
    { label: "Fri", visitors: 6_310, signups: 489 },
    { label: "Sat", visitors: 5_870, signups: 452 },
    { label: "Sun", visitors: 5_120, signups: 398 },
  ],
  "30d": [
    { label: "Week 1", visitors: 28_400, signups: 2_140 },
    { label: "Week 2", visitors: 31_900, signups: 2_480 },
    { label: "Week 3", visitors: 34_600, signups: 2_710 },
    { label: "Week 4", visitors: 39_200, signups: 3_060 },
  ],
  "90d": [
    { label: "Jan", visitors: 96_400, signups: 7_320 },
    { label: "Feb", visitors: 104_800, signups: 8_010 },
    { label: "Mar", visitors: 121_300, signups: 9_540 },
  ],
}

const ranges: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
]

const chartConfig = {
  visitors: {
    label: "Visitors",
    color: "var(--primary)",
  },
  signups: {
    label: "Signups",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig
const series = [
  { key: "visitors", label: "Visitors" },
  { key: "signups", label: "Signups" },
] as const

function formatTick(value: number | string): string {
  const n = Number(value)
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function summarize(data: DataPoint[], key: keyof Omit<DataPoint, "label">) {
  const total = data.reduce((sum, point) => sum + point[key], 0)
  const first = data[0]?.[key] ?? 0
  const last = data[data.length - 1]?.[key] ?? 0
  const deltaPct = first === 0 ? 0 : ((last - first) / first) * 100
  return { total, deltaPct, up: deltaPct >= 0 }
}

export default function Charts() {
  const [range, setRange] = React.useState<RangeKey>("30d")
  const data = datasets[range]

  return (
    <section className="w-full">
      <Card className="w-full">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Traffic Overview</CardTitle>
            <CardDescription>
              Visitors and signups for Acme, last {range.replace("d", " days")}
            </CardDescription>
          </div>
          <Select
            value={range}
            onValueChange={(value) => setRange(value as RangeKey)}
          >
            <SelectTrigger
              className="w-28 shrink-0"
              aria-label="Select date range"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ranges.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-2 md:gap-10">
          {series.map(({ key, label }) => {
            const { total, deltaPct, up } = summarize(data, key)
            return (
              <div key={key} className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    {label}
                  </span>
                  <span className="ml-auto text-2xl font-semibold tabular-nums">
                    {total.toLocaleString("en-US")}
                  </span>
                  <Badge
                    variant={up ? "secondary" : "destructive"}
                    className="gap-1"
                  >
                    {up ? (
                      <IconPlaceholder
                        lucide="ArrowUp"
                        tabler="IconArrowUp"
                        hugeicons="ArrowUpIcon"
                        phosphor="ArrowUp"
                        remixicon="RiArrowUpLine"
                        data-icon="inline-start"
                        className="size-3"
                      />
                    ) : (
                      <IconPlaceholder
                        lucide="ArrowDown"
                        tabler="IconArrowDown"
                        hugeicons="ArrowDownIcon"
                        phosphor="ArrowDown"
                        remixicon="RiArrowDownLine"
                        data-icon="inline-start"
                        className="size-3"
                      />
                    )}
                    {up ? "+" : ""}
                    {deltaPct.toFixed(1)}%
                  </Badge>
                </div>

                <ChartContainer config={chartConfig} className="h-56 w-full">
                  <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient
                        id={`fill-${key}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={`var(--color-${key})`}
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor={`var(--color-${key})`}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={44}
                      tickFormatter={formatTick}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <span className="flex w-full justify-between gap-4">
                              <span className="text-muted-foreground capitalize">
                                {String(name)}
                              </span>
                              <span className="font-medium tabular-nums">
                                {Number(value).toLocaleString("en-US")}
                              </span>
                            </span>
                          )}
                        />
                      }
                    />
                    <Area
                      dataKey={key}
                      type="monotone"
                      stroke={`var(--color-${key})`}
                      strokeWidth={2}
                      fill={`url(#fill-${key})`}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}
