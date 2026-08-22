import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

/** An icon held in data and rendered later, e.g. `<item.icon className="size-4" />`. */
type IconRenderer = (props: IconProps) => React.ReactNode

type Step = {
  icon: IconRenderer
  title: string
  description: string
  points: string[]
  Mock: () => ReactNode
}

function MockFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-full rounded-lg border border-border bg-card p-4"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

// Step 1 — rows of data sources being connected.
function ConnectMock() {
  const connected = [true, true, false]
  return (
    <MockFrame>
      <div className="mb-3 h-2 w-20 bg-muted" />
      <div className="flex flex-col gap-2">
        {connected.map((isConnected, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5"
          >
            <div className="size-6 shrink-0 rounded-md border border-border bg-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-2 w-2/3 bg-muted" />
              <div className="h-1.5 w-1/3 bg-muted" />
            </div>
            {isConnected ? (
              <IconPlaceholder
                lucide="Check"
                tabler="IconCheck"
                hugeicons="Tick02Icon"
                phosphor="Check"
                remixicon="RiCheckLine"
                className="size-4 shrink-0 text-success"
              />
            ) : (
              <span className="size-2 shrink-0 rounded-full bg-muted-foreground/30" />
            )}
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

// Step 2 — a table with active filters.
function ShapeMock() {
  return (
    <MockFrame>
      <div className="mb-3 flex gap-1.5">
        <div className="h-5 w-16 rounded-md bg-foreground/80" />
        <div className="h-5 w-12 rounded-md border border-border bg-muted" />
        <div className="h-5 w-14 rounded-md border border-border bg-muted" />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted/60 p-2">
          <div className="h-1.5 bg-muted-foreground/40" />
          <div className="h-1.5 bg-muted-foreground/40" />
          <div className="h-1.5 bg-muted-foreground/40" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-3 gap-2 border-b border-border p-2 last:border-b-0"
          >
            <div className="h-1.5 bg-muted" />
            <div className="h-1.5 bg-muted" />
            <div
              className={
                "h-1.5 " + (i % 2 === 0 ? "bg-foreground/60" : "bg-muted")
              }
            />
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

// Step 3 — a published dashboard with stats and a chart.
function ShipMock() {
  const bars = ["h-6", "h-10", "h-8", "h-14", "h-11", "h-16", "h-12"]
  return (
    <MockFrame>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-md border border-border bg-background p-2"
          >
            <div className="h-1.5 w-2/3 bg-muted" />
            <div className="h-3 w-1/2 bg-foreground/70" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-20 items-end gap-1.5 rounded-md border border-border bg-background p-2">
        {bars.map((height, i) => (
          <div key={i} className={"flex-1 bg-foreground/70 " + height} />
        ))}
      </div>
    </MockFrame>
  )
}

const steps: Step[] = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Cloud"
        tabler="IconCloud"
        hugeicons="CloudIcon"
        phosphor="Cloud"
        remixicon="RiCloudLine"
        {...p}
      />
    ),
    title: "Connect Your Data",
    description:
      "Link a database or import a CSV and we map your schema automatically. No pipelines to maintain.",
    points: ["One-click integrations", "Automatic schema mapping"],
    Mock: ConnectMock,
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="SlidersHorizontal"
        tabler="IconAdjustments"
        hugeicons="PreferenceHorizontalIcon"
        phosphor="Faders"
        remixicon="RiEqualizerLine"
        {...p}
      />
    ),
    title: "Shape The View",
    description:
      "Filter, group, and pivot until the data answers your question. Save any view your team relies on.",
    points: ["Reusable saved views", "Shared team filters"],
    Mock: ShapeMock,
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Rocket"
        tabler="IconRocket"
        hugeicons="RocketIcon"
        phosphor="Rocket"
        remixicon="RiRocket2Line"
        {...p}
      />
    ),
    title: "Ship The Dashboard",
    description:
      "Publish to a link or embed it in your app. Changes to the source update everywhere instantly.",
    points: ["Public or private links", "Live embeds"],
    Mock: ShipMock,
  },
]

function StepRow({ step, index }: { step: Step; index: number }) {
  const flipped = index % 2 === 1
  const { Mock } = step
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <div className={flipped ? "md:order-2" : undefined}>
        <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
          <step.icon className="size-5" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight text-balance">
          {step.title}
        </h3>
        <p className="mt-2 text-pretty text-muted-foreground">
          {step.description}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {step.points.map((point) => (
            <li key={point} className="flex items-center gap-2 text-sm">
              <IconPlaceholder
                lucide="Check"
                tabler="IconCheck"
                hugeicons="Tick02Icon"
                phosphor="Check"
                remixicon="RiCheckLine"
                className="size-4 shrink-0 text-foreground"
                aria-hidden="true"
              />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={flipped ? "md:order-1" : undefined}>
        <Mock />
      </div>
    </div>
  )
}

export default function HowItWorksBlock() {
  return (
    <section className="flex min-h-svh w-full justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center text-center">
          <Badge variant="secondary">How It Works</Badge>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            From raw data to a live dashboard in three steps
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
            No setup calls, no pipelines. Connect a source and share an answer
            the same afternoon.
          </p>
        </div>

        <div className="mt-14 flex flex-col gap-14">
          {steps.map((step, index) => (
            <StepRow key={step.title} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
