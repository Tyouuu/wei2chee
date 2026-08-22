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
  ChartLegend,
  ChartLegendContent,
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

export default function ChartsBlock() {
  const [range, setRange] = React.useState<RangeKey>("30d")
  const data = datasets[range]

  const totalVisitors = data.reduce((sum, d) => sum + d.visitors, 0)

  const first = data[0]?.visitors ?? 0
  const last = data[data.length - 1]?.visitors ?? 0
  const deltaPct = first === 0 ? 0 : ((last - first) / first) * 100
  const deltaUp = deltaPct >= 0

  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <Card className="w-full max-w-3xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Traffic Overview</CardTitle>
            <CardDescription>
              Visitors and signups for Acme, last {range.replace("d", " days")}
            </CardDescription>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-2xl font-semibold tabular-nums">
                {totalVisitors.toLocaleString("en-US")}
              </span>
              <Badge
                variant={deltaUp ? "secondary" : "destructive"}
                className="gap-1"
              >
                {deltaUp ? (
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
                {deltaUp ? "+" : ""}
                {deltaPct.toFixed(1)}%
              </Badge>
            </div>
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
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="h-72 w-full [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-ring [&_.recharts-surface:focus-visible]:outline-solid"
          >
            <AreaChart
              aria-label="Visitors and signups over the selected range"
              data={data}
              margin={{ left: 0, right: 8, top: 8 }}
            >
              <defs>
                <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-visitors)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-visitors)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
                <linearGradient id="fillSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-signups)"
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-signups)"
                    stopOpacity={0.1}
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
                tickFormatter={(value) =>
                  `${(Number(value) / 1000).toFixed(0)}k`
                }
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
                dataKey="visitors"
                type="monotone"
                stroke="var(--color-visitors)"
                strokeWidth={2}
                fill="url(#fillVisitors)"
                stackId="a"
              />
              <Area
                dataKey="signups"
                type="monotone"
                stroke="var(--color-signups)"
                strokeWidth={2}
                strokeDasharray="4 3"
                fill="url(#fillSignups)"
                stackId="b"
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  )
}
