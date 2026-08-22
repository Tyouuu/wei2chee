import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const posts = [
  {
    category: "Engineering",
    title: "How we cut our build times in half",
    excerpt:
      "A deep dive into the caching strategy and dependency graph work that made our CI dramatically faster.",
    author: "Dana Wu",
    date: "Jul 18, 2026",
    read: "6 min read",
  },
  {
    category: "Design",
    title: "Designing empty states that guide, not block",
    excerpt:
      "Empty states are a first impression. Here's the system we use to turn dead ends into next steps.",
    author: "Mia Cho",
    date: "Jul 11, 2026",
    read: "4 min read",
  },
  {
    category: "Product",
    title: "Shipping scheduled reports to every plan",
    excerpt:
      "Why we moved a former enterprise feature into the free tier, and what we learned from the rollout.",
    author: "Ravi Patel",
    date: "Jul 3, 2026",
    read: "5 min read",
  },
]

const categories = [
  { name: "Engineering", count: 24 },
  { name: "Design", count: 18 },
  { name: "Product", count: 15 },
  { name: "Company", count: 9 },
]

const popular = [
  "A field guide to design tokens",
  "Our approach to accessible components",
  "Scaling Postgres past a billion rows",
]

const tags = ["React", "Tailwind", "TypeScript", "Design systems", "DX", "CI"]

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
export const copy = { posts, categories, popular, tags }
export type Copy = typeof copy


export default function BlogBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { posts, categories, popular, tags } = { ...copy, ...override }
  return (
    <section className="w-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Blog
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Notes from the team
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_16rem]">
          <div className="flex flex-col divide-y divide-border">
            {posts.map((post) => (
              <article
                key={post.title}
                className="flex flex-col gap-3 py-6 first:pt-0"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{post.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {post.date} / {post.read}
                  </span>
                </div>
                <a href="#" className="group flex flex-col gap-2">
                  <h2 className="font-heading text-xl font-bold tracking-tight transition-colors group-hover:text-muted-foreground">
                    {post.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>
                </a>
                <span className="text-xs text-muted-foreground">
                  By{" "}
                  <span className="font-medium text-foreground">
                    {post.author}
                  </span>
                </span>
              </article>
            ))}
          </div>

          <aside className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
            <div className="relative">
              <IconPlaceholder
                lucide="Search"
                tabler="IconSearch"
                hugeicons="SearchIcon"
                phosphor="MagnifyingGlass"
                remixicon="RiSearchLine"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search articles..."
                className="pl-8"
                aria-label="Search articles"
              />
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="font-heading text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Categories
              </h3>
              <ul className="flex flex-col gap-1">
                {categories.map((category) => (
                  <li key={category.name}>
                    <a
                      href="#"
                      className="flex items-center justify-between py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {category.name}
                      <span className="tabular-nums">{category.count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <h3 className="font-heading text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Popular
              </h3>
              <ul className="flex flex-col gap-2.5">
                {popular.map((title) => (
                  <li key={title}>
                    <a
                      href="#"
                      className="text-sm text-foreground transition-colors hover:text-muted-foreground"
                    >
                      {title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="font-heading text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
