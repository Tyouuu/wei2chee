"use client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const TRUST_ITEMS = [
  "No credit card required",
  "14-day free trial",
  "Cancel anytime",
]

const SCREENSHOT_ROWS = [
  {
    label: "Revenue",
    value: "$48,290",
    change: "+12.4%",
  },
  {
    label: "Users",
    value: "3,841",
    change: "+8.1%",
  },
  {
    label: "Churn",
    value: "1.7%",
    change: "-0.3%",
  },
  {
    label: "Session",
    value: "4m 22s",
    change: "+0.9%",
  },
]

const BAR_HEIGHTS = [30, 55, 42, 70, 48, 80, 65, 90, 58, 75, 62, 88]

const TOP_CHANNELS = [
  { name: "Organic search", pct: 74, sessions: "2,841" },
  { name: "Direct", pct: 53, sessions: "2,032" },
  { name: "Referral", pct: 31, sessions: "1,190" },
]

export default function Hero() {
  return (
    <section className="flex w-full items-center justify-center px-6 py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 md:grid-cols-2 md:items-center md:gap-16">
        <div className="flex flex-col">
          <Badge variant="outline" className="w-fit">
            Version 2.0 Is Live
          </Badge>

          <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            The analytics platform
            <br className="hidden sm:block" /> built for scale.
          </h1>

          <p className="mt-5 text-lg text-muted-foreground">
            Acme gives your team real-time visibility into every metric that
            matters, from acquisition to retention, in a single, unified
            dashboard.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
             
             
              className="w-full sm:w-auto"
             asChild><a href="#" >
              Start for Free
              <IconPlaceholder
                lucide="ArrowRight"
                tabler="IconArrowRight"
                hugeicons="ArrowRightIcon"
                phosphor="ArrowRight"
                remixicon="RiArrowRightLine"
                data-icon="inline-end"
                aria-hidden="true"
              />
            </a></Button>
            <Dialog>
              <DialogTrigger
               
               asChild><Button variant="ghost" className="w-full sm:w-auto" >
                <IconPlaceholder
                  lucide="PlayCircle"
                  tabler="IconPlayerPlay"
                  hugeicons="PlayCircleIcon"
                  phosphor="PlayCircle"
                  remixicon="RiPlayCircleLine"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                Watch Demo
              </Button></DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Product demo</DialogTitle>
                  <DialogDescription>
                    A 2-minute tour of the Acme analytics dashboard.
                  </DialogDescription>
                </DialogHeader>
                <div className="relative flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-muted">
                  <span
                    className="flex size-14 items-center justify-center rounded-full bg-background/80 ring-1 ring-border"
                    aria-hidden="true"
                  >
                    <IconPlaceholder
                      lucide="Play"
                      tabler="IconPlayerPlay"
                      hugeicons="PlayIcon"
                      phosphor="Play"
                      remixicon="RiPlayFill"
                      className="size-6 text-foreground"
                    />
                  </span>
                  <span className="sr-only">Demo video placeholder</span>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Separator className="my-8" />

          <ul className="flex flex-col gap-2.5">
            {TRUST_ITEMS.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <IconPlaceholder
                  lucide="Check"
                  tabler="IconCheck"
                  hugeicons="Tick02Icon"
                  phosphor="Check"
                  remixicon="RiCheckLine"
                  className="size-4 shrink-0 text-foreground"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="rounded-xl border border-border bg-card p-1">
            <div className="flex items-center gap-1.5 rounded-t-lg border-b border-border bg-muted px-3 py-2">
              <span className="size-2.5 border border-border bg-background" />
              <span className="size-2.5 border border-border bg-background" />
              <span className="size-2.5 border border-border bg-background" />
              <span className="ml-3 h-4 flex-1 rounded-md border border-border bg-background" />
            </div>

            <div className="flex flex-col rounded-b-lg bg-background p-4">
              <div className="grid grid-cols-2 gap-3">
                {SCREENSHOT_ROWS.map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-col rounded-lg border border-border bg-card p-3"
                  >
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {row.value}
                    </p>
                    <p className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">
                      {row.change} vs last mo.
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold">Revenue over time</p>
                  <Badge variant="secondary" className="text-xs">
                    Last 12 months
                  </Badge>
                </div>
                <div className="flex h-28 items-end gap-1">
                  {BAR_HEIGHTS.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-foreground/15"
                      style={{ height: `${h}%` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between">
                  {["Jan", "Mar", "May", "Jul", "Sep", "Nov"].map((m) => (
                    <span key={m} className="text-xs text-muted-foreground">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <p className="text-xs font-semibold">Top channels</p>
                </div>
                {TOP_CHANNELS.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-0"
                  >
                    <span className="w-24 truncate text-xs">{row.name}</span>
                    <div className="flex-1 border border-border bg-muted">
                      <div
                        className="h-1.5 bg-foreground/40"
                        style={{ width: `${row.pct}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                      {row.sessions}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="absolute -right-3 -bottom-3 -z-10 size-full rounded-xl border border-border bg-muted"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
