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

function dateLabel(i: number): string {
  const d = new Date(TODAY - (DAYS - 1 - i) * DAY_MS)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function buildDays(
  exceptions: Record<number, { status: DayStatus; note: string }>
): Day[] {
  return Array.from({ length: DAYS }, (_, i) => {
    const ex = exceptions[i]
    return {
      status: ex?.status ?? "operational",
      date: dateLabel(i),
      note: ex?.note ?? "No incidents. Service operated normally all day.",
    }
  })
}

const services: { name: string; uptime: string; days: Day[] }[] = [
  {
    name: "API",
    uptime: "99.98%",
    days: buildDays({
      51: {
        status: "degraded",
        note: "Elevated response times for 38 minutes after a slow database query. Resolved by rolling back the query plan.",
      },
    }),
  },
  { name: "Dashboard", uptime: "100%", days: buildDays({}) },
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
    }),
  },
  { name: "CDN", uptime: "100%", days: buildDays({}) },
]

const legend: DayStatus[] = ["operational", "degraded", "outage"]

export default function StatusBlock() {
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
