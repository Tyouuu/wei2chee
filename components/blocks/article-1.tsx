import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const tags = ["Engineering", "Performance", "Databases"]

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
    <section className="flex min-h-svh w-full justify-center bg-background px-6 py-16 text-foreground">
      <article className="w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Badge variant="secondary">Engineering</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            Jun 18, 2026
          </span>
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          How we cut API latency by 60% in three weeks
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A look at the cold-read bottleneck that was quietly slowing every
          request, and the caching layer we built to fix it.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage
              src="https://i.pravatar.cc/80?img=45"
              alt="Lena Park"
              className="grayscale"
            />
            <AvatarFallback>LP</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Lena Park</span>
            <span className="text-xs text-muted-foreground">
              Staff Engineer
            </span>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconPlaceholder
              lucide="Clock"
              tabler="IconClock"
              hugeicons="TimeIcon"
              phosphor="Clock"
              remixicon="RiTimeLine"
              className="size-3.5 shrink-0"
              aria-hidden="true"
            />
            7 Min Read
          </span>
        </div>

        <div className="mt-8 aspect-[16/9] w-full overflow-hidden rounded-lg border border-border bg-muted">
          <img
            src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80"
            alt="Server racks in a data center"
            className="size-full object-cover grayscale"
            loading="lazy"
          />
        </div>

        <div className="mt-8 flex flex-col gap-5 text-[15px]/relaxed text-foreground/80">
          <p>
            Our monolith was fast enough, until it wasn&apos;t. As traffic grew,
            p95 response times crept past a second and our dashboards lit up
            during every morning spike. The culprit was not the code we
            expected.
          </p>

          <h2 className="mt-4 font-heading text-xl font-semibold tracking-tight text-foreground">
            Finding the bottleneck
          </h2>
          <p>
            Tracing a single slow request end to end revealed that nearly every
            call hit the database for data that almost never changed. We were
            paying for cold reads on settings, feature flags, and plan limits
            thousands of times a minute.
          </p>

          <blockquote className="border-l-2 border-foreground/30 pl-4 text-foreground italic">
            &ldquo;The fastest query is the one you never make. Caching is not
            an optimization, it is a design decision.&rdquo;
          </blockquote>

          <h2 className="mt-4 font-heading text-xl font-semibold tracking-tight text-foreground">
            The fix
          </h2>
          <p>
            We introduced a small read-through cache in front of the hot tables
            with a per-key TTL and explicit invalidation on writes. The rollout
            was gradual, table by table, so we could measure the impact at each
            step.
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground/40">
            <li>p95 latency dropped from 980ms to 390ms</li>
            <li>Database load fell by roughly half at peak</li>
            <li>No change to application code beyond the cache wrapper</li>
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
            <span className="mr-1 text-xs text-muted-foreground">Share</span>
            <Button variant="ghost" size="icon-sm" aria-label="Copy link">
              <IconPlaceholder
                lucide="Link"
                tabler="IconLink"
                hugeicons="LinkIcon"
                phosphor="Link"
                remixicon="RiLinkM"
                aria-hidden="true"
              />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Share on X">
              <XOutlineMark aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Share On LinkedIn"
            >
              <LinkedinBoxOutlineMark aria-hidden="true" />
            </Button>
          </div>
        </div>
      </article>
    </section>
  )
}

// Brand marks are inlined rather than imported from an icon library: the rest
// of this file uses IconPlaceholder, which resolves to whichever icon set the
// consumer already has, and one brand import would drag a whole extra package
// into their install for a handful of glyphs.
type MarkProps = React.ComponentProps<"svg"> & { size?: number | string }

function LinkedinBoxOutlineMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.00098 3H20.001C20.5533 3 21.001 3.44772 21.001 4V20C21.001 20.5523 20.5533 21 20.001 21H4.00098C3.44869 21 3.00098 20.5523 3.00098 20V4C3.00098 3.44772 3.44869 3 4.00098 3ZM5.00098 5V19H19.001V5H5.00098ZM7.50098 9C6.67255 9 6.00098 8.32843 6.00098 7.5C6.00098 6.67157 6.67255 6 7.50098 6C8.3294 6 9.00098 6.67157 9.00098 7.5C9.00098 8.32843 8.3294 9 7.50098 9ZM6.50098 10H8.50098V17.5H6.50098V10ZM12.001 10.4295C12.5854 9.86534 13.2665 9.5 14.001 9.5C16.072 9.5 17.501 11.1789 17.501 13.25V17.5H15.501V13.25C15.501 12.2835 14.7175 11.5 13.751 11.5C12.7845 11.5 12.001 12.2835 12.001 13.25V17.5H10.001V10H12.001V10.4295Z" />
    </svg>
  )
}

function XOutlineMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M10.4883 14.651L15.25 21H22.25L14.3917 10.5223L20.9308 3H18.2808L13.1643 8.88578L8.75 3H1.75L9.26086 13.0145L2.31915 21H4.96917L10.4883 14.651ZM16.25 19L5.75 5H7.75L18.25 19H16.25Z" />
    </svg>
  )
}
