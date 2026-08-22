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
export const copy = { UPDATE }
export type Copy = typeof copy


export default function AnnouncementBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { UPDATE } = { ...copy, ...override }
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
