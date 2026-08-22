import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type StatusKey = "operational" | "degraded" | "outage"

const statusConfig: Record<StatusKey, { label: string; dot: string }> = {
  operational: { label: "Operational", dot: "bg-success" },
  degraded: { label: "Degraded", dot: "bg-warning" },
  outage: { label: "Outage", dot: "bg-destructive" },
}

const services: { name: string; status: StatusKey; uptime: string }[] = [
  { name: "API", status: "operational", uptime: "99.99%" },
  { name: "Dashboard", status: "operational", uptime: "99.98%" },
  { name: "Webhooks", status: "operational", uptime: "99.95%" },
  { name: "CDN", status: "operational", uptime: "100%" },
  { name: "Database", status: "operational", uptime: "99.99%" },
]

export default function StatusBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <IconPlaceholder
              lucide="Check"
              tabler="IconCheck"
              hugeicons="Tick02Icon"
              phosphor="Check"
              remixicon="RiCheckLine"
              className="size-6"
              aria-hidden="true"
            />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-lg font-semibold">
              All systems operational
            </h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              As of Jun 26, 2026, 14:32 UTC
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="font-heading text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Services
          </h3>
          <span className="text-xs text-muted-foreground">
            Uptime, last 90 days
          </span>
        </div>

        <ul className="mt-3 flex flex-col rounded-lg border border-border">
          {services.map((service, i) => (
            <li
              key={service.name}
              className={
                i > 0
                  ? "flex items-center justify-between gap-4 border-t border-border px-4 py-3.5"
                  : "flex items-center justify-between gap-4 px-4 py-3.5"
              }
            >
              <span className="text-sm font-medium">{service.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {service.uptime}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className={`size-2 rounded-full ${statusConfig[service.status].dot}`}
                    aria-hidden="true"
                  />
                  {statusConfig[service.status].label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
