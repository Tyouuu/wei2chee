import { Card, CardContent } from "@/components/ui/card"
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
    title: "Start with the problem",
    description:
      "We earn the right to build by understanding the job first. Every feature answers a real need, not a hunch.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="ShieldCheck"
        tabler="IconShieldCheck"
        hugeicons="Shield01Icon"
        phosphor="ShieldCheck"
        remixicon="RiShieldCheckLine"
        {...p}
      />
    ),
    title: "Default to trust",
    description:
      "Security, privacy, and reliability are not features you toggle — they are the floor we build everything on.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Lightbulb"
        tabler="IconBulb"
        hugeicons="Idea01Icon"
        phosphor="Lightbulb"
        remixicon="RiLightbulbLine"
        {...p}
      />
    ),
    title: "Simple beats clever",
    description:
      "The best solution is the one a teammate can understand in a minute and change without fear.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Users"
        tabler="IconUsersGroup"
        hugeicons="UserGroupIcon"
        phosphor="UsersThree"
        remixicon="RiTeamLine"
        {...p}
      />
    ),
    title: "Own the outcome",
    description:
      "We hand off results, not tasks. If it ships with our name on it, we stand behind how it works.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Heart"
        tabler="IconHeart"
        hugeicons="HeartIcon"
        phosphor="Heart"
        remixicon="RiHeart3Line"
        {...p}
      />
    ),
    title: "Care in the details",
    description:
      "Craft is cumulative. Small, considered choices are what make the whole product feel effortless.",
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
    title: "Stay a beginner",
    description:
      "We stay curious, ask the obvious questions, and treat every launch as the start of the next iteration.",
  },
]

export default function AboutBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="max-w-xl">
          <span className="inline-block rounded-4xl border border-border px-3 py-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            What we believe
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            The principles behind every decision
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            A short list we actually use — in reviews, in hiring, and in the
            hard calls where trade-offs matter most.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {values.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="gap-0 border-0 bg-card p-6 transition-colors duration-200 hover:bg-muted"
            >
              <CardContent className="flex flex-col gap-3 p-0">
                <Icon className="size-6 text-foreground" aria-hidden="true" />
                <h3 className="font-heading text-base font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
