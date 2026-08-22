"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const categories = [
  {
    id: "necessary",
    label: "Strictly necessary",
    description: "Required for the site to function. Always on.",
    required: true,
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Help us understand how the product is used.",
    required: false,
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Used to personalize ads and measure campaigns.",
    required: false,
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


export default function CookieConsentBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { categories } = { ...copy, ...override }
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [prefs, setPrefs] = useState({ analytics: true, marketing: false })

  if (!open) return null

  return (
    <section className="flex min-h-svh w-full items-end justify-center bg-muted/30 px-4 py-6 sm:items-center">
      <div className="w-full max-w-lg rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              We value your privacy
            </h2>
            <p className="text-sm text-muted-foreground">
              We use cookies to improve your experience, analyze traffic, and
              personalize content. Choose which cookies to allow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Dismiss"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconPlaceholder
              lucide="X"
              tabler="IconX"
              hugeicons="Cancel01Icon"
              phosphor="X"
              remixicon="RiCloseLine"
              className="size-5"
              aria-hidden="true"
            />
          </button>
        </div>

        {expanded && (
          <>
            <Separator />
            <div className="flex flex-col gap-4 p-5">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-start justify-between gap-4"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {category.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {category.description}
                    </span>
                  </div>
                  {category.required ? (
                    <Switch checked disabled aria-label={category.label} />
                  ) : (
                    <Switch
                      checked={prefs[category.id as keyof typeof prefs]}
                      onCheckedChange={(checked) =>
                        setPrefs((prev) => ({
                          ...prev,
                          [category.id]: checked,
                        }))
                      }
                      aria-label={category.label}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <Separator />
        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:justify-end">
          {!expanded && (
            <Button
              variant="ghost"
              onClick={() => setExpanded(true)}
              className="sm:mr-auto"
            >
              Customize
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            Reject all
          </Button>
          <Button onClick={() => setOpen(false)}>
            {expanded ? "Save preferences" : "Accept all"}
          </Button>
        </div>
      </div>
    </section>
  )
}
