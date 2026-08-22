"use client"

import { Label, Pie, PieChart } from "recharts"

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

const chartData = [
  { source: "Organic", visitors: 4820, fill: "var(--color-organic)" },
  { source: "Referral", visitors: 3110, fill: "var(--color-referral)" },
  { source: "Social", visitors: 2240, fill: "var(--color-social)" },
  { source: "Direct", visitors: 1680, fill: "var(--color-direct)" },
  { source: "Email", visitors: 940, fill: "var(--color-email)" },
]

const chartConfig = {
  visitors: { label: "Visitors" },
  organic: { label: "Organic", color: "var(--chart-1)" },
  referral: { label: "Referral", color: "var(--chart-2)" },
  social: { label: "Social", color: "var(--chart-3)" },
  direct: { label: "Direct", color: "var(--chart-4)" },
  email: { label: "Email", color: "var(--chart-5)" },
} satisfies ChartConfig

const total = chartData.reduce((sum, item) => sum + item.visitors, 0)

export default function ChartsBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Traffic By Source</CardTitle>
          <CardDescription>
            Where this month&rsquo;s visitors came from
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-64 [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-ring [&_.recharts-surface:focus-visible]:outline-solid"
          >
            <PieChart aria-label="Visitors by traffic source">
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) =>
                      `${name}: ${Number(value).toLocaleString("en-US")}`
                    }
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="visitors"
                nameKey="source"
                innerRadius={70}
                strokeWidth={2}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-2xl font-bold tabular-nums"
                          >
                            {total.toLocaleString("en-US")}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 22}
                            className="fill-muted-foreground text-xs"
                          >
                            Visitors
                          </tspan>
                        </text>
                      )
                    }
                    return null
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {chartData.map((item) => (
              <div
                key={item.source}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: item.fill }}
                    aria-hidden="true"
                  />
                  {item.source}
                </span>
                <span className="font-medium text-foreground tabular-nums">
                  {item.visitors.toLocaleString("en-US")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
