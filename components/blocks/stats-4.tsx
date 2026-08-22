"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

/** An icon held in data and rendered later, e.g. `<item.icon className="size-4" />`. */
type IconRenderer = (props: IconProps) => React.ReactNode

type Metric = {
  id: string
  icon: IconRenderer
  target: number
  decimals: number
  prefix: string
  suffix: string
  label: string
  delta: string
}

const metrics: Metric[] = [
  {
    id: "uptime",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Globe"
        tabler="IconGlobe"
        hugeicons="GlobalIcon"
        phosphor="Globe"
        remixicon="RiGlobalLine"
        {...p}
      />
    ),
    target: 99.9,
    decimals: 1,
    prefix: "",
    suffix: "%",
    label: "Service uptime",
    delta: "+0.4%",
  },
  {
    id: "users",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Users"
        tabler="IconUsersGroup"
        hugeicons="UserGroupIcon"
        phosphor="UsersThree"
        remixicon="RiTeamLine"
        {...p}
      />
    ),
    target: 12,
    decimals: 0,
    prefix: "",
    suffix: "k+",
    label: "Active teams",
    delta: "+18%",
  },
  {
    id: "rating",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Star"
        tabler="IconStar"
        hugeicons="StarIcon"
        phosphor="Star"
        remixicon="RiStarSmileLine"
        {...p}
      />
    ),
    target: 4.9,
    decimals: 1,
    prefix: "",
    suffix: "/5",
    label: "Average rating",
    delta: "+0.2",
  },
  {
    id: "integrations",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Clock"
        tabler="IconClock"
        hugeicons="TimeIcon"
        phosphor="Clock"
        remixicon="RiTimeLine"
        {...p}
      />
    ),
    target: 250,
    decimals: 0,
    prefix: "",
    suffix: "+",
    label: "Integrations shipped",
    delta: "+32",
  },
]

function formatValue(value: number, metric: Metric) {
  const fixed = value.toFixed(metric.decimals)
  return `${metric.prefix}${fixed}${metric.suffix}`
}

export default function StatsBlock() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const node = sectionRef.current
    if (!node) return

    let frame = 0
    let started = false

    const animate = (start: number) => {
      const duration = 1600

      const step = (now: number) => {
        const elapsed = now - start
        const linear = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - linear, 3)
        setProgress(eased)
        if (linear < 1) {
          frame = requestAnimationFrame(step)
        }
      }

      frame = requestAnimationFrame(step)
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersReduced) {
      const id = requestAnimationFrame(() => setProgress(1))
      return () => cancelAnimationFrame(id)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started) {
            started = true
            animate(performance.now())
            observer.disconnect()
          }
        }
      },
      { threshold: 0.35 }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            <IconPlaceholder
              lucide="ArrowUp"
              tabler="IconArrowUp"
              hugeicons="ArrowUpIcon"
              phosphor="ArrowUp"
              remixicon="RiArrowUpLine"
              data-icon="inline-start"
            />
            By the Numbers
          </Badge>
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Numbers teams at Acme trust
          </h2>
          <p className="mt-3 text-base text-balance text-muted-foreground">
            Real performance from a platform built to scale with you, measured
            and reported every single quarter.
          </p>
        </div>

        <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 md:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon
            const current = metric.target * progress
            return (
              <div
                key={metric.id}
                className="group flex flex-col gap-4 bg-card p-6 transition-colors hover:bg-card/60 sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <Badge
                    variant="outline"
                    className="border-transparent bg-primary/10 text-primary"
                  >
                    <IconPlaceholder
                      lucide="ArrowUp"
                      tabler="IconArrowUp"
                      hugeicons="ArrowUpIcon"
                      phosphor="ArrowUp"
                      remixicon="RiArrowUpLine"
                      data-icon="inline-start"
                    />
                    {metric.delta}
                  </Badge>
                </div>
                <div>
                  <dd
                    className={cn(
                      "text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl"
                    )}
                  >
                    {formatValue(current, metric)}
                  </dd>
                  <dt className="mt-2 text-sm text-muted-foreground">
                    {metric.label}
                  </dt>
                </div>
              </div>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
