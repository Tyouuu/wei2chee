import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const tags = ["Culture", "Remote Work", "Leadership"]

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
export const copy = { tags }
export type Copy = typeof copy


export default function ArticleBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { tags } = { ...copy, ...override }
  return (
    <section className="flex min-h-svh w-full flex-col items-center bg-background px-6 py-16 text-foreground">
      <header className="flex w-full max-w-3xl flex-col items-center text-center">
        <Badge variant="secondary">Culture</Badge>
        <h1 className="mt-5 font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          The quiet meeting: how we replaced status updates with writing
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
          Six months ago we deleted the daily standup. Here is what a written,
          asynchronous cadence did to our focus, our decisions, and our
          calendar.
        </p>

        <div className="mt-7 flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage
              src="https://i.pravatar.cc/80?img=32"
              alt="Mara Ellison"
              className="grayscale"
            />
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium">Mara Ellison</span>
            <span className="text-xs text-muted-foreground">
              Head of Operations
            </span>
          </div>
          <Separator orientation="vertical" className="mx-1 !h-8" />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconPlaceholder
              lucide="Clock"
              tabler="IconClock"
              hugeicons="TimeIcon"
              phosphor="Clock"
              remixicon="RiTimeLine"
              className="size-3.5 shrink-0"
              aria-hidden="true"
            />
            9 Min Read
          </span>
        </div>
      </header>

      <div className="mt-10 aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-muted">
        <img
          src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1600&q=80"
          alt="An empty, sunlit open-plan office"
          className="size-full object-cover grayscale"
          loading="lazy"
        />
      </div>

      <article className="mt-12 w-full max-w-2xl">
        <div className="flex flex-col gap-5 text-[15px]/relaxed text-foreground/80">
          <p className="first-letter:float-left first-letter:mr-3 first-letter:text-6xl first-letter:leading-[0.7] first-letter:font-bold first-letter:text-foreground">
            For years the standup was sacred. Fifteen minutes, cameras on,
            everyone reciting what they did yesterday. It felt productive, and
            that was exactly the problem. We were performing progress instead of
            making it.
          </p>

          <h2 className="mt-4 font-heading text-xl font-semibold tracking-tight text-foreground">
            What we changed
          </h2>
          <p>
            Each morning every person writes three lines in a shared thread:
            what moved, what is stuck, and where they need a decision. No
            meeting, no waiting for a turn to speak. The whole team reads it
            over coffee and replies where it matters.
          </p>

          <blockquote className="my-3 border-y border-border py-6 text-center text-xl font-medium tracking-tight text-balance text-foreground">
            &ldquo;A meeting interrupts everyone at once. A written update lets
            each person choose when to be interrupted.&rdquo;
          </blockquote>

          <h2 className="mt-4 font-heading text-xl font-semibold tracking-tight text-foreground">
            The results
          </h2>
          <p>
            The calendar was the first thing to change. Mornings opened up, and
            deep work stopped competing with a recurring block at ten. But the
            larger shift was in the quality of our decisions, which now arrive
            with context attached rather than half-remembered from a call.
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground/40">
            <li>Recurring meeting time fell by roughly six hours per person</li>
            <li>Decisions are searchable, with the reasoning kept alongside</li>
            <li>
              New hires onboard by reading, not by asking the same questions
            </li>
          </ul>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm">
              <IconPlaceholder
                lucide="Bookmark"
                tabler="IconBookmark"
                hugeicons="BookmarkIcon"
                phosphor="Bookmark"
                remixicon="RiBookmarkLine"
                data-icon="inline-start"
                aria-hidden="true"
              />
              Save
            </Button>
            <Button variant="ghost" size="sm">
              <IconPlaceholder
                lucide="Share"
                tabler="IconShare"
                hugeicons="ShareIcon"
                phosphor="Share"
                remixicon="RiShareForwardLine"
                data-icon="inline-start"
                aria-hidden="true"
              />
              Share
            </Button>
          </div>
        </div>
      </article>
    </section>
  )
}
