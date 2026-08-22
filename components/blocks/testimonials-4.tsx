import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const testimonials = [
  {
    rating: 5,
    quote:
      "Setup took minutes, not days. Every block dropped in clean and matched our brand out of the box — our marketing site shipped a week early.",
    name: "Elena Duarte",
    role: "Head of Growth",
    company: "Northwind",
    avatar: "https://i.pravatar.cc/150?img=45",
  },
  {
    rating: 5,
    quote:
      "The quality bar is unreal for the price. Accessible, responsive, and consistent across light and dark without a single override.",
    name: "Marcus Feld",
    role: "Frontend Lead",
    company: "Loopline",
    avatar: "https://i.pravatar.cc/150?img=13",
  },
  {
    rating: 4,
    quote:
      "We replaced a pile of one-off components with these blocks and our design finally feels intentional everywhere.",
    name: "Priya Nair",
    role: "Product Designer",
    company: "Vela",
    avatar: "https://i.pravatar.cc/150?img=32",
  },
  {
    rating: 5,
    quote:
      "Onboarding a new engineer used to mean explaining our layout system. Now they just compose blocks and ship.",
    name: "Tomás Rivera",
    role: "Engineering Manager",
    company: "Basecoat",
    avatar: "https://i.pravatar.cc/150?img=52",
  },
  {
    rating: 5,
    quote:
      "Support requests about broken UI basically vanished. Everything is polished and behaves the way you expect.",
    name: "Hannah Osei",
    role: "Founder",
    company: "Fieldkit",
    avatar: "https://i.pravatar.cc/150?img=27",
  },
  {
    rating: 5,
    quote:
      "It's the fastest we've ever moved from idea to a live, credible-looking product page. Worth every minute saved.",
    name: "Yuki Tanaka",
    role: "CTO",
    company: "Harbor",
    avatar: "https://i.pravatar.cc/150?img=15",
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
export const copy = { testimonials }
export type Copy = typeof copy


function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <IconPlaceholder
          lucide="Star"
          tabler="IconStar"
          hugeicons="StarIcon"
          phosphor="Star"
          remixicon="RiStarFill"
          key={index}
          aria-hidden="true"
          className={
            index < value ? "size-4 text-foreground" : "size-4 text-border"
          }
        />
      ))}
    </div>
  )
}

export default function TestimonialsBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { testimonials } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-block rounded-md border border-border px-3 py-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Testimonials
          </span>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            Rated by the teams who ship
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Thousands of engineers, designers, and founders trust Acme to build
            their product surfaces.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map(
            ({ rating, quote, name, role, company, avatar }) => (
              <Card
                key={name}
                className="h-full border-0 bg-card ring-0 transition-colors duration-200 [--card-spacing:--spacing(6)] hover:bg-muted"
              >
                <CardContent className="flex flex-1 flex-col gap-4">
                  <Rating value={rating} />
                  <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                </CardContent>

                <CardFooter className="gap-3 border-border">
                  <Avatar className="size-9 border border-border">
                    <AvatarImage
                      src={avatar}
                      alt={name}
                      className="grayscale"
                    />
                    <AvatarFallback className="text-xs font-semibold">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {role},{" "}
                      <span className="font-medium text-foreground">
                        {company}
                      </span>
                    </span>
                  </span>
                </CardFooter>
              </Card>
            )
          )}
        </div>
      </div>
    </section>
  )
}
