const stats = [
  { value: "$2.4B", label: "Revenue processed" },
  { value: "38 ms", label: "Median latency" },
  { value: "99.98%", label: "Uptime last 12 mo" },
  { value: "6,200+", label: "Businesses onboarded" },
]

export default function StatsBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="mb-12 text-center font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Acme by the numbers
        </h2>

        <dl className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:gap-y-0">
          {stats.map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 text-center"
            >
              <dt className="text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
                {value}
              </dt>
              <dd className="text-sm text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
