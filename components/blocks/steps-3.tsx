"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const steps = [
  {
    title: "Create Your Account",
    description:
      "Set your name, workspace URL, and a password. This is what your team will see when they join.",
  },
  {
    title: "Invite Your Team",
    description:
      "Add teammates by email. You can always invite more people later from settings.",
  },
  {
    title: "Connect A Data Source",
    description:
      "Link a database or upload a file so we can generate your first dashboard automatically.",
  },
  {
    title: "Review and Launch",
    description:
      "Confirm everything looks right, then publish your workspace and start exploring.",
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
export const copy = { steps }
export type Copy = typeof copy


export default function StepsBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { steps } = { ...copy, ...override }
  const [current, setCurrent] = React.useState(0)
  const total = steps.length
  const step = steps[current]
  const percent = ((current + 1) / total) * 100

  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Step {current + 1} of {total}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {Math.round(percent)}%
          </span>
        </div>
        <Progress value={percent} className="mt-3" />

        <div className="mt-6">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {step.title}
          </h2>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            {step.description}
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            <IconPlaceholder
              lucide="ChevronLeft"
              tabler="IconChevronLeft"
              hugeicons="ArrowLeft01Icon"
              phosphor="CaretLeft"
              remixicon="RiArrowLeftSLine"
              data-icon="inline-start"
              aria-hidden="true"
            />
            Back
          </Button>
          <Button
            onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
            disabled={current === total - 1}
          >
            {current === total - 1 ? "Finish" : "Continue"}
            <IconPlaceholder
              lucide="ChevronRight"
              tabler="IconChevronRight"
              hugeicons="ArrowRight01Icon"
              phosphor="CaretRight"
              remixicon="RiArrowRightSLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </section>
  )
}
