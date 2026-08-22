import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const hints = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Flashlight"
        tabler="IconBulb"
        hugeicons="FlashlightIcon"
        phosphor="Flashlight"
        remixicon="RiFlashlightLine"
        {...p}
      />
    ),
    label: "Set up in under two minutes",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Sparkles"
        tabler="IconSparkles"
        hugeicons="SparklesIcon"
        phosphor="Sparkle"
        remixicon="RiSparkling2Line"
        {...p}
      />
    ),
    label: "Invite your team anytime",
  },
]

export default function OnboardingBlock() {
  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="relative flex size-20 items-center justify-center">
          <div
            className="absolute inset-0 rounded-lg border border-border bg-muted"
            aria-hidden="true"
          />
          <div
            className="absolute inset-1 rounded-md border border-border bg-background"
            aria-hidden="true"
          />
          <IconPlaceholder
            lucide="Rocket"
            tabler="IconRocket"
            hugeicons="RocketIcon"
            phosphor="Rocket"
            remixicon="RiRocket2Line"
            className="relative size-8 text-foreground"
            aria-hidden="true"
          />
        </div>

        <Badge variant="secondary" className="mt-6">
          Welcome
        </Badge>
        <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Let us get your workspace set up
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          You are a few steps away from your first project. Create one now or
          take a quick tour to see how everything fits together.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg">
            Create Your First Project
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
          <Button size="lg" variant="outline">
            <IconPlaceholder
              lucide="BookOpen"
              tabler="IconBook2"
              hugeicons="BookOpenIcon"
              phosphor="BookOpen"
              remixicon="RiBookOpenLine"
              data-icon="inline-start"
              aria-hidden="true"
            />
            Take The Tour
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {hints.map((hint) => (
            <span
              key={hint.label}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <hint.icon className="size-4 shrink-0" aria-hidden="true" />
              {hint.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
