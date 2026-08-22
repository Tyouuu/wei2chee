import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ChangeType = "Added" | "Improved" | "Fixed"

type Entry = {
  version: string
  date: string
  type: ChangeType
  title: string
  description: string
}

const entries: Entry[] = [
  {
    version: "2.4.0",
    date: "Jun 18, 2026",
    type: "Added",
    title: "Global command palette",
    description:
      "Press Command K anywhere to jump to projects, members, or files.",
  },
  {
    version: "2.4.0",
    date: "Jun 18, 2026",
    type: "Improved",
    title: "Faster billing page",
    description:
      "Large workspaces now load the billing view about twice as fast.",
  },
  {
    version: "2.3.2",
    date: "Jun 06, 2026",
    type: "Fixed",
    title: "Workspace rename sync",
    description: "Resolved a rare error when renaming a busy workspace.",
  },
  {
    version: "2.3.0",
    date: "May 30, 2026",
    type: "Added",
    title: "Role-based access",
    description: "Invite teammates as Admin, Editor, or Viewer.",
  },
  {
    version: "2.3.0",
    date: "May 30, 2026",
    type: "Improved",
    title: "Keyboard navigation",
    description: "Dialogs and menus are now fully keyboard accessible.",
  },
  {
    version: "2.2.1",
    date: "May 12, 2026",
    type: "Fixed",
    title: "Sidebar layout shift",
    description: "Toggling the sidebar no longer nudges page content.",
  },
]

const typeVariant: Record<ChangeType, "default" | "secondary" | "outline"> = {
  Added: "default",
  Improved: "secondary",
  Fixed: "outline",
}

const tabs: { value: string; label: string; match?: ChangeType }[] = [
  { value: "all", label: "All" },
  { value: "added", label: "Added", match: "Added" },
  { value: "improved", label: "Improved", match: "Improved" },
  { value: "fixed", label: "Fixed", match: "Fixed" },
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
export const copy = { entries, tabs }
export type Copy = typeof copy


function EntryRow({ entry }: { entry: Entry }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-5">
      <div className="flex shrink-0 items-center gap-2.5 sm:w-32 sm:flex-col sm:items-start sm:gap-1">
        <span className="font-mono text-xs font-semibold tabular-nums">
          {entry.version}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {entry.date}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <Badge variant={typeVariant[entry.type]}>{entry.type}</Badge>
          <h3 className="font-heading text-sm font-semibold">{entry.title}</h3>
        </div>
        <p className="text-sm/relaxed text-muted-foreground">
          {entry.description}
        </p>
      </div>
    </div>
  )
}

export default function ChangelogBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { entries, tabs } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <h2 className="font-heading text-2xl font-bold tracking-tight">
            Changelog
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything we have shipped, filterable by type.
          </p>
        </div>

        <Tabs defaultValue="all" className="gap-6">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => {
            const list = tab.match
              ? entries.filter((e) => e.type === tab.match)
              : entries
            return (
              <TabsContent key={tab.value} value={tab.value}>
                <div className="flex flex-col">
                  {list.map((entry, i) => (
                    <div key={`${entry.version}-${entry.title}`}>
                      {i > 0 && <Separator className="my-5" />}
                      <EntryRow entry={entry} />
                    </div>
                  ))}
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      </div>
    </section>
  )
}
