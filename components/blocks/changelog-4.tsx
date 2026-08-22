import { Badge } from "@/components/ui/badge"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type ChangeType = "Added" | "Improved" | "Fixed"

type Release = {
  version: string
  date: string
  title: string
  changes: { type: ChangeType; text: string }[]
}

const typeStyles: Record<ChangeType, string> = {
  Added: "text-success",
  Improved: "text-info",
  Fixed: "text-warning",
}

const releases: Release[] = [
  {
    version: "3.4.0",
    date: "Jul 9, 2026",
    title: "Saved views and faster search",
    changes: [
      {
        type: "Added",
        text: "Save any filtered view and pin it to the sidebar",
      },
      { type: "Improved", text: "Search now returns results in under 100ms" },
      { type: "Fixed", text: "Keyboard shortcuts no longer fire while typing" },
    ],
  },
  {
    version: "3.3.0",
    date: "Jun 28, 2026",
    title: "Team roles and audit log",
    changes: [
      { type: "Added", text: "Granular member roles for owners and editors" },
      { type: "Added", text: "Exportable audit log for the last ninety days" },
      { type: "Improved", text: "Invitations now expire after seven days" },
    ],
  },
  {
    version: "3.2.1",
    date: "Jun 12, 2026",
    title: "Stability and polish",
    changes: [
      { type: "Fixed", text: "Resolved a rare crash when reordering columns" },
      { type: "Improved", text: "Reduced initial bundle size by roughly 18%" },
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
export const copy = { releases }
export type Copy = typeof copy


function ReleaseEntry({ release }: { release: Release }) {
  return (
    <div className="relative flex gap-6 pb-10 last:pb-0">
      <div className="absolute top-2 bottom-0 left-[5px] w-px bg-border" />
      <span className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-foreground ring-4 ring-background" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <Badge className="font-mono">{release.version}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {release.date}
          </span>
        </div>
        <h3 className="mt-3 font-heading text-lg font-semibold tracking-tight text-foreground">
          {release.title}
        </h3>
        <ul className="mt-3 flex flex-col gap-2">
          {release.changes.map((change, i) => (
            <li key={i} className="flex items-baseline gap-2.5 text-sm">
              <span
                className={
                  "w-16 shrink-0 text-xs font-medium " + typeStyles[change.type]
                }
              >
                {change.type}
              </span>
              <span className="text-pretty text-muted-foreground">
                {change.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function ChangelogBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { releases } = { ...copy, ...override }
  return (
    <section className="flex min-h-svh w-full justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-2xl">
        <div className="mb-12 flex flex-col items-start">
          <Badge variant="secondary">
            <IconPlaceholder
              lucide="Flashlight"
              tabler="IconBulb"
              hugeicons="FlashlightIcon"
              phosphor="Flashlight"
              remixicon="RiFlashlightLine"
              data-icon="inline-start"
              aria-hidden="true"
            />
            Changelog
          </Badge>
          <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            What&apos;s New
          </h2>
          <p className="mt-2 text-pretty text-muted-foreground">
            Product updates and improvements, shipped every couple of weeks.
          </p>
        </div>

        <div>
          {releases.map((release) => (
            <ReleaseEntry key={release.version} release={release} />
          ))}
        </div>
      </div>
    </section>
  )
}
