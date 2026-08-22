import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Post = {
  title: string
  excerpt: string
  category: string
  readTime: string
  date: string
  image: string
  author: { name: string; initials: string; avatar: string }
}

const posts: Post[] = [
  {
    title: "Designing for the first five minutes",
    excerpt:
      "Onboarding is the only part of your product every user sees. We rebuilt ours around a single question: what is the smallest win we can deliver today?",
    category: "Product",
    readTime: "6 Min Read",
    date: "Jul 2, 2026",
    image:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=80",
    author: {
      name: "Devon Reyes",
      initials: "DR",
      avatar: "https://i.pravatar.cc/64?img=12",
    },
  },
  {
    title: "The case for boring infrastructure",
    excerpt:
      "Every exciting outage starts with an exciting technology choice. Here is why our platform team keeps reaching for the least novel option on the table.",
    category: "Engineering",
    readTime: "9 Min Read",
    date: "Jun 24, 2026",
    image:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80",
    author: {
      name: "Priya Nair",
      initials: "PN",
      avatar: "https://i.pravatar.cc/64?img=45",
    },
  },
  {
    title: "How we price without a sales team",
    excerpt:
      "Self-serve pricing sounds simple until you write the page. A look at the experiments, the mistakes, and the framework we landed on.",
    category: "Growth",
    readTime: "5 Min Read",
    date: "Jun 15, 2026",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80",
    author: {
      name: "Sam Whitfield",
      initials: "SW",
      avatar: "https://i.pravatar.cc/64?img=59",
    },
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


function PostRow({ post }: { post: Post }) {
  return (
    <Card className="flex-row gap-0 overflow-hidden py-0 transition-colors hover:ring-foreground/25">
      <div className="aspect-[4/3] w-40 shrink-0 overflow-hidden bg-muted sm:w-52">
        <img
          src={post.image}
          alt=""
          className="size-full object-cover grayscale"
          loading="lazy"
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-2 p-5">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{post.category}</Badge>
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
            {post.readTime}
          </span>
        </div>
        <h3 className="font-heading text-base font-semibold tracking-tight text-balance text-foreground">
          {post.title}
        </h3>
        <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
          {post.excerpt}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarImage
              src={post.author.avatar}
              alt={post.author.name}
              className="grayscale"
            />
            <AvatarFallback>{post.author.initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">{post.author.name}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {post.date}
          </span>
        </div>
      </div>
    </Card>
  )
}

export default function BlogBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { posts } = { ...copy, ...override }
  return (
    <section className="flex min-h-svh w-full justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Latest Writing
            </h2>
            <p className="mt-2 text-muted-foreground">
              Notes on building, pricing, and running the product.
            </p>
          </div>
          <Button variant="outline">
            All Posts
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </Button>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {posts.map((post) => (
            <PostRow key={post.title} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}
