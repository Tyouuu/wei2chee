const stats = [
  { value: "99.99%", label: "Uptime across all regions" },
  { value: "12M+", label: "Requests handled every day" },
  { value: "180ms", label: "Median global response time" },
  { value: "40+", label: "Countries with edge presence" },
]

export default function Stats() {
  return (
    <section className="flex w-full items-center justify-center px-6 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-xl bg-primary px-6 py-14 text-primary-foreground sm:px-12">
          <div className="mx-auto max-w-xl text-center">
            <span className="mb-4 block text-xs font-semibold tracking-widest text-primary-foreground/70 uppercase">
              By The Numbers
            </span>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Built for scale from day one
            </h2>
            <p className="mt-4 text-sm text-primary-foreground/70">
              The numbers behind a platform teams rely on in production.
            </p>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-y-10 lg:grid-cols-4">
            {stats.map(({ value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 text-center"
              >
                <dt className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                  {value}
                </dt>
                <dd className="max-w-[12rem] text-xs text-primary-foreground/70">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
