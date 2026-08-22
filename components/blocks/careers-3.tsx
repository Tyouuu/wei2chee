import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const values = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Compass"
        tabler="IconCompass"
        hugeicons="CompassIcon"
        phosphor="Compass"
        remixicon="RiCompass3Line"
        {...p}
      />
    ),
    title: "Bias For Clarity",
    description:
      "We write things down, disagree in the open, and leave a trail anyone can follow.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Sprout"
        tabler="IconPlant"
        hugeicons="PlantIcon"
        phosphor="Plant"
        remixicon="RiPlantLine"
        {...p}
      />
    ),
    title: "Grow In Public",
    description:
      "Ship early, ask for feedback often, and treat every mistake as shared context.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Globe"
        tabler="IconGlobe"
        hugeicons="GlobalIcon"
        phosphor="Globe"
        remixicon="RiGlobalLine"
        {...p}
      />
    ),
    title: "Trust The Team",
    description:
      "Remote-first since day one. We hire adults and give them the room to do their best work.",
  },
]

const perks = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Wallet"
        tabler="IconWallet"
        hugeicons="WalletIcon"
        phosphor="Wallet"
        remixicon="RiWalletLine"
        {...p}
      />
    ),
    label: "Competitive Equity",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="HeartPulse"
        tabler="IconHeartbeat"
        hugeicons="HeartPulseIcon"
        phosphor="Heartbeat"
        remixicon="RiHeartPulseLine"
        {...p}
      />
    ),
    label: "Full Health Coverage",
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
    label: "Flexible Hours",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Globe"
        tabler="IconGlobe"
        hugeicons="GlobalIcon"
        phosphor="Globe"
        remixicon="RiGlobalLine"
        {...p}
      />
    ),
    label: "Home Office Budget",
  },
]

const photos = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&q=80",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500&q=80",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=500&q=80",
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
export const copy = { photos }
export type Copy = typeof copy


export default function CareersBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { photos } = { ...copy, ...override }
  return (
    <section className="flex min-h-svh w-full justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <Badge variant="secondary">Careers</Badge>
          <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Come build with a small, deliberate team
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
            We are forty people across nine time zones, shipping software we are
            proud of without the meetings that usually come with it.
          </p>
        </div>

        <div
          className="mt-12 grid grid-cols-3 gap-3 sm:gap-4"
          aria-hidden="true"
        >
          {photos.map((src, i) => (
            <div
              key={src}
              className={
                "overflow-hidden rounded-lg border border-border bg-muted " +
                (i === 1 ? "aspect-[3/4]" : "aspect-square self-center")
              }
            >
              <img
                src={src}
                alt=""
                className="size-full object-cover grayscale"
                loading="lazy"
              />
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {values.map((value) => (
            <Card key={value.title}>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                  <value.icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="mt-3 text-base">{value.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-pretty text-muted-foreground">
                  {value.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-6 rounded-xl border border-border bg-card p-6 sm:flex-row">
          <div className="grid w-full grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {perks.map((perk) => (
              <div key={perk.label} className="flex items-center gap-2.5">
                <perk.icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{perk.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Button size="lg">
            See Open Roles
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </section>
  )
}
