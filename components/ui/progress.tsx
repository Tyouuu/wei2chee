"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

/**
 * The label and the number that sit above a progress bar.
 *
 * Base UI's Progress ships these as parts (`Progress.Label`,
 * `Progress.Value`); Radix's does not, and two pulled app-shell blocks import
 * them. They are a caption and a figure, so that is what they are here --
 * spans on the type tokens, no state, nothing to keep in sync with the bar.
 *
 * `tabular-nums` on the value because it usually sits beside a bar that is
 * animating: a percentage that changes width as it counts makes the whole row
 * twitch.
 */
function ProgressLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="progress-label"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="progress-value"
      className={cn("text-sm tabular-nums text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Progress, ProgressLabel, ProgressValue }
