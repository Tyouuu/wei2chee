import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const related = [
  { title: "Designing for the first five minutes", read: "5 min" },
  { title: "A practical guide to design tokens", read: "8 min" },
  { title: "How we test accessible components", read: "6 min" },
]

export default function ArticleBlock() {
  return (
    <section className="w-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 lg:grid-cols-[1fr_17rem]">
        <article className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Badge variant="secondary" className="w-fit">
              Product
            </Badge>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Building a design system your whole team can trust
            </h1>
            <p className="text-sm text-muted-foreground">
              July 18, 2026 / 7 min read
            </p>
          </div>

          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              A design system is only as valuable as the trust people place in
              it. When engineers reach for a component and it behaves exactly as
              expected, the system disappears into the background and the work
              speeds up.
            </p>
            <p>
              The hard part is not the components themselves — it&apos;s the
              contracts around them: naming, accessibility guarantees, and the
              promise that upgrades won&apos;t break the surfaces already built.
            </p>
            <h2 className="pt-2 font-heading text-lg font-bold tracking-tight text-foreground">
              Start with the contract
            </h2>
            <p>
              Before writing a single line of a component, we write down what it
              promises: the props it accepts, the states it supports, and the
              behavior it guarantees in both themes. That contract is what
              teammates actually depend on.
            </p>
            <p>
              Everything else — tokens, docs, tests — exists to keep that
              contract honest as the system grows.
            </p>
          </div>
        </article>

        <aside className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
          <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
            <div className="flex items-center gap-3">
              <Avatar className="size-11 border border-border">
                <AvatarImage
                  src="https://i.pravatar.cc/80?img=32"
                  alt="Mia Cho"
                  className="grayscale"
                />
                <AvatarFallback>MC</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Mia Cho</span>
                <span className="text-xs text-muted-foreground">
                  Principal Designer
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Writes about design systems, accessibility, and the craft of
              everyday product work.
            </p>
            <Button
              variant="outline"
              size="sm"
             
             
             asChild><a href="#" >
              Follow
            </a></Button>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Related
            </h3>
            <ul className="flex flex-col gap-4">
              {related.map((item) => (
                <li key={item.title}>
                  <a href="#" className="group flex flex-col gap-1">
                    <span className="text-sm font-medium transition-colors group-hover:text-muted-foreground">
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.read} read
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-sm font-semibold tracking-tight">
              Get the newsletter
            </h3>
            <p className="text-xs text-muted-foreground">
              Occasional notes on design and engineering. No spam.
            </p>
            <form className="flex flex-col gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                aria-label="Email address"
              />
              <Button type="submit" size="sm">
                Subscribe
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
            </form>
          </div>
        </aside>
      </div>
    </section>
  )
}
