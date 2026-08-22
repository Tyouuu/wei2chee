import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const posts = [
  {
    category: "Engineering",
    title: "Migrating 40 million rows to a new schema without downtime",
    excerpt:
      "Zero-downtime migrations sound impossible at scale, until you break them into reversible, backfill-first steps. Here is the playbook we used to move our largest table live in production.",
    author: {
      name: "James Okafor",
      initials: "JO",
      avatar: "https://i.pravatar.cc/150?u=james-okafor",
    },
    date: "Jun 12, 2026",
    readTime: "9 Min Read",
    featured: true,
  },
  {
    category: "Design",
    title: "Why we ditched our icon font and never looked back",
    excerpt:
      "Icon fonts were convenient in 2014. Today they introduce accessibility gaps, inconsistent rendering, and painful bundle overhead. We switched to inline SVGs and measured every tradeoff.",
    author: {
      name: "Priya Nair",
      initials: "PN",
      avatar: "https://i.pravatar.cc/150?u=priya-nair",
    },
    date: "May 30, 2026",
    readTime: "6 Min Read",
    featured: false,
  },
  {
    category: "Security",
    title: "How we responded to a third-party supply-chain incident",
    excerpt:
      "When a dependency we trusted was compromised upstream, we had 90 minutes to assess impact, isolate affected services, and communicate clearly with customers. A candid post-mortem.",
    author: {
      name: "Tobias Schulz",
      initials: "TS",
      avatar: "https://i.pravatar.cc/150?u=tobias-schulz",
    },
    date: "May 19, 2026",
    readTime: "11 Min Read",
    featured: false,
  },
  {
    category: "Culture",
    title: "Async-first does not mean no meetings, it means intentional ones",
    excerpt:
      "We went fully async two years ago and learned that the hard problems were never about time zones. They were about trust, decision ownership, and knowing when synchronous is worth the cost.",
    author: {
      name: "Amara Diallo",
      initials: "AD",
      avatar: "https://i.pravatar.cc/150?u=amara-diallo",
    },
    date: "May 5, 2026",
    readTime: "7 Min Read",
    featured: false,
  },
  {
    category: "Product",
    title: "Shipping a feature in three languages on day one",
    excerpt:
      "Internationalisation is usually treated as a phase-two concern. We made it a launch requirement and restructured how designers, engineers, and translators collaborate from the very first sprint.",
    author: {
      name: "Cleo Martinez",
      initials: "CM",
      avatar: "https://i.pravatar.cc/150?u=cleo-martinez",
    },
    date: "Apr 22, 2026",
    readTime: "8 Min Read",
    featured: false,
  },
]

const [featuredPost, ...restPosts] = posts

export default function BlogBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Acme Blog
            </p>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Latest articles
            </h1>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {posts.length} Articles
          </span>
        </div>

        <Separator className="mt-5 mb-8" />

        <a
          href="#"
          className="group block rounded-xl border border-border bg-card p-6 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <div className="flex flex-col gap-4">
            <div className="aspect-[16/7] w-full overflow-hidden rounded-lg border border-border bg-muted">
              <img
                src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80"
                alt={featuredPost.title}
                className="size-full object-cover opacity-80 grayscale transition-opacity group-hover:opacity-100"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="text-[10px] tracking-wide uppercase"
                >
                  {featuredPost.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {featuredPost.date}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {featuredPost.readTime}
                </span>
              </div>

              <h2 className="font-heading text-lg leading-snug font-bold tracking-tight transition-colors group-hover:text-foreground/80">
                {featuredPost.title}
              </h2>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {featuredPost.excerpt}
              </p>

              <div className="flex items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarImage
                      src={featuredPost.author.avatar}
                      alt={featuredPost.author.name}
                      className="grayscale"
                    />
                    <AvatarFallback>
                      {featuredPost.author.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">
                    {featuredPost.author.name}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-foreground/60 transition-colors group-hover:text-foreground">
                  Read Article
                  <IconPlaceholder
                    lucide="ArrowRight"
                    tabler="IconArrowRight"
                    hugeicons="ArrowRightIcon"
                    phosphor="ArrowRight"
                    remixicon="RiArrowRightLine"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            </div>
          </div>
        </a>

        <div className="mt-8 flex flex-col gap-0">
          {restPosts.map((post, index) => (
            <div key={post.title}>
              <a
                href="#"
                className="group flex flex-col gap-2.5 py-5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-border text-[10px] tracking-wide uppercase"
                  >
                    {post.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {post.date}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {post.readTime}
                  </span>
                </div>

                <h2 className="font-heading text-sm leading-snug font-semibold tracking-tight text-foreground transition-colors group-hover:text-foreground/70">
                  {post.title}
                </h2>

                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between gap-4 pt-0.5">
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="grayscale"
                      />
                      <AvatarFallback>{post.author.initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground/70">
                      {post.author.name}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                    Read
                    <IconPlaceholder
                      lucide="ArrowRight"
                      tabler="IconArrowRight"
                      hugeicons="ArrowRightIcon"
                      phosphor="ArrowRight"
                      remixicon="RiArrowRightLine"
                      className="size-3 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </a>
              {index < restPosts.length - 1 && <Separator />}
            </div>
          ))}
        </div>

        <Separator className="mt-8 mb-6" />

        <div className="flex justify-center">
          <Button
            variant="outline"
           
           
           asChild><a href="#" >
            View All Articles
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              data-icon="inline-end"
            />
          </a></Button>
        </div>
      </div>
    </section>
  )
}
