import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type Contributor = { name: string; src: string }

type Item = {
  title: string
  description: string
  progress?: number
  votes?: number
  team?: Contributor[]
}

type Phase = {
  id: string
  label: string
  caption: string
  target: string
  tone: "active" | "upcoming" | "future"
  items: Item[]
}

const team: Record<string, Contributor> = {
  ada: { name: "Ada", src: "https://i.pravatar.cc/64?img=47" },
  leo: { name: "Leo", src: "https://i.pravatar.cc/64?img=12" },
  mara: { name: "Mara", src: "https://i.pravatar.cc/64?img=32" },
  owen: { name: "Owen", src: "https://i.pravatar.cc/64?img=53" },
}

/*
  A FUNCTION, BECAUSE ITS INPUT IS EDITABLE.

  Built once at import with the DEFAULT team baked in by value, while the
  component destructured the MERGED copy and rendered this frozen array -- so
  editing team in the editor changed nothing on the page. `copy` really does
  reach these blocks at runtime (site-block.tsx renders <Block copy={copy} />).

  An explicit phases override still wins; phases only follows team when the
  customer has not replaced it outright.
*/
const buildPhases = (team: Record<string, Contributor>): Phase[] => [
  {
    id: "now",
    label: "Now",
    caption: "In active development",
    target: "June 2026",
    tone: "active",
    items: [
      {
        title: "Native mobile apps",
        description:
          "Offline-first iOS and Android with real-time sync and push.",
        progress: 72,
        team: [team.ada, team.leo, team.mara],
      },
      {
        title: "Audit log export",
        description: "Stream workspace activity to your SIEM in real time.",
        progress: 41,
        team: [team.owen, team.ada],
      },
    ],
  },
  {
    id: "next",
    label: "Next",
    caption: "Up next",
    target: "September 2026",
    tone: "upcoming",
    items: [
      {
        title: "Custom dashboards",
        description: "Compose the metric views your team cares about.",
        votes: 218,
      },
      {
        title: "Public API v2",
        description: "A faster, fully typed API with per-key rate limits.",
        votes: 173,
      },
    ],
  },
  {
    id: "later",
    label: "Later",
    caption: "On the horizon",
    target: "April 2027",
    tone: "future",
    items: [
      {
        title: "Workflow automation",
        description: "Trigger actions from events without writing code.",
        votes: 94,
      },
    ],
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
const phases: Phase[] = buildPhases(team)

export const copy = { team, phases }
export type Copy = typeof copy


const dotTone: Record<Phase["tone"], string> = {
  active: "bg-primary",
  upcoming: "bg-muted-foreground/60",
  future: "border border-muted-foreground/50",
}

export default function RoadmapBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { team } = { ...copy, ...override }
  const phases = override?.phases ?? buildPhases(team)
  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10">
          <Badge variant="outline" className="mb-4">
            Roadmap
          </Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight">
            Where we are headed
          </h2>
          <p className="mt-3 text-muted-foreground">
            What the team is building now and what comes next. Priorities shift
            as we learn from your feedback.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {phases.map((phase) => (
            <div key={phase.id} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn("size-2.5 rounded-full", dotTone[phase.tone])}
                  aria-hidden="true"
                />
                <h3 className="font-heading text-base font-semibold tracking-tight">
                  {phase.label}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {phase.caption}
                </span>
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  {phase.target}
                </span>
              </div>

              <ul className="flex flex-col gap-3">
                {phase.items.map((item) => (
                  <li
                    key={item.title}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
                  >
                    <div>
                      <h4 className="font-heading text-sm font-semibold">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-xs/relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>

                    {item.progress != null ? (
                      <div className="mt-0.5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex -space-x-2">
                            {item.team?.map((member) => (
                              <Avatar
                                key={member.name}
                                className="size-6 border-2 border-card"
                              >
                                <AvatarImage
                                  src={member.src}
                                  alt={member.name}
                                  className="grayscale"
                                />
                                <AvatarFallback className="text-[10px]">
                                  {member.name[0]}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground tabular-nums">
                            {item.progress}%
                          </span>
                        </div>
                        <Progress
                          value={item.progress}
                          aria-label={`${item.title} progress`}
                        />
                      </div>
                    ) : item.votes != null ? (
                      <Badge variant="outline" className="w-fit">
                        {item.votes} Votes
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
