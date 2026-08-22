import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const stats = [
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
    value: "48,920",
    label: "Monthly active users",
    delta: "+12.5%",
    trend: "up" as const,
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="ShoppingBag"
        tabler="IconShoppingBag"
        hugeicons="ShoppingBagIcon"
        phosphor="ShoppingBag"
        remixicon="RiShoppingBag3Line"
        {...p}
      />
    ),
    value: "$182k",
    label: "Net revenue",
    delta: "+8.1%",
    trend: "up" as const,
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Activity"
        tabler="IconActivity"
        hugeicons="PulseIcon"
        phosphor="Pulse"
        remixicon="RiPulseLine"
        {...p}
      />
    ),
    value: "3.2%",
    label: "Churn rate",
    delta: "-1.4%",
    trend: "down" as const,
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
    value: "412 ms",
    label: "Avg response time",
    delta: "-3.2%",
    trend: "down" as const,
  },
]

export default function StatsBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            This quarter
          </span>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Performance at a glance
          </h2>
          <p className="mt-3 text-muted-foreground">
            Key metrics across growth, revenue, and reliability, refreshed every
            hour.
          </p>
        </div>

        <dl className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {stats.map(({ icon: Icon, value, label, delta, trend }) => (
            <div
              key={label}
              className="flex flex-col rounded-lg border border-border bg-card p-6"
            >
              <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <dt className="mt-6 text-3xl font-bold tracking-tight tabular-nums">
                {value}
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">{label}</dd>
              <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">
                {trend === "up" ? (
                  <IconPlaceholder
                    lucide="ArrowUp"
                    tabler="IconArrowUp"
                    hugeicons="ArrowUpIcon"
                    phosphor="ArrowUp"
                    remixicon="RiArrowUpLine"
                    className="size-4"
                    aria-hidden="true"
                  />
                ) : (
                  <IconPlaceholder
                    lucide="ArrowDown"
                    tabler="IconArrowDown"
                    hugeicons="ArrowDownIcon"
                    phosphor="ArrowDown"
                    remixicon="RiArrowDownLine"
                    className="size-4"
                    aria-hidden="true"
                  />
                )}
                <span className="font-medium tabular-nums">{delta}</span>
                <span>vs last quarter</span>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
