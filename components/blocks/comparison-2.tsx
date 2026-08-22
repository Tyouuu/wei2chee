import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const acmePoints = [
  "Onboarding completed in under 10 minutes",
  "Real-time sync across all devices and team members",
  "Granular role-based access control included",
  "99.99 % uptime SLA with status page",
  "Dedicated Slack channel for Pro customers",
  "SOC 2 Type II certified infrastructure",
  "One-click data export in any format",
  "No per-seat fees, unlimited collaborators",
]

const othersPoints = [
  "Complex setup requires engineering resources",
  "Sync delays of up to 15 minutes on free tiers",
  "Permissions locked behind enterprise plan",
  "SLA only available on custom contracts",
  "Email-only support with 48 h response time",
  "Compliance docs behind sales call",
  "Data export limited to CSV on lower plans",
  "Per-seat pricing adds up fast at scale",
]

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
export const copy = { acmePoints, othersPoints }
export type Copy = typeof copy


function CheckRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md bg-primary">
        <IconPlaceholder
          lucide="Check"
          tabler="IconCheck"
          hugeicons="Tick02Icon"
          phosphor="Check"
          remixicon="RiCheckLine"
          className="size-3 text-primary-foreground"
          aria-hidden
        />
      </span>
      <span className="text-sm text-foreground">{text}</span>
    </li>
  )
}

function CrossRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md bg-muted">
        <IconPlaceholder
          lucide="X"
          tabler="IconX"
          hugeicons="Cancel01Icon"
          phosphor="X"
          remixicon="RiCloseLine"
          className="size-3 text-muted-foreground"
          aria-hidden
        />
      </span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </li>
  )
}

export default function ComparisonBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { acmePoints, othersPoints } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-4">
            <IconPlaceholder
              lucide="ShieldCheck"
              tabler="IconShieldCheck"
              hugeicons="Shield01Icon"
              phosphor="ShieldCheck"
              remixicon="RiShieldCheckLine"
              data-icon="inline-start"
            />
            Why Acme
          </Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Built differently, on purpose
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            We obsessed over the details others skip. Here is what that means
            for your team every single day.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-primary/30 ring-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Acme</CardTitle>
                <Badge variant="default">Recommended</Badge>
              </div>
              <CardDescription>
                Everything your team needs, without the enterprise runaround.
              </CardDescription>
            </CardHeader>

            <Separator />

            <CardContent className="pt-4">
              <ul className="flex flex-col gap-3">
                {acmePoints.map((point) => (
                  <CheckRow key={point} text={point} />
                ))}
              </ul>
            </CardContent>

            <CardFooter className="border-t">
              <Button
               
                className="w-full"
               
               asChild><a href="#" >
                Start For Free
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

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-muted-foreground">
                The others
              </CardTitle>
              <CardDescription>
                Common friction points teams encounter with legacy platforms.
              </CardDescription>
            </CardHeader>

            <Separator />

            <CardContent className="pt-4">
              <ul className="flex flex-col gap-3">
                {othersPoints.map((point) => (
                  <CrossRow key={point} text={point} />
                ))}
              </ul>
            </CardContent>

            <CardFooter className="border-t">
              <Button
                variant="secondary"
               
                className="w-full"
               
               asChild><a href="#" >
                See Why Teams Switch
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
        </div>
      </div>
    </section>
  )
}
