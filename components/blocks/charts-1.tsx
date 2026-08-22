"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts"

import {
  Card,
  CardAction,
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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const DATASETS: Record<string, number[]> = {
  "2024": [
    42_000, 58_300, 51_700, 74_200, 68_900, 91_400, 83_600, 107_500, 98_100,
    121_300, 113_800, 139_600,
  ],
  "2023": [
    28_400, 33_100, 39_800, 36_500, 44_200, 51_900, 48_700, 57_300, 61_800,
    59_400, 68_100, 82_500,
  ],
  "2022": [
    14_200, 17_800, 16_500, 21_300, 24_900, 22_600, 29_400, 31_200, 28_800,
    35_500, 39_100, 47_300,
  ],
}

const YEARS = Object.keys(DATASETS).sort((a, b) => Number(b) - Number(a))

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export default function ChartsBlock() {
  const [year, setYear] = React.useState(YEARS[0])

  const chartData = React.useMemo(
    () =>
      MONTHS.map((month, i) => ({
        month,
        revenue: DATASETS[year][i],
      })),
    [year]
  )

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Annual Revenue</CardTitle>
          <CardDescription>
            Monthly revenue for Acme Inc., fiscal year {year}
          </CardDescription>
          <CardAction>
            <Select
              value={year}
              onValueChange={(value) => setYear(value as string)}
            >
              <SelectTrigger
                className="w-24 tabular-nums"
                aria-label="Select fiscal year"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y} className="tabular-nums">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="h-64 w-full [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-ring [&_.recharts-surface:focus-visible]:outline-solid"
          >
            <BarChart
              aria-label="Revenue by month"
              data={chartData}
              margin={{ top: 24, left: 0, right: 0 }}
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
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      `$${Number(value).toLocaleString("en-US")}`
                    }
                  />
                }
              />
              <Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={0}
                maxBarSize={40}
                fillOpacity={0.9}
              >
                <LabelList
                  dataKey="revenue"
                  position="top"
                  offset={8}
                  className="fill-muted-foreground"
                  fontSize={10}
                  formatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  )
}
