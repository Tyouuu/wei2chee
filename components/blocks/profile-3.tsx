import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const stats = [
  { label: "Clients", value: "4k" },
  { label: "Projects", value: "126" },
  { label: "Founded", value: "2019" },
]

const team = [
  { name: "Ada", src: "https://i.pravatar.cc/64?img=47" },
  { name: "Leo", src: "https://i.pravatar.cc/64?img=12" },
  { name: "Mara", src: "https://i.pravatar.cc/64?img=32" },
  { name: "Owen", src: "https://i.pravatar.cc/64?img=53" },
]

export default function ProfileBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-lg rounded-xl border border-border bg-background p-6">
        <div className="flex items-start gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <IconPlaceholder
              lucide="Sparkles"
              tabler="IconSparkles"
              hugeicons="SparklesIcon"
              phosphor="Sparkle"
              remixicon="RiSparkling2Fill"
              className="size-7"
            />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-lg font-semibold tracking-tight">
                Acme Labs
              </h1>
              <Badge variant="secondary" className="gap-1">
                <IconPlaceholder
                  lucide="Check"
                  tabler="IconCheck"
                  hugeicons="Tick02Icon"
                  phosphor="Check"
                  remixicon="RiCheckLine"
                  className="size-3"
                  aria-hidden="true"
                />
                Verified
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Design tools for product teams
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm/relaxed text-foreground/80">
          We build calm, reliable software for the teams that ship the products
          you use every day. Trusted by more than 4,000 companies worldwide.
        </p>

        <div className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-0.5 py-3"
            >
              <span className="text-sm font-semibold tabular-nums">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-2">
              {team.map((member) => (
                <Avatar
                  key={member.name}
                  className="size-7 border-2 border-background"
                >
                  <AvatarImage
                    src={member.src}
                    alt={member.name}
                    className="grayscale"
                  />
                  <AvatarFallback className="text-[10px]">
                    {member.name[0]}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">44 Members</span>
          </div>
          <a
            href="#"
            className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
          >
            View all
          </a>
        </div>

        <Separator className="my-5" />

        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
           
           
           asChild><a href="#" >
            Visit Website
            <IconPlaceholder
              lucide="ArrowUpRight"
              tabler="IconArrowUpRight"
              hugeicons="ArrowUpRightIcon"
              phosphor="ArrowUpRight"
              remixicon="RiArrowRightUpLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </a></Button>
          <Button
            variant="outline"
            className="flex-1"
           
           
           asChild><a href="#" >
            Contact
          </a></Button>
        </div>
      </div>
    </section>
  )
}
