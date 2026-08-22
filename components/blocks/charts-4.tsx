"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

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
  { month: "Jan", visitors: 4200 },
  { month: "Feb", visitors: 5100 },
  { month: "Mar", visitors: 4800 },
  { month: "Apr", visitors: 6300 },
  { month: "May", visitors: 7200 },
  { month: "Jun", visitors: 6900 },
  { month: "Jul", visitors: 8400 },
  { month: "Aug", visitors: 9100 },
  { month: "Sep", visitors: 8700 },
  { month: "Oct", visitors: 10200 },
  { month: "Nov", visitors: 11300 },
  { month: "Dec", visitors: 12600 },
]

const chartConfig = {
  visitors: {
    label: "Visitors",
    color: "var(--primary)",
  },
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
export const copy = { chartData, chartConfig }
export type Copy = typeof copy


export default function ChartsBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { chartData, chartConfig } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Monthly Visitors</CardTitle>
          <CardDescription>
            Unique visitors to acme.com over the last year
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="h-64 w-full [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-ring [&_.recharts-surface:focus-visible]:outline-solid"
          >
            <LineChart
              aria-label="Visitors by month"
              data={chartData}
              margin={{ top: 12, left: 0, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                // Fits the widest tick this formatter produces ("10.5K"); at 40
                // recharts clipped the leading digit to "0.5K".
                width={48}
                tickFormatter={(value) => `${Number(value) / 1000}K`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      `${Number(value).toLocaleString("en-US")} visitors`
                    }
                  />
                }
              />
              <Line
                dataKey="visitors"
                type="monotone"
                stroke="var(--color-visitors)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  )
}
