"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const milestones = [
  { label: "Design", done: true },
  { label: "Beta", done: true },
  { label: "Launch", done: false },
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
export const copy = { milestones }
export type Copy = typeof copy


const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ComingSoonBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { milestones } = { ...copy, ...override }
  const [email, setEmail] = useState("")
  const [joined, setJoined] = useState(false)

  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Coming soon
        </span>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          We&apos;re almost ready
        </h1>
        <p className="mt-3 text-sm text-pretty text-muted-foreground">
          Acme is putting the finishing touches on launch. Join the waitlist and
          we&apos;ll let you know the moment it&apos;s live.
        </p>

        <div className="mt-8 w-full">
          <Progress value={68} className="h-1.5" />
          <div className="mt-3 flex justify-between">
            {milestones.map((milestone) => (
              <span
                key={milestone.label}
                className={cn(
                  "flex items-center gap-1 text-xs",
                  milestone.done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {milestone.done && (
                  <IconPlaceholder
                    lucide="Check"
                    tabler="IconCheck"
                    hugeicons="Tick02Icon"
                    phosphor="Check"
                    remixicon="RiCheckLine"
                    className="size-3.5"
                    aria-hidden="true"
                  />
                )}
                {milestone.label}
              </span>
            ))}
          </div>
        </div>

        {joined ? (
          <p className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <IconPlaceholder
              lucide="Check"
              tabler="IconCheck"
              hugeicons="Tick02Icon"
              phosphor="Check"
              remixicon="RiCheckLine"
              className="size-4"
              aria-hidden="true"
            />
            You&apos;re on the list. We&apos;ll be in touch soon.
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (emailPattern.test(email)) setJoined(true)
            }}
            className="mt-8 flex w-full flex-col gap-2 sm:flex-row"
            noValidate
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="flex-1"
            />
            <Button type="submit">Notify me</Button>
          </form>
        )}
      </div>
    </section>
  )
}
