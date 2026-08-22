"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Result = {
  title: string
  snippet: string
  type: string
}

const types = ["Docs", "Guide", "Blog", "API"]

const results: Result[] = [
  {
    title: "Design tokens overview",
    snippet:
      "Tokens are the single source of truth for color, spacing, and typography across your product.",
    type: "Docs",
  },
  {
    title: "Theming with tokens",
    snippet:
      "A step-by-step walkthrough of remapping semantic tokens to build a dark theme.",
    type: "Guide",
  },
  {
    title: "Designing tokens that scale",
    snippet:
      "How we restructured our tokens into three tiers and cut theme work to almost nothing.",
    type: "Blog",
  },
  {
    title: "Tokens API reference",
    snippet:
      "Read, resolve, and override token values programmatically with the typed tokens client.",
    type: "API",
  },
  {
    title: "Migrating to design tokens",
    snippet:
      "Adopt tokens incrementally, starting with color and shipping each tier behind review.",
    type: "Guide",
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
export const copy = { types, results }
export type Copy = typeof copy


export default function SearchBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { types, results } = { ...copy, ...override }
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [query, setQuery] = React.useState("")

  const toggle = (type: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })

  const q = query.trim().toLowerCase()
  const matchesQuery = (r: Result) =>
    !q || `${r.title} ${r.snippet} ${r.type}`.toLowerCase().includes(q)

  // Facet counts reflect the current text query so they stay in sync with the
  // list; selecting a type does not zero out the other counts.
  const queryMatched = results.filter(matchesQuery)
  const countFor = (type: string) =>
    queryMatched.filter((r) => r.type === type).length

  const filtered = queryMatched.filter(
    (r) => selected.size === 0 || selected.has(r.type)
  )

  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-background">
        <div className="border-b border-border p-3">
          <div className="relative">
            <IconPlaceholder
              lucide="Search"
              tabler="IconSearch"
              hugeicons="SearchIcon"
              phosphor="MagnifyingGlass"
              remixicon="RiSearchLine"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documentation..."
              aria-label="Search"
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-[180px_1fr]">
          <aside className="border-b border-border p-4 md:border-r md:border-b-0">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Type
              </span>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="flex flex-col gap-3">
              {types.map((type) => (
                <li key={type} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`type-${type}`}
                    checked={selected.has(type)}
                    onCheckedChange={() => toggle(type)}
                  />
                  <label
                    htmlFor={`type-${type}`}
                    className="flex flex-1 items-center justify-between text-sm text-foreground"
                  >
                    {type}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {countFor(type)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0 p-4 md:min-h-[510px]">
            <p className="mb-1 text-xs text-muted-foreground tabular-nums">
              {filtered.length} {filtered.length === 1 ? "Result" : "Results"}
            </p>
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;.
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {filtered.map((result) => (
                  <li
                    key={result.title}
                    className="flex flex-col gap-1.5 py-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <a
                        href="#"
                        className="text-sm font-semibold text-foreground hover:underline"
                      >
                        {result.title}
                      </a>
                      <Badge variant="secondary">{result.type}</Badge>
                    </div>
                    <p className="text-sm/relaxed text-muted-foreground">
                      {result.snippet}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
