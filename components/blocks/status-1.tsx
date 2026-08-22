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
export const copy = { services }
export type Copy = typeof copy


export default function StatusBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { services } = { ...copy, ...override }
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
