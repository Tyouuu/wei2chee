"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const SALE_DURATION_MS =
  2 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000 + 34 * 60 * 1000 + 12 * 1000

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

export default function AnnouncementBlock() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    getTimeLeft(SALE_DURATION_MS)
  )

  useEffect(() => {
    const deadline = Date.now() + SALE_DURATION_MS
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(deadline - Date.now()))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="flex min-h-svh w-full flex-col bg-muted/30 text-foreground">
      <div className="w-full bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-3 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <IconPlaceholder
                lucide="Flame"
                tabler="IconFlame"
                hugeicons="FireIcon"
                phosphor="Fire"
                remixicon="RiFireLine"
                className="size-4 shrink-0"
                aria-hidden="true"
              />
              Summer Sale, up to 40% off
            </span>
            <span className="hidden h-4 w-px bg-primary-foreground/30 sm:block" />
            <span className="flex items-center gap-2 text-sm">
              <span className="text-primary-foreground/80">Sale ends in</span>
              <span className="flex items-center gap-1 font-mono text-sm font-semibold tabular-nums">
                <span className="rounded-md bg-primary-foreground/15 px-1.5 py-0.5">
                  {pad(timeLeft.days)}d
                </span>
                <span className="rounded-md bg-primary-foreground/15 px-1.5 py-0.5">
                  {pad(timeLeft.hours)}h
                </span>
                <span className="rounded-md bg-primary-foreground/15 px-1.5 py-0.5">
                  {pad(timeLeft.minutes)}m
                </span>
                <span className="rounded-md bg-primary-foreground/15 px-1.5 py-0.5">
                  {pad(timeLeft.seconds)}s
                </span>
              </span>
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
           
           
            className="w-full sm:w-auto"
           asChild><a href="#" >
            Shop The Sale
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
        </div>
      </div>

      <div
        aria-hidden="true"
        className="mx-auto w-4/5 max-w-5xl flex-1 px-6 py-10"
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="h-6 w-28 rounded-md bg-muted" />
          <div className="hidden items-center gap-3 sm:flex">
            <div className="h-3 w-14 rounded-md bg-muted" />
            <div className="h-3 w-14 rounded-md bg-muted" />
            <div className="h-7 w-16 rounded-md bg-muted" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-6 w-1/2 rounded-md bg-muted" />
          <div className="h-3 w-full rounded-md bg-muted" />
          <div className="h-3 w-4/5 rounded-md bg-muted" />
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </section>
  )
}
