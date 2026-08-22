import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const testimonials = [
  {
    quote:
      "We shipped a polished marketing site in a single afternoon. The blocks dropped in cleanly and looked right in both light and dark themes, exactly what our team needed without a single tweak.",
    name: "Maya Chen",
    role: "Founder",
    company: "Northwind",
    avatar: "https://i.pravatar.cc/150?img=47",
    rating: 5,
  },
  {
    quote:
      "Accessible, sharp, and zero config. Our engineers stopped reinventing layouts and started shipping features again within days of adopting Acme. Onboarding went from weeks to a single morning.",
    name: "Priya Nair",
    role: "Engineering Manager",
    company: "Vela",
    avatar: "https://i.pravatar.cc/150?img=32",
    rating: 5,
  },
  {
    quote:
      "Adopting Acme cut our component backlog in half by the end of the first sprint.",
    name: "Tomás Herrera",
    role: "Frontend Lead",
    company: "Cobalt",
    avatar: "https://i.pravatar.cc/150?img=13",
    rating: 4,
  },
  {
    quote:
      "I expected to fight the defaults. Instead everything just composed: spacing, typography, focus states. It feels like it was designed by someone who actually ships product.",
    name: "Sofia Lindqvist",
    role: "Product Designer",
    company: "Fernweh",
    avatar: "https://i.pravatar.cc/150?img=45",
    rating: 5,
  },
  {
    quote:
      "Our agency standardized on Acme across six client projects. Handoffs are clean and reviews are faster.",
    name: "Marcus Bell",
    role: "Creative Director",
    company: "Studio Atlas",
    avatar: "https://i.pravatar.cc/150?img=8",
    rating: 5,
  },
  {
    quote:
      "The dark mode story alone paid for itself. No more one-off overrides scattered through the codebase, and our QA pass on theming dropped to almost nothing.",
    name: "Aisha Rahman",
    role: "Staff Engineer",
    company: "Quanta",
    avatar: "https://i.pravatar.cc/150?img=26",
    rating: 5,
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

export default function TestimonialsBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { testimonials } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-block rounded-md border border-border px-3 py-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Wall of love
          </span>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            Teams ship faster with Acme
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Thousands of engineers, designers, and founders build their products
            on Acme. Here is what a few of them have to say.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {testimonials.map(
            ({ quote, name, role, company, avatar, rating }) => (
              <Card
                key={name}
                className="flex h-full flex-col gap-0 border-border bg-card p-6 transition-colors duration-200 hover:border-foreground/20"
              >
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <IconPlaceholder
                      lucide="Quote"
                      tabler="IconQuotes"
                      hugeicons="QuotesIcon"
                      phosphor="Quotes"
                      remixicon="RiDoubleQuotesL"
                      className="size-7 text-foreground opacity-20"
                      aria-hidden="true"
                    />
                    <div
                      className="flex items-center gap-0.5"
                      aria-label={`${rating} out of 5 stars`}
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <IconPlaceholder
                          lucide="Star"
                          tabler="IconStar"
                          hugeicons="StarIcon"
                          phosphor="Star"
                          remixicon="RiStarFill"
                          key={i}
                          className={
                            i < rating
                              ? "size-4 text-primary"
                              : "size-4 text-muted-foreground/30"
                          }
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                  <blockquote className="flex-1 text-[15px] leading-relaxed text-foreground">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <Avatar className="size-10 border border-border">
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
                </div>
              </Card>
            )
          )}
        </div>
      </div>
    </section>
  )
}
