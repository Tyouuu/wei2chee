import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const events: {
  year: string
  title: string
  copy: string
  tag: string
}[] = [
  {
    year: "2021",
    title: "The first commit",
    copy: "Acme started as a weekend project to standardize the UI patterns our team rebuilt on every new app.",
    tag: "Origin",
  },
  {
    year: "2022",
    title: "Open sourced",
    copy: "We released the core library under MIT and the community doubled the block count within six months.",
    tag: "Community",
  },
  {
    year: "2023",
    title: "Series A",
    copy: "Fresh funding let us grow the design team and commit to a flawless light and dark experience everywhere.",
    tag: "Growth",
  },
  {
    year: "2024",
    title: "100k installs",
    copy: "Blocks crossed one hundred thousand installs through the CLI, spanning marketing sites and full SaaS apps.",
    tag: "Milestone",
  },
  {
    year: "2025",
    title: "Going global",
    copy: "Localized docs and a worldwide contributor program brought Acme to teams in more than forty countries.",
    tag: "Today",
  },
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
export const copy = { events }
export type Copy = typeof copy


export default function TimelineBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { events } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-14 text-center">
          <Badge variant="outline" className="mb-4">
            Our Story
          </Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight">
            Five years in the making
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            A look back at the moments that brought Acme to where it is today.
          </p>
        </div>

        <ol className="relative flex flex-col gap-12">
          {/* Spine: left on mobile, centered on md+ */}
          <span
            className="absolute top-2 bottom-2 left-3 w-px bg-border md:left-1/2 md:-translate-x-1/2"
            aria-hidden="true"
          />

          {events.map((event, i) => {
            const right = i % 2 === 1
            return (
              <li
                key={event.year}
                className="relative flex items-start md:grid md:grid-cols-2 md:gap-x-12"
              >
                {/* Node dot on the spine */}
                <span
                  className="absolute top-1.5 left-3 z-10 size-2.5 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background md:left-1/2"
                  aria-hidden="true"
                />

                <div
                  className={cn(
                    "pl-10 md:pl-0",
                    right
                      ? "md:col-start-2 md:pl-12 md:text-left"
                      : "md:col-start-1 md:pr-12 md:text-right"
                  )}
                >
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2.5",
                      !right && "md:justify-end"
                    )}
                  >
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {event.year}
                    </span>
                    <Badge variant="secondary">{event.tag}</Badge>
                  </div>
                  <h3 className="mt-2 font-heading text-base font-semibold">
                    {event.title}
                  </h3>
                  <p className="mt-1.5 text-sm/relaxed text-muted-foreground">
                    {event.copy}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
