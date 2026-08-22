import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Meter = {
  label: string
  used: number
  limit: number
  unit: string
  display: string
}

const meters: Meter[] = [
  { label: "Seats", used: 9, limit: 10, unit: "seats", display: "9 / 10" },
  {
    label: "Storage",
    used: 42,
    limit: 50,
    unit: "GB",
    display: "42 / 50 GB",
  },
  {
    label: "API Requests",
    used: 1.24,
    limit: 2,
    unit: "M",
    display: "1.24M / 2M",
  },
  {
    label: "Bandwidth",
    used: 96,
    limit: 250,
    unit: "GB",
    display: "96 / 250 GB",
  },
]

function MeterRow({ meter }: { meter: Meter }) {
  const percent = Math.round((meter.used / meter.limit) * 100)
  const nearLimit = percent >= 85
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{meter.label}</span>
        <span
          className={
            "text-xs tabular-nums " +
            (nearLimit ? "text-warning" : "text-muted-foreground")
          }
        >
          {meter.display}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  )
}

export default function BillingBlock() {
  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Usage This Cycle</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Team plan, resets Aug 1, 2026
            </p>
          </div>
          <Badge variant="secondary">18 Days Left</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {meters.map((meter) => (
            <MeterRow key={meter.label} meter={meter} />
          ))}
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Estimated total</p>
              <p className="text-xs text-muted-foreground">
                Base plan plus metered usage
              </p>
            </div>
            <span className="text-lg font-semibold tabular-nums">$248.00</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full">
            Manage Plan and Limits
            <IconPlaceholder
              lucide="ArrowUpRight"
              tabler="IconArrowUpRight"
              hugeicons="ArrowUpRightIcon"
              phosphor="ArrowUpRight"
              remixicon="RiArrowRightUpLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </Button>
        </CardFooter>
      </Card>
    </section>
  )
}
