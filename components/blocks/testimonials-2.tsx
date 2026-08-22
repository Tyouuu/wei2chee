import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const testimonial = {
  quote:
    "Acme's platform compressed what used to be a six-week integration cycle down to a single sprint. Our engineers finally have breathing room to work on things that matter, and our customers felt the difference immediately.",
  name: "Isabelle Fontaine",
  role: "Chief Product Officer",
  company: "Meridian Labs",
  initials: "IF",
  avatar: "https://i.pravatar.cc/150?img=45",
}

const metrics = [
  { value: "6×", label: "faster integrations" },
  { value: "40%", label: "less engineer toil" },
  { value: "1 sprint", label: "to full deployment" },
]

export default function TestimonialsBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-24 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative rounded-xl border border-border bg-card p-10 sm:p-14">
          <div
            className="absolute top-10 left-0 h-16 w-[3px] bg-foreground"
            aria-hidden="true"
          />

          <IconPlaceholder
            lucide="Quote"
            tabler="IconQuotes"
            hugeicons="QuotesIcon"
            phosphor="Quotes"
            remixicon="RiDoubleQuotesR"
            className="mb-8 size-8 text-muted-foreground"
            aria-hidden="true"
          />

          <blockquote className="text-xl leading-[1.65] font-medium tracking-tight text-foreground sm:text-2xl">
            &ldquo;{testimonial.quote}&rdquo;
          </blockquote>

          <Separator className="my-10" />

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 border border-border">
                <AvatarImage
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="grayscale"
                />
                <AvatarFallback className="text-sm font-semibold">
                  {testimonial.initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-1">
                <span className="text-sm leading-tight font-semibold text-foreground">
                  {testimonial.name}
                </span>
                <span className="text-xs leading-tight text-muted-foreground">
                  {testimonial.role},{" "}
                  <span className="font-medium text-foreground">
                    {testimonial.company}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 sm:gap-8">
              {metrics.map((m, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-0.5 text-center"
                >
                  <span className="text-lg leading-none font-bold tracking-tight text-foreground">
                    {m.value}
                  </span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
