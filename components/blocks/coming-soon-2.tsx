import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function ComingSoonBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
        <div className="flex flex-col items-start gap-6">
          <span className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <IconPlaceholder
              lucide="Rocket"
              tabler="IconRocket"
              hugeicons="RocketIcon"
              phosphor="Rocket"
              remixicon="RiRocket2Line"
              className="size-3.5"
              aria-hidden="true"
            />
            Coming Soon
          </span>

          <div className="flex flex-col gap-3">
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              The new way to ship faster
            </h1>
            <p className="max-w-md text-sm text-muted-foreground sm:text-base">
              We are building something worth the wait. Join the waitlist and be
              the first to get access when we go live.
            </p>
          </div>

          <form
            action="#"
            className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
          >
            <Input
              type="email"
              required
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <Button type="submit" className="shrink-0">
              Join waitlist
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Join 2,000+ others on the list
          </p>
        </div>

        <div
          aria-hidden="true"
          className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-center gap-2.5 border-b border-border bg-muted px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 border border-border bg-background" />
              <span className="size-2.5 border border-border bg-background" />
              <span className="size-2.5 border border-border bg-background" />
            </div>
            <div className="mx-2 flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-1">
              <span className="size-1.5 bg-muted-foreground/30" />
              <span className="h-2 w-28 bg-muted-foreground/20" />
            </div>
          </div>

          <div className="flex flex-col gap-5 p-5">
            <div className="flex items-center justify-between">
              <div className="h-6 w-24 rounded-md bg-muted" />
              <div className="h-6 w-16 rounded-md bg-muted" />
            </div>

            <div className="space-y-2.5">
              <div className="h-3 w-3/4 bg-muted" />
              <div className="h-3 w-full bg-muted" />
              <div className="h-3 w-5/6 bg-muted" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 rounded-lg bg-muted" />
              <div className="h-20 rounded-lg bg-muted" />
              <div className="h-20 rounded-lg bg-muted" />
            </div>

            <div className="space-y-2.5">
              <div className="h-3 w-2/3 bg-muted" />
              <div className="h-3 w-1/2 bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
