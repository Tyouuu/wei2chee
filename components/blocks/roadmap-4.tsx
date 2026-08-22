import { Badge } from "@/components/ui/badge"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"
import type * as React from "react"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

/** An icon held in data and rendered later, e.g. `<item.icon className="size-4" />`. */
type IconRenderer = (props: IconProps) => React.ReactNode

type Status = "Shipped" | "In Progress" | "Planned"

type Item = {
  title: string
  description: string
  category: string
  status: Status
}

type Quarter = {
  label: string
  period: string
  items: Item[]
}

const statusMeta: Record<Status, { icon: IconRenderer; className: string }> = {
  Shipped: {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Check"
        tabler="IconCheck"
        hugeicons="Tick02Icon"
        phosphor="Check"
        remixicon="RiCheckLine"
        {...p}
      />
    ),
    className: "text-success",
  },
  "In Progress": {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="LoaderCircle"
        tabler="IconLoader2"
        hugeicons="Loading03Icon"
        phosphor="Spinner"
        remixicon="RiLoader4Line"
        {...p}
      />
    ),
    className: "text-warning",
  },
  Planned: {
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
    className: "text-muted-foreground",
  },
}

const quarters: Quarter[] = [
  {
    label: "Q1",
    period: "Jan – Mar",
    items: [
      {
        title: "Saved Views",
        description: "Pin filtered lists to the sidebar and share them.",
        category: "Core",
        status: "Shipped",
      },
      {
        title: "Dark Theme",
        description: "A full dark palette that follows the system setting.",
        category: "Design",
        status: "Shipped",
      },
    ],
  },
  {
    label: "Q2",
    period: "Apr – Jun",
    items: [
      {
        title: "Audit Log",
        description: "An exportable record of every workspace action.",
        category: "Security",
        status: "Shipped",
      },
      {
        title: "Team Roles",
        description: "Granular owner, editor, and viewer permissions.",
        category: "Core",
        status: "Shipped",
      },
    ],
  },
  {
    label: "Q3",
    period: "Jul – Sep",
    items: [
      {
        title: "Public API v2",
        description: "A faster REST API with typed SDKs and webhooks.",
        category: "Platform",
        status: "In Progress",
      },
      {
        title: "Mobile App",
        description: "Native iOS and Android apps for on-the-go access.",
        category: "Apps",
        status: "In Progress",
      },
      {
        title: "Slack Integration",
        description: "Post updates and create items straight from Slack.",
        category: "Integrations",
        status: "Planned",
      },
    ],
  },
  {
    label: "Q4",
    period: "Oct – Dec",
    items: [
      {
        title: "Custom Dashboards",
        description: "Build your own views from any metric in the workspace.",
        category: "Analytics",
        status: "Planned",
      },
      {
        title: "SSO and SCIM",
        description: "Enterprise sign-on with automated user provisioning.",
        category: "Security",
        status: "Planned",
      },
    ],
  },
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
export const copy = { quarters }
export type Copy = typeof copy


function RoadmapItem({ item }: { item: Item }) {
  const meta = statusMeta[item.status]
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3.5">
      <div className="flex items-center justify-between gap-2">
        <Badge>{item.category}</Badge>
        <meta.icon
          className={"size-4 shrink-0 " + meta.className}
          aria-hidden="true"
        />
      </div>
      <p className="text-sm font-medium text-pretty">{item.title}</p>
      <p className="text-xs text-pretty text-muted-foreground">
        {item.description}
      </p>
      <span className={"mt-0.5 text-xs font-medium " + meta.className}>
        {item.status}
      </span>
    </div>
  )
}

function QuarterColumn({ quarter }: { quarter: Quarter }) {
  return (
    <div className="flex min-w-64 flex-1 flex-col gap-3 sm:min-w-0">
      <div className="border-b border-border pb-3">
        <h3 className="font-heading text-sm font-semibold">
          {quarter.label} 2026
        </h3>
        <p className="text-xs text-muted-foreground">{quarter.period}</p>
      </div>
      <div className="flex flex-col gap-3">
        {quarter.items.map((item) => (
          <RoadmapItem key={item.title} item={item} />
        ))}
      </div>
    </div>
  )
}

export default function RoadmapBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { quarters } = { ...copy, ...override }
  return (
    <section className="flex min-h-svh w-full justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-5xl">
        <div className="mb-8 flex flex-col items-start">
          <Badge variant="secondary">Roadmap</Badge>
          <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            What We Are Building In 2026
          </h2>
          <p className="mt-2 text-pretty text-muted-foreground">
            A quarter-by-quarter look at what has shipped and what is coming
            next.
          </p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
          {quarters.map((quarter) => (
            <QuarterColumn key={quarter.label} quarter={quarter} />
          ))}
        </div>
      </div>
    </section>
  )
}
