import { Badge } from "@/components/ui/badge"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const tiles = [
  {
    id: "observability",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="ChartBar"
        tabler="IconChartBar"
        hugeicons="BarChartIcon"
        phosphor="ChartBar"
        remixicon="RiBarChartBoxLine"
        {...p}
      />
    ),
    category: "Observability",
    title: "Full-stack visibility",
    description:
      "Trace every request end-to-end and surface bottlenecks before they reach users.",
  },
  {
    id: "infrastructure",
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
    category: "Infrastructure",
    title: "On-demand compute",
    description:
      "Auto-scale servers in 14 regions with zero configuration and sub-second provisioning.",
  },
  {
    id: "security",
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
    category: "Security",
    title: "Defence in depth",
    description:
      "SOC 2 Type II controls, mutual TLS, and role-based access enforced at every layer.",
  },
  {
    id: "integrations",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Layers"
        tabler="IconStack"
        hugeicons="Layers01Icon"
        phosphor="Stack"
        remixicon="RiStackLine"
        {...p}
      />
    ),
    category: "Integrations",
    title: "Connect anything",
    description:
      "200+ pre-built connectors and a unified webhook bus for tools your team already uses.",
  },
]

export default function BentoBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Built for every layer of the stack
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Acme ships four core capabilities so you never have to stitch
            together another vendor.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {tiles.map(({ id, icon: Icon, category, title, description }) => (
            <div key={id} className="flex flex-col gap-5 bg-card p-8">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-12 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-6 text-foreground" aria-hidden="true" />
                </span>
                <Badge variant="secondary">{category}</Badge>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-heading text-lg leading-snug font-semibold">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
