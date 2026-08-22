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

const features: Feature[] = [
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

const statusVariant: Record<Status, "default" | "secondary" | "outline"> = {
  Planned: "outline",
  "In Progress": "secondary",
  Shipped: "default",
}

export default function RoadmapBlock() {
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
