"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Result = {
  title: string
  snippet: string
  type: string
  updated: string
}

const results: Result[] = [
  {
    title: "Getting started with Acme",
    snippet:
      "Install the CLI, create your first project, and ship a page in under five minutes with copy-paste blocks.",
    type: "Docs",
    updated: "Jun 12, 2026",
  },
  {
    title: "Authentication and sessions",
    snippet:
      "Connect a provider, protect your routes, and read the current session on the server or the client.",
    type: "Guide",
    updated: "May 30, 2026",
  },
  {
    title: "Theming and design tokens",
    snippet:
      "Every block is theme-aware. Override semantic tokens once and every component updates automatically.",
    type: "Docs",
    updated: "Jun 18, 2026",
  },
  {
    title: "Deploying to production",
    snippet:
      "A checklist for going live: environment variables, build caching, and zero-downtime releases.",
    type: "Guide",
    updated: "Jun 02, 2026",
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
export const copy = { results }
export type Copy = typeof copy


export default function SearchBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { results } = { ...copy, ...override }
  const [query, setQuery] = React.useState("")

  const q = query.trim().toLowerCase()
  const filtered = q
    ? results.filter((r) =>
        `${r.title} ${r.snippet} ${r.type}`.toLowerCase().includes(q)
      )
    : results

  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="flex w-full max-w-xl flex-col gap-5">
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
            placeholder="Search the docs..."
            aria-label="Search"
            className="h-11 bg-background pl-10"
          />
        </div>

        <p className="text-sm text-muted-foreground tabular-nums">
          {filtered.length} {filtered.length === 1 ? "Result" : "Results"}
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
            No results for &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((result) => (
              <li
                key={result.title}
                className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4 transition-colors hover:border-muted-foreground/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary">{result.type}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Updated {result.updated}
                  </span>
                </div>
                <a
                  href="#"
                  className="text-sm font-semibold text-foreground hover:underline"
                >
                  {result.title}
                </a>
                <p className="text-sm/relaxed text-muted-foreground">
                  {result.snippet}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
