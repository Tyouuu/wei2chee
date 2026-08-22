"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const readers = [
  {
    name: "Mara Lin",
    initials: "ML",
    avatar: "https://i.pravatar.cc/64?img=32",
  },
  {
    name: "Leo Tanaka",
    initials: "LT",
    avatar: "https://i.pravatar.cc/64?img=12",
  },
  {
    name: "Owen Reyes",
    initials: "OR",
    avatar: "https://i.pravatar.cc/64?img=53",
  },
  {
    name: "Priya Nair",
    initials: "PN",
    avatar: "https://i.pravatar.cc/64?img=45",
  },
  {
    name: "Sam Whitfield",
    initials: "SW",
    avatar: "https://i.pravatar.cc/64?img=59",
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
export const copy = { readers }
export type Copy = typeof copy


export default function NewsletterBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { readers } = { ...copy, ...override }
  const [email, setEmail] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitted(true)
  }

  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="flex items-center -space-x-2">
          {readers.map((reader) => (
            <Avatar key={reader.name} className="size-9 ring-2 ring-background">
              <AvatarImage
                src={reader.avatar}
                alt={reader.name}
                className="grayscale"
              />
              <AvatarFallback>{reader.initials}</AvatarFallback>
            </Avatar>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <IconPlaceholder
                lucide="Star"
                tabler="IconStar"
                hugeicons="StarIcon"
                phosphor="Star"
                remixicon="RiStarFill"
                key={i}
                className="size-4 text-amber-500"
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            Loved by 12,000+ readers
          </span>
        </div>

        <h2 className="mt-6 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          The weekly newsletter for product builders
        </h2>
        <p className="mt-4 max-w-md text-lg text-pretty text-muted-foreground">
          One email every Friday with the ideas, teardowns, and tools worth your
          attention. No noise, unsubscribe anytime.
        </p>

        {submitted ? (
          <p className="mt-8 text-sm font-medium text-foreground">
            Welcome aboard. Check your inbox to confirm your subscription.
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 flex w-full max-w-md items-center gap-2"
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              aria-label="Email address"
              className="h-11"
            />
            <Button type="submit" size="lg" className="h-11 shrink-0">
              Subscribe
            </Button>
          </form>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Join readers from Vercel, Linear, and Figma.
        </p>
      </div>
    </section>
  )
}
