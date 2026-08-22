import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"
import type * as React from "react"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

/** An icon held in data and rendered later, e.g. `<item.icon className="size-4" />`. */
type IconRenderer = (props: IconProps) => React.ReactNode

type Contributor = { name: string; src: string }

type Item = {
  title: string
  description: string
  tag: string
  votes?: number
  progress?: number
  shipped?: string
  team?: Contributor[]
}

const team: Record<string, Contributor> = {
  ada: { name: "Ada", src: "https://i.pravatar.cc/64?img=47" },
  leo: { name: "Leo", src: "https://i.pravatar.cc/64?img=12" },
  mara: { name: "Mara", src: "https://i.pravatar.cc/64?img=32" },
  owen: { name: "Owen", src: "https://i.pravatar.cc/64?img=53" },
}

const columns: {
  status: string
  icon: IconRenderer
  items: Item[]
}[] = [
  {
    status: "Planned",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Lightbulb"
        tabler="IconBulb"
        hugeicons="Idea01Icon"
        phosphor="Lightbulb"
        remixicon="RiLightbulbLine"
        {...p}
      />
    ),
    items: [
      {
        title: "Custom dashboards",
        description: "Drag-and-drop widgets to build the view your team needs.",
        tag: "Analytics",
        votes: 218,
      },
      {
        title: "SAML single sign-on",
        description: "Enterprise login with your existing identity provider.",
        tag: "Security",
        votes: 156,
      },
      {
        title: "Public API v2",
        description: "A faster, fully typed API with per-key rate limits.",
        tag: "API",
        votes: 132,
      },
    ],
  },
  {
    status: "In Progress",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="LoaderCircle"
        tabler="IconLoader2"
        hugeicons="Loading03Icon"
        phosphor="Spinner"
        remixicon="RiLoader4Line"
        {...p}
      />
    ),
    items: [
      {
        title: "Mobile app",
        description: "Native iOS and Android apps with offline support.",
        tag: "Mobile",
        progress: 72,
        team: [team.ada, team.leo, team.mara],
      },
      {
        title: "Audit log export",
        description: "Stream workspace activity to your SIEM of choice.",
        tag: "Security",
        progress: 41,
        team: [team.owen, team.ada],
      },
    ],
  },
  {
    status: "Shipped",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Check"
        tabler="IconCheck"
        hugeicons="Tick02Icon"
        phosphor="Check"
        remixicon="RiCheckLine"
        {...p}
      />
    ),
    items: [
      {
        title: "Command palette",
        description: "Jump anywhere with Command K across your workspace.",
        tag: "Productivity",
        shipped: "Jun 2026",
        team: [team.leo, team.mara],
      },
      {
        title: "Role-based access",
        description: "Admin, Editor, and Viewer roles for every member.",
        tag: "Security",
        shipped: "May 2026",
        team: [team.ada, team.owen],
      },
    ],
  },
]

function AvatarStack({ members }: { members: Contributor[] }) {
  return (
    <div className="flex -space-x-2">
      {members.map((member) => (
        <Avatar key={member.name} className="size-6 border-2 border-card">
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
  )
}

export default function RoadmapBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-10">
          <Badge variant="outline" className="mb-4">
            Roadmap
          </Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight">
            What we&apos;re building
          </h2>
          <p className="mt-3 text-muted-foreground">
            A look at what is planned, in progress, and recently shipped.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {columns.map((column) => (
            <div key={column.status} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <column.icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h3 className="font-heading text-sm font-semibold">
                  {column.status}
                </h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {column.items.length}
                </span>
              </div>

              <ul className="flex flex-col gap-3">
                {column.items.map((item) => (
                  <li
                    key={item.title}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
                  >
                    <div className="flex flex-col gap-2">
                      <Badge variant="secondary" className="w-fit">
                        {item.tag}
                      </Badge>
                      <h4 className="font-heading text-sm font-semibold">
                        {item.title}
                      </h4>
                      <p className="text-xs/relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>

                    {item.progress != null && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                          {item.team && <AvatarStack members={item.team} />}
                          <span className="text-xs font-medium text-muted-foreground tabular-nums">
                            {item.progress}%
                          </span>
                        </div>
                        <Progress
                          value={item.progress}
                          aria-label={`${item.title} progress`}
                        />
                      </div>
                    )}

                    {item.votes != null && (
                      <Badge variant="outline" className="w-fit gap-1">
                        <IconPlaceholder
                          lucide="ChevronUp"
                          tabler="IconChevronUp"
                          hugeicons="ArrowUp01Icon"
                          phosphor="CaretUp"
                          remixicon="RiArrowUpSLine"
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        {item.votes}
                      </Badge>
                    )}

                    {item.shipped != null && (
                      <div className="flex items-center justify-between gap-3">
                        {item.team && <AvatarStack members={item.team} />}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <IconPlaceholder
                            lucide="Check"
                            tabler="IconCheck"
                            hugeicons="Tick02Icon"
                            phosphor="Check"
                            remixicon="RiCheckLine"
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {item.shipped}
                        </span>
                      </div>
                    )}
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
