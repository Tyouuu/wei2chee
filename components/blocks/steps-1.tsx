import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Status = "done" | "current" | "upcoming"

const steps: { label: string; status: Status }[] = [
  { label: "Cart", status: "done" },
  { label: "Details", status: "done" },
  { label: "Payment", status: "current" },
  { label: "Review", status: "upcoming" },
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
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-xl">
        <ol className="flex">
          {steps.map((step, i) => (
            <li
              key={step.label}
              aria-current={step.status === "current" ? "step" : undefined}
              className="relative flex flex-1 flex-col items-center"
            >
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-4 left-1/2 h-0.5 w-full -translate-y-1/2",
                    step.status === "done" ? "bg-primary" : "bg-border"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-lg text-sm font-medium tabular-nums",
                  step.status === "done" &&
                    "bg-primary text-primary-foreground",
                  step.status === "current" &&
                    "border-2 border-primary bg-background text-primary",
                  step.status === "upcoming" &&
                    "border border-border bg-background text-muted-foreground"
                )}
              >
                {step.status === "done" ? (
                  <IconPlaceholder
                    lucide="Check"
                    tabler="IconCheck"
                    hugeicons="Tick02Icon"
                    phosphor="Check"
                    remixicon="RiCheckLine"
                    className="size-4"
                    aria-hidden="true"
                  />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "mt-2 text-xs",
                  step.status === "upcoming"
                    ? "text-muted-foreground"
                    : "font-medium text-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
