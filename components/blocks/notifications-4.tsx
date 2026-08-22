"use client"

import { useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

type Channels = { email: boolean; push: boolean }

const categories = [
  {
    id: "comments",
    label: "Comments",
    description: "When someone comments on your work.",
  },
  {
    id: "mentions",
    label: "Mentions",
    description: "When someone @mentions you.",
  },
  {
    id: "deploys",
    label: "Deployments",
    description: "When a deploy succeeds or fails.",
  },
  {
    id: "digest",
    label: "Weekly digest",
    description: "A summary of activity every Monday.",
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
export const copy = { categories }
export type Copy = typeof copy


const initial: Record<string, Channels> = {
  comments: { email: true, push: true },
  mentions: { email: true, push: true },
  deploys: { email: false, push: true },
  digest: { email: true, push: false },
}

export default function NotificationsBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { categories } = { ...copy, ...override }
  const [prefs, setPrefs] = useState(initial)

  const toggle = (id: string, channel: keyof Channels) =>
    setPrefs((prev) => ({
      ...prev,
      [id]: { ...prev[id], [channel]: !prev[id][channel] },
    }))

  return (
    <section className="flex w-full items-start justify-center bg-background px-6 py-16 text-foreground">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>
            Choose how you want to hear from us for each type of activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-1">
            <span />
            <span className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Email
            </span>
            <span className="text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Push
            </span>
            {categories.map((category, index) => (
              <div key={category.id} className="contents">
                {index > 0 && <Separator className="col-span-3 my-2.5" />}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{category.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {category.description}
                  </span>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={prefs[category.id].email}
                    onCheckedChange={() => toggle(category.id, "email")}
                    aria-label={`${category.label} email`}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={prefs[category.id].push}
                    onCheckedChange={() => toggle(category.id, "push")}
                    aria-label={`${category.label} push`}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
