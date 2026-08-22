import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const UPDATE = {
  label: "New",
  version: "v2.5",
  headline: "Acme Workflows just got a major upgrade",
  detail:
    "Parallel branching, conditional logic, and real-time run history are now generally available, with no feature flag required.",
  cta: "See What's New",
  date: "Released June 12, 2026",
  platform: "Acme Platform",
}

export default function AnnouncementBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2">
            <Badge variant="default">
              <IconPlaceholder
                lucide="Sparkles"
                tabler="IconSparkles"
                hugeicons="SparklesIcon"
                phosphor="Sparkle"
                remixicon="RiSparklingLine"
                data-icon="inline-start"
              />
              {UPDATE.label}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              {UPDATE.version}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-3">
          <h2 className="font-heading text-base leading-snug font-semibold text-foreground">
            {UPDATE.headline}
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            {UPDATE.detail}
          </p>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs text-muted-foreground">
              {UPDATE.date}
            </span>
            <span className="truncate text-xs font-medium text-foreground/80">
              {UPDATE.platform}
            </span>
          </div>
          <Button size="sm" asChild><a href="#" >
            {UPDATE.cta}
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              data-icon="inline-end"
            />
          </a></Button>
        </CardFooter>
      </Card>
    </section>
  )
}
