import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type ChangeType = "Added" | "Improved" | "Fixed"

type Release = {
  version: string
  date: string
  summary: string
  groups: { type: ChangeType; items: string[] }[]
}

const releases: Release[] = [
  {
    version: "2.4.0",
    date: "Jun 18, 2026",
    summary: "Faster search and a refreshed billing experience.",
    groups: [
      {
        type: "Added",
        items: [
          "Command palette now searches across projects, members, and files.",
          "Export any table to CSV from the toolbar.",
        ],
      },
      {
        type: "Improved",
        items: [
          "Billing page loads roughly twice as fast on large workspaces.",
          "Clearer empty states across the dashboard.",
        ],
      },
      {
        type: "Fixed",
        items: ["Resolved a rare sync error when renaming a workspace."],
      },
    ],
  },
  {
    version: "2.3.0",
    date: "May 30, 2026",
    summary: "Team workspaces and role-based access.",
    groups: [
      {
        type: "Added",
        items: [
          "Invite teammates with Admin, Editor, or Viewer roles.",
          "Shared component libraries scoped to a workspace.",
        ],
      },
      {
        type: "Fixed",
        items: [
          "Dark mode contrast on secondary buttons.",
          "Pagination on the activity feed no longer skips a page.",
        ],
      },
    ],
  },
  {
    version: "2.2.1",
    date: "May 12, 2026",
    summary: "Stability and polish.",
    groups: [
      {
        type: "Improved",
        items: ["Keyboard navigation in dialogs and menus."],
      },
      {
        type: "Fixed",
        items: ["A layout shift when toggling the sidebar."],
      },
    ],
  },
]

export default function ChangelogBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-12">
          <Badge variant="outline" className="mb-4">
            Changelog
          </Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight">
            What&apos;s new
          </h2>
          <p className="mt-3 text-muted-foreground">
            Product updates, improvements, and fixes, shipped regularly.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {releases.map((release, i) => (
            <div key={release.version}>
              {i > 0 && <Separator className="mb-10" />}
              <div className="grid gap-x-8 gap-y-5 md:grid-cols-[180px_1fr]">
                <div className="flex flex-col items-start gap-1.5">
                  <Badge variant="secondary" className="font-mono tabular-nums">
                    {release.version}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {release.date}
                  </span>
                  <p className="mt-1 hidden text-sm text-muted-foreground md:block">
                    {release.summary}
                  </p>
                </div>

                <div className="flex flex-col gap-5">
                  {release.groups.map((group) => (
                    <div key={group.type} className="flex flex-col gap-2">
                      <h3 className="font-heading text-sm font-semibold">
                        {group.type}
                      </h3>
                      <ul className="flex flex-col gap-1.5 pl-4.5">
                        {group.items.map((item) => (
                          <li
                            key={item}
                            className="list-disc text-sm/relaxed text-muted-foreground marker:text-muted-foreground/40"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
