import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const STATS = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Group"
        tabler="IconUsers"
        hugeicons="GroupIcon"
        phosphor="Users"
        remixicon="RiGroupLine"
        {...p}
      />
    ),
    value: "12,400+",
    label: "Teams onboarded",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Clock"
        tabler="IconClock"
        hugeicons="TimeIcon"
        phosphor="Clock"
        remixicon="RiTimeLine"
        {...p}
      />
    ),
    value: "99.98%",
    label: "Uptime SLA",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Star"
        tabler="IconStar"
        hugeicons="StarIcon"
        phosphor="Star"
        remixicon="RiStarLine"
        {...p}
      />
    ),
    value: "4.9 / 5",
    label: "Customer rating",
  },
]

export default function HeroBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-3xl">
        <Badge variant="outline">Acme Platform: Now GA</Badge>

        <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Ship faster with
          <br className="hidden sm:block" /> less overhead.
        </h1>

        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Acme consolidates your workflows, deployments, and team collaboration
          into a single workspace, so your engineers spend time building, not
          wrangling tools.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild><a href="#" >
            Start For Free
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </a></Button>
          <Button
            variant="outline"
           
           
           asChild><a href="#" >
            View Documentation
            <IconPlaceholder
              lucide="ExternalLink"
              tabler="IconExternalLink"
              hugeicons="ExternalLinkIcon"
              phosphor="ArrowSquareOut"
              remixicon="RiExternalLinkLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </a></Button>
        </div>

        <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-0">
          {STATS.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex items-center gap-0">
                {index > 0 && (
                  <Separator
                    orientation="vertical"
                    className="mx-6 hidden h-10 sm:block"
                  />
                )}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                    <Icon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-xl leading-none font-bold tabular-nums">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
