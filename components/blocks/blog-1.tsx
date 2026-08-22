import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const posts = [
  {
    category: "Engineering",
    title: "How we cut API latency by 60% with edge caching",
    excerpt:
      "Our monolith was fast enough, until it wasn't. We traced the bottleneck to cold database reads on every request and rearchitected our caching layer in three weeks.",
    author: {
      name: "Lena Park",
      initials: "LP",
      avatar: "https://i.pravatar.cc/150?img=45",
    },
    date: "Jun 9, 2026",
    readTime: "7 Min Read",
    image:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    imageAlt: "Server rack with blinking lights in a data center",
  },
  {
    category: "Design",
    title: "Building a token system that survives a rebrand",
    excerpt:
      "Semantic tokens feel abstract until the day your brand color changes. We share the naming conventions and tooling that let us ship a full rebrand in under two days.",
    author: {
      name: "Marcus Webb",
      initials: "MW",
      avatar: "https://i.pravatar.cc/150?img=12",
    },
    date: "May 28, 2026",
    readTime: "5 Min Read",
    image:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
    imageAlt: "Colour swatches and design tokens spread on a desk",
  },
  {
    category: "Product",
    title: "What 1,200 user interviews taught us about onboarding",
    excerpt:
      "Drop-off at step two turned out to have nothing to do with the UI. Listening to customers revealed a mismatch between our mental model and theirs. Here's how we fixed it.",
    author: {
      name: "Sofia Andrade",
      initials: "SA",
      avatar: "https://i.pravatar.cc/150?img=32",
    },
    date: "May 14, 2026",
    readTime: "9 Min Read",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80",
    imageAlt: "Two people in a user research interview session",
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
export const copy = { posts }
export type Copy = typeof copy


export default function BlogBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { posts } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Blog
            </span>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              From the Acme team
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="group w-fit gap-1.5 transition-colors"
          >
            All Articles
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
              size={15}
            />
          </Button>
        </div>

        <Separator className="my-8" />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {posts.map((post) => (
            <Card
              key={post.title}
              className="group flex flex-col overflow-hidden border-border pt-0 transition-shadow duration-200 hover:shadow-md"
            >
              <div className="aspect-[16/9] w-full overflow-hidden border-b border-border bg-muted">
                <img
                  src={post.image}
                  alt={post.imageAlt}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>

              <CardHeader className="gap-2 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className="text-[11px] font-semibold tracking-wide uppercase"
                  >
                    {post.category}
                  </Badge>
                  <span className="flex shrink-0 items-center gap-1 text-xs leading-none text-muted-foreground">
                    <IconPlaceholder
                      lucide="Clock"
                      tabler="IconClock"
                      hugeicons="TimeIcon"
                      phosphor="Clock"
                      remixicon="RiTimeLine"
                      size={11}
                      className="shrink-0"
                    />
                    {post.readTime}
                  </span>
                </div>
                <CardTitle className="text-base leading-snug font-semibold">
                  {post.title}
                </CardTitle>
                <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                  {post.excerpt}
                </CardDescription>
              </CardHeader>

              <CardContent className="mt-auto pt-0 pb-0" />

              <CardFooter className="border-t border-border pt-4 pb-4">
                <div className="flex w-full items-center gap-3">
                  <Avatar size="sm">
                    <AvatarImage
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="grayscale"
                    />
                    <AvatarFallback className="text-xs">
                      {post.author.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {post.author.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <time dateTime={post.date}>{post.date}</time>
                    </span>
                  </div>
                  <IconPlaceholder
                    lucide="ArrowRight"
                    tabler="IconArrowRight"
                    hugeicons="ArrowRightIcon"
                    phosphor="ArrowRight"
                    remixicon="RiArrowRightLine"
                    size={14}
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
