import { Badge } from "@/components/ui/badge"

const stats = [
  { value: "2019", label: "Founded" },
  { value: "12K+", label: "Customers" },
  { value: "40", label: "Countries" },
  { value: "85", label: "Team members" },
]

export default function AboutBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-3xl text-center">
        <Badge variant="outline" className="mb-6">
          About us
        </Badge>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          We are building the tools we always wished we had
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg/relaxed text-pretty text-muted-foreground">
          Acme started with a simple belief: building software should feel fast
          and joyful. Today we help thousands of teams ship better products,
          faster, without the busywork that slows great ideas down.
        </p>

        <dl className="mt-12 grid grid-cols-2 gap-8 border-t border-border pt-10 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1.5">
              <dt className="order-2 text-sm text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="order-1 text-3xl font-bold tracking-tight tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
