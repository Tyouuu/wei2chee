import { Badge } from "@/components/ui/badge"

type ChangeType = "Added" | "Improved" | "Fixed"

const typeVariant: Record<ChangeType, "default" | "secondary" | "outline"> = {
  Added: "default",
  Improved: "secondary",
  Fixed: "outline",
}

const releases = [
  {
    version: "2.4.0",
    date: "July 18, 2026",
    summary: "Real-time collaboration and a faster editor.",
    changes: [
      {
        type: "Added" as ChangeType,
        text: "Live cursors and presence in the editor.",
      },
      {
        type: "Added" as ChangeType,
        text: "Slash commands for inserting blocks.",
      },
      {
        type: "Improved" as ChangeType,
        text: "Editor now loads 40% faster on large documents.",
      },
      {
        type: "Fixed" as ChangeType,
        text: "Pasted images occasionally lost their aspect ratio.",
      },
    ],
  },
  {
    version: "2.3.1",
    date: "July 2, 2026",
    summary: "Stability fixes and export improvements.",
    changes: [
      {
        type: "Improved" as ChangeType,
        text: "PDF exports now preserve custom fonts.",
      },
      {
        type: "Fixed" as ChangeType,
        text: "Workspace switcher could show stale membership.",
      },
    ],
  },
  {
    version: "2.3.0",
    date: "June 20, 2026",
    summary: "Introducing scheduled reports.",
    changes: [
      {
        type: "Added" as ChangeType,
        text: "Schedule reports to send on a recurring cadence.",
      },
      {
        type: "Improved" as ChangeType,
        text: "Redesigned the notifications center.",
      },
    ],
  },
]

function slug(version: string) {
  return `v${version.replace(/\./g, "-")}`
}

export default function ChangelogBlock() {
  return (
    <section className="w-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Changelog
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            What&apos;s new
          </h1>
          <p className="text-sm text-muted-foreground">
            Every improvement, fix, and new feature we ship to Acme.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-[10rem_1fr]">
          <aside className="hidden md:block">
            <nav className="sticky top-8 flex flex-col gap-1">
              <span className="mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Releases
              </span>
              {releases.map((release) => (
                <a
                  key={release.version}
                  href={`#${slug(release.version)}`}
                  className="flex flex-col border-l border-border py-1 pl-3 text-sm transition-colors hover:border-foreground hover:text-foreground"
                >
                  <span className="font-medium tabular-nums">
                    v{release.version}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {release.date}
                  </span>
                </a>
              ))}
            </nav>
          </aside>

          <div className="flex flex-col gap-12">
            {releases.map((release) => (
              <article
                key={release.version}
                id={slug(release.version)}
                className="flex scroll-mt-8 flex-col gap-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h2 className="font-heading text-xl font-bold tracking-tight tabular-nums">
                      v{release.version}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {release.date}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {release.summary}
                  </p>
                </div>
                <ul className="flex flex-col gap-2.5 border-t border-border pt-4">
                  {release.changes.map((change, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <Badge
                        variant={typeVariant[change.type]}
                        className="mt-0.5 w-20 shrink-0 justify-center text-[11px]"
                      >
                        {change.type}
                      </Badge>
                      <span className="text-foreground">{change.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
