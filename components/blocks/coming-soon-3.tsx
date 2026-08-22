"use client"

import { Fragment, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const COUNTDOWN_DURATION_MS =
  14 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000 + 42 * 60 * 1000 + 18 * 1000

type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(diffMs: number): TimeLeft {
  const diff = Math.max(0, diffMs)
  const totalSeconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

function pad(value: number): string {
  return value.toString().padStart(2, "0")
}

const tiles = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
] as const

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
export const copy = { tiles }
export type Copy = typeof copy


export default function ComingSoonBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { tiles } = { ...copy, ...override }
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    getTimeLeft(COUNTDOWN_DURATION_MS)
  )

  useEffect(() => {
    const deadline = Date.now() + COUNTDOWN_DURATION_MS
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(deadline - Date.now()))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="flex min-h-svh w-full flex-col items-center justify-center gap-8 bg-background px-6 py-12 text-center text-foreground">
      <div className="flex flex-col items-center gap-4">
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
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          The countdown to our biggest launch yet
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          We go live the moment the timer hits zero. Drop your email and we will
          make sure you are first through the door.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {tiles.map((tile, index) => (
          <Fragment key={tile.key}>
            <div className="flex w-16 flex-col overflow-hidden rounded-lg border border-border sm:w-20">
              <span
                suppressHydrationWarning
                className="bg-card py-3 font-mono text-3xl font-bold tabular-nums sm:text-4xl"
              >
                {pad(timeLeft[tile.key])}
              </span>
              <span className="border-t border-border bg-muted/40 py-1.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {tile.label}
              </span>
            </div>
            {index < tiles.length - 1 && (
              <span
                aria-hidden="true"
                className="font-mono text-2xl font-bold text-muted-foreground/30 sm:text-3xl"
              >
                :
              </span>
            )}
          </Fragment>
        ))}
      </div>

      <form
        action="#"
        className="flex w-full max-w-sm flex-col gap-2 sm:flex-row"
      >
        <Input
          type="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
        />
        <Button type="submit" className="shrink-0">
          Notify me
        </Button>
      </form>
    </section>
  )
}
