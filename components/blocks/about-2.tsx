import { Badge } from "@/components/ui/badge"

const stats = [
  { value: "12K+", label: "Teams onboard" },
  { value: "99.9%", label: "Uptime" },
  { value: "40+", label: "Countries" },
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
export const copy = { stats }
export type Copy = typeof copy


export default function AboutBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { stats } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className="relative overflow-hidden rounded-xl border border-border">
          <img
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
            alt="The Acme team collaborating in the office"
            className="aspect-[4/3] w-full object-cover grayscale"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/50 via-background/5 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 ring-1 ring-foreground/10 ring-inset"
          />
        </div>

        <div className="flex flex-col">
          <Badge variant="outline" className="mb-4 w-fit">
            Our story
          </Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-balance">
            From a side project to a platform teams trust
          </h2>
          <div className="mt-5 flex flex-col gap-4 text-[15px]/relaxed text-muted-foreground">
            <p>
              We were two engineers tired of rebuilding the same interfaces on
              every project. So we started collecting the patterns that worked
              and shaped them into something anyone could reach for.
            </p>
            <p>
              Seven years later, that collection has grown into a platform used
              by teams in more than forty countries, from solo founders to
              enterprises shipping at scale.
            </p>
          </div>

          <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <dt className="order-2 text-xs text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="order-1 text-2xl font-bold tracking-tight tabular-nums">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
