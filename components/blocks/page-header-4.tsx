import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const contributors = [
  {
    name: "Mara Lin",
    initials: "ML",
    avatar: "https://i.pravatar.cc/64?img=32",
  },
  {
    name: "Leo Tanaka",
    initials: "LT",
    avatar: "https://i.pravatar.cc/64?img=12",
  },
  {
    name: "Owen Reyes",
    initials: "OR",
    avatar: "https://i.pravatar.cc/64?img=53",
  },
  {
    name: "Priya Nair",
    initials: "PN",
    avatar: "https://i.pravatar.cc/64?img=45",
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
export const copy = { contributors }
export type Copy = typeof copy


export default function PageHeaderBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { contributors } = { ...copy, ...override }
  return (
    <section className="w-full bg-background px-6 py-10 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <IconPlaceholder
            lucide="ArrowLeft"
            tabler="IconArrowLeft"
            hugeicons="ArrowLeftIcon"
            phosphor="ArrowLeft"
            remixicon="RiArrowLeftLine"
            data-icon="inline-start"
            aria-hidden="true"
          />
          Back To Projects
        </Button>

        <div className="mt-4 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                Q3 Marketing Site
              </h1>
              <Badge variant="secondary">Active</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarImage
                    src="https://i.pravatar.cc/64?img=32"
                    alt="Mara Lin"
                    className="grayscale"
                  />
                  <AvatarFallback>ML</AvatarFallback>
                </Avatar>
                <span>
                  Owned by{" "}
                  <span className="font-medium text-foreground">Mara Lin</span>
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <IconPlaceholder
                  lucide="Calendar"
                  tabler="IconCalendar"
                  hugeicons="CalendarIcon"
                  phosphor="Calendar"
                  remixicon="RiCalendarLine"
                  className="size-4"
                  aria-hidden="true"
                />
                Created Jun 3, 2026
              </span>
              <span className="flex items-center gap-2">
                <span className="flex -space-x-2">
                  {contributors.map((person) => (
                    <Avatar
                      key={person.name}
                      className="size-6 ring-2 ring-background"
                    >
                      <AvatarImage
                        src={person.avatar}
                        alt={person.name}
                        className="grayscale"
                      />
                      <AvatarFallback>{person.initials}</AvatarFallback>
                    </Avatar>
                  ))}
                </span>
                4 Contributors
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline">
              <IconPlaceholder
                lucide="Share"
                tabler="IconShare"
                hugeicons="ShareIcon"
                phosphor="Share"
                remixicon="RiShareLine"
                data-icon="inline-start"
                aria-hidden="true"
              />
              Share
            </Button>
            <Button>Edit Project</Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-lg border border-border bg-muted/40"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
