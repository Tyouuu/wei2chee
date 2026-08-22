"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$19",
    seats: 5,
    description: "For small teams getting started.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    seats: 25,
    description: "For growing teams that need more seats.",
  },
  {
    id: "scale",
    name: "Scale",
    price: "$99",
    seats: 100,
    description: "For organizations operating at scale.",
  },
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
export const copy = { PLANS }
export type Copy = typeof copy


const SEATS_USED = 11
const RENEWAL_DATE = "July 14, 2026"

export default function BillingBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { PLANS } = { ...copy, ...override }
  const [planId, setPlanId] = React.useState<string>("pro")
  const [pendingPlanId, setPendingPlanId] = React.useState<string>("pro")
  const [open, setOpen] = React.useState(false)

  const currentPlan = PLANS.find((p) => p.id === planId) ?? PLANS[1]
  const pendingPlan = PLANS.find((p) => p.id === pendingPlanId) ?? currentPlan

  const seatPct = Math.round((SEATS_USED / currentPlan.seats) * 100)

  function openManage() {
    setPendingPlanId(planId)
    setOpen(true)
  }

  function confirmPlan() {
    setPlanId(pendingPlanId)
    setOpen(false)
    if (pendingPlanId === planId) {
      toast.info("No changes made", {
        description: `You're still on the ${pendingPlan.name} plan.`,
      })
    } else {
      toast.success("Plan updated", {
        description: `You're now on the ${pendingPlan.name} plan.`,
      })
    }
  }

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Current Plan</CardTitle>
            <Badge variant="secondary">{currentPlan.name}</Badge>
          </div>
          <CardDescription>
            Your subscription renews automatically each month.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-1">
            <span className="text-3xl font-semibold tracking-tight text-foreground">
              {currentPlan.price}
            </span>
            <span className="mb-0.5 text-xs text-muted-foreground">
              / Month
            </span>
          </div>

          <Separator />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconPlaceholder
              lucide="Calendar"
              tabler="IconCalendar"
              hugeicons="CalendarIcon"
              phosphor="Calendar"
              remixicon="RiCalendarLine"
              className="size-3.5 shrink-0"
            />
            <span>
              Next Renewal:{" "}
              <span className="font-medium text-foreground">
                {RENEWAL_DATE}
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconPlaceholder
                  lucide="Group"
                  tabler="IconUsers"
                  hugeicons="GroupIcon"
                  phosphor="Users"
                  remixicon="RiGroupLine"
                  className="size-3.5 shrink-0"
                />
                <span>Seats Used</span>
              </div>
              <span className="font-medium text-foreground">
                {SEATS_USED}{" "}
                <span className="text-muted-foreground">
                  / {currentPlan.seats}
                </span>
              </span>
            </div>
            <Progress value={seatPct} className="w-full" />
            <p className="text-xs text-muted-foreground">
              {Math.max(currentPlan.seats - SEATS_USED, 0)} Seats Remaining
            </p>
          </div>
        </CardContent>

        <CardFooter>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild><Button
                  className="w-full"
                  variant="outline"
                  onClick={openManage}
                >
                  Manage Plan
                  <IconPlaceholder
                    lucide="ArrowRight"
                    tabler="IconArrowRight"
                    hugeicons="ArrowRightIcon"
                    phosphor="ArrowRight"
                    remixicon="RiArrowRightLine"
                    data-icon="inline-end"
                  />
                </Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Change your plan</AlertDialogTitle>
                <AlertDialogDescription>
                  Select a tier. Changes take effect at your next renewal.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <RadioGroup
                value={pendingPlanId}
                onValueChange={(value) => setPendingPlanId(String(value))}
                className="gap-2"
              >
                {PLANS.map((plan) => (
                  <FieldLabel key={plan.id} htmlFor={`plan-${plan.id}`}>
                    <Field
                      orientation="horizontal"
                      className="items-start gap-3"
                    >
                      <RadioGroupItem
                        value={plan.id}
                        id={`plan-${plan.id}`}
                        className="mt-0.5"
                      />
                      <FieldContent>
                        <span className="flex items-center justify-between gap-2 text-sm font-medium">
                          {plan.name}
                          <span className="text-xs text-muted-foreground">
                            {plan.price} / Month For {plan.seats} Seats
                          </span>
                        </span>
                        <FieldDescription>{plan.description}</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button onClick={confirmPlan}>Update Plan</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
      <Toaster />
    </section>
  )
}
