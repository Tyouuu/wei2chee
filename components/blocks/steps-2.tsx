import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Status = "done" | "current" | "upcoming"

const steps: { title: string; description: string; status: Status }[] = [
  {
    title: "Create your account",
    description: "Sign up with your email and choose a password.",
    status: "done",
  },
  {
    title: "Verify your email",
    description: "Confirm your address from the link we sent you.",
    status: "done",
  },
  {
    title: "Set up your workspace",
    description: "Name your workspace and pick a starting template.",
    status: "current",
  },
  {
    title: "Invite your team",
    description: "Add teammates so you can start collaborating.",
    status: "upcoming",
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
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md">
        <ol className="flex flex-col">
          {steps.map((step, i) => {
            const last = i === steps.length - 1
            return (
              <li
                key={step.title}
                aria-current={step.status === "current" ? "step" : undefined}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium tabular-nums",
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
                  {!last && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "my-1 w-0.5 flex-1",
                        step.status === "done" ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>

                <div className={cn("pt-1", last ? "pb-0" : "pb-8")}>
                  <h3
                    className={cn(
                      "font-heading text-sm font-semibold",
                      step.status === "upcoming"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    )}
                  >
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm/relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
