"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const stats = [
  { label: "Projects", value: "48" },
  { label: "Followers", value: "2.1k" },
  { label: "Rating", value: "4.9" },
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
export const copy = { stats }
export type Copy = typeof copy


export default function ProfileBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { stats } = { ...copy, ...override }
  const [following, setFollowing] = React.useState(false)

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar className="size-20 border border-border">
              <AvatarImage
                src="https://i.pravatar.cc/160?img=12"
                alt="Marcus Trent"
                className="grayscale"
              />
              <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-base font-semibold">
                  Marcus Trent
                </h1>
                <Badge variant="secondary">Pro</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Product Designer</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <IconPlaceholder
                  lucide="MapPin"
                  tabler="IconMapPin"
                  hugeicons="MapPinIcon"
                  phosphor="MapPin"
                  remixicon="RiMapPinLine"
                  className="size-3.5"
                  aria-hidden="true"
                />
                San Francisco, CA
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 divide-x divide-border border-y border-border">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-0.5 py-3"
              >
                <span className="text-sm font-semibold tabular-nums">
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            className="flex-1"
            aria-pressed={following}
            variant={following ? "outline" : "default"}
            onClick={() => setFollowing((v) => !v)}
          >
            {following ? "Following" : "Follow"}
          </Button>
          <Button variant="outline" className="flex-1">
            Message
          </Button>
        </CardFooter>
      </Card>
    </section>
  )
}
