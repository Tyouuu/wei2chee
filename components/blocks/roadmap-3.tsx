"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Status = "Planned" | "In Progress" | "Shipped"

type Contributor = { name: string; src: string }

type Feature = {
  id: string
  title: string
  description: string
  category: string
  status: Status
  votes: number
  progress?: number
  team?: Contributor[]
}

const team: Record<string, Contributor> = {
  ada: { name: "Ada", src: "https://i.pravatar.cc/64?img=47" },
  leo: { name: "Leo", src: "https://i.pravatar.cc/64?img=12" },
  mara: { name: "Mara", src: "https://i.pravatar.cc/64?img=32" },
}

/*
  A FUNCTION, BECAUSE ITS INPUT IS EDITABLE.

  Built once at import with the DEFAULT team baked in by value, while the
  component destructured the MERGED copy and rendered this frozen array -- so
  editing team in the editor changed nothing on the page. `copy` really does
  reach these blocks at runtime (site-block.tsx renders <Block copy={copy} />).

  An explicit features override still wins; features only follows team when the
  customer has not replaced it outright.
*/
const buildFeatures = (team: Record<string, Contributor>): Feature[] => [
  {
    id: "mobile",
    title: "Native mobile apps",
    description: "Offline-first iOS and Android with push notifications.",
    category: "Mobile",
    status: "In Progress",
    votes: 342,
    progress: 72,
    team: [team.ada, team.leo, team.mara],
  },
  {
    id: "dashboards",
    title: "Custom dashboards",
    description: "Build the metric views your team needs with drag and drop.",
    category: "Analytics",
    status: "Planned",
    votes: 218,
  },
  {
    id: "sso",
    title: "SAML single sign-on",
    description: "Enterprise login through your identity provider.",
    category: "Security",
    status: "Planned",
    votes: 156,
  },
  {
    id: "api",
    title: "Public API v2",
    description: "A faster, fully typed API with per-key rate limits.",
    category: "API",
    status: "Shipped",
    votes: 489,
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
const features: Feature[] = buildFeatures(team)

/*
  ONE TRUTH PER THING.

  `team` used to be exported as editable copy alongside `features`, and the
  two could disagree: features embeds team BY VALUE, so an edit to one was
  invisible to the other. The first attempt was
  `override?.features ?? build(team)`, and that is wrong HERE for a reason
  worth writing down: set_copy saves `{ ...defaults, ...existing }` -- the whole
  copy object -- so after any edit at all, features is present and the derived
  branch can never run.

  So team is no longer editable copy. features is the single truth, and
  everything inside it stays addressable by the assistant, because set_copy
  validates a dot path against the DEFAULTS and team still lives inside them.
*/
export const copy = { features }
export type Copy = typeof copy


const statusVariant: Record<Status, "default" | "secondary" | "outline"> = {
  Planned: "outline",
  "In Progress": "secondary",
  Shipped: "default",
}

export default function RoadmapBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { features } = { ...copy, ...override }
  const [voted, setVoted] = React.useState<Record<string, boolean>>({})

  const toggle = (id: string) =>
    setVoted((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Roadmap</CardTitle>
          <CardDescription>
            Vote on what matters most. The features with the most support move
            up the list.
          </CardDescription>
        </CardHeader>

        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {features.map((feature) => {
            const isVoted = voted[feature.id] ?? false
            const count = feature.votes + (isVoted ? 1 : 0)
            return (
              <li key={feature.id} className="flex items-start gap-4 px-6 py-4">
                <button
                  type="button"
                  onClick={() => toggle(feature.id)}
                  aria-pressed={isVoted}
                  aria-label={`Upvote ${feature.title}`}
                  className={cn(
                    "flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-md border py-1.5 text-xs font-medium tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isVoted
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <IconPlaceholder
                    lucide="ChevronUp"
                    tabler="IconChevronUp"
                    hugeicons="ArrowUp01Icon"
                    phosphor="CaretUp"
                    remixicon="RiArrowUpSLine"
                    className="size-4"
                    aria-hidden="true"
                  />
                  {count}
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-sm font-semibold">
                      {feature.title}
                    </h3>
                    <Badge variant={statusVariant[feature.status]}>
                      {feature.status}
                    </Badge>
                    <Badge variant="secondary">{feature.category}</Badge>
                  </div>
                  <p className="text-xs/relaxed text-muted-foreground">
                    {feature.description}
                  </p>

                  {feature.progress != null && (
                    <div className="mt-0.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        {feature.team && (
                          <div className="flex -space-x-2">
                            {feature.team.map((member) => (
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
                        )}
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                          {feature.progress}%
                        </span>
                      </div>
                      <Progress
                        value={feature.progress}
                        aria-label={`${feature.title} progress`}
                      />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
  )
}
