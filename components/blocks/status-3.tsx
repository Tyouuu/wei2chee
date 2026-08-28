type DayStatus = "operational" | "degraded" | "outage"

type Day = { status: DayStatus; date: string; note: string }

const DAYS = 90

const dotColor: Record<DayStatus, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  outage: "bg-destructive",
}

const statusLabel: Record<DayStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

// "Today" is anchored to a fixed date so the demo renders deterministically
// (server and client agree, no hydration mismatch).
const TODAY = Date.UTC(2026, 5, 26)
const DAY_MS = 86_400_000

function dateLabel(i: number, MONTHS: string[]): string {
  const d = new Date(TODAY - (DAYS - 1 - i) * DAY_MS)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function buildDays(
  exceptions: Record<number, { status: DayStatus; note: string }>,
  MONTHS: string[]
): Day[] {
  return Array.from({ length: DAYS }, (_, i) => {
    const ex = exceptions[i]
    return {
      status: ex?.status ?? "operational",
      date: dateLabel(i, MONTHS),
      note: ex?.note ?? "No incidents. Service operated normally all day.",
    }
  })
}

/*
  BUILT FROM `MONTHS`, BECAUSE `MONTHS` IS EDITABLE COPY.

  `dateLabel` reads MONTHS, `buildDays` calls it, and `services` was built from
  both at module scope -- off the defaults. The component destructured the
  merged MONTHS and never used it, so an assistant `set_copy` renaming a month
  (「月份改成中文」) wrote the value, reported success, and left every date on
  the page in English. An explicit `services` override still wins outright.
*/
const buildServices = (
  MONTHS: string[],
): { name: string; uptime: string; days: Day[] }[] => [
  {
    name: "API",
    uptime: "99.98%",
    days: buildDays({
      51: {
        status: "degraded",
        note: "Elevated response times for 38 minutes after a slow database query. Resolved by rolling back the query plan.",
      },
    }, MONTHS),
  },
  { name: "Dashboard", uptime: "100%", days: buildDays({}, MONTHS) },
  {
    name: "Webhooks",
    uptime: "99.91%",
    days: buildDays({
      68: {
        status: "outage",
        note: "Delivery outage for 1h 12m during a queue failover. All events were redelivered once service recovered.",
      },
      80: {
        status: "degraded",
        note: "Delayed deliveries for some workspaces over roughly 40 minutes. No events were lost.",
      },
    }, MONTHS),
  },
  { name: "CDN", uptime: "100%", days: buildDays({}, MONTHS) },
]

const services = buildServices(MONTHS)

const legend: DayStatus[] = ["operational", "degraded", "outage"]

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
/*
  ONE TRUTH PER THING.

  `MONTHS` used to be exported as editable copy alongside `services`, and the
  two could disagree: services embeds MONTHS BY VALUE, so an edit to one was
  invisible to the other. The first attempt was
  `override?.services ?? build(MONTHS)`, and that is wrong HERE for a reason
  worth writing down: set_copy saves `{ ...defaults, ...existing }` -- the whole
  copy object -- so after any edit at all, services is present and the derived
  branch can never run.

  So MONTHS is no longer editable copy. services is the single truth, and
  everything inside it stays addressable by the assistant, because set_copy
  validates a dot path against the DEFAULTS and MONTHS still lives inside them.
*/
export const copy = { services, legend }
export type Copy = typeof copy


export default function StatusBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { services, legend } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight">
              Uptime
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              99.97% uptime across all services over the last 90 days.
            </p>
          </div>
          <ul className="flex items-center gap-4">
            {legend.map((status) => (
              <li
                key={status}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className={`size-2 rounded-full ${dotColor[status]}`}
                  aria-hidden="true"
                />
                {statusLabel[status]}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-7 rounded-lg border border-border p-6">
          {services.map((service) => (
            <div key={service.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{service.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {service.uptime}
                </span>
              </div>
              <div className="flex h-8 items-stretch gap-px" aria-hidden="true">
                {service.days.map((day, i) => (
                  <span key={i} className="group relative flex-1">
                    <span
                      className={`block h-full w-full rounded-[1px] ${dotColor[day.status]} opacity-80 transition-opacity group-hover:opacity-100`}
                    />
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 flex-col gap-1.5 rounded-lg border border-border bg-popover p-3 text-left shadow-md group-hover:flex">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-popover-foreground tabular-nums">
                          {day.date}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className={`size-1.5 rounded-full ${dotColor[day.status]}`}
                          />
                          {statusLabel[day.status]}
                        </span>
                      </span>
                      <span className="text-[11px]/relaxed text-muted-foreground">
                        {day.note}
                      </span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>90 Days Ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </section>
  )
}
