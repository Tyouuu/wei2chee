"use client"

import { useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

type Suggestion = {
  id: string
  label: string
  kind: "recent" | "page" | "tag"
}

const RECENT: Suggestion[] = [
  { id: "r1", label: "Billing settings", kind: "recent" },
  { id: "r2", label: "Invite teammates", kind: "recent" },
]

const SUGGESTIONS: Suggestion[] = [
  { id: "s1", label: "Getting started guide", kind: "page" },
  { id: "s2", label: "API reference", kind: "page" },
  { id: "s3", label: "Webhooks", kind: "tag" },
  { id: "s4", label: "Two-factor authentication", kind: "page" },
  { id: "s5", label: "Export data", kind: "tag" },
  { id: "s6", label: "Keyboard shortcuts", kind: "page" },
]

const iconFor = {
  recent: (p: IconProps) => (
    <IconPlaceholder
      lucide="Clock"
      tabler="IconClock"
      hugeicons="TimeIcon"
      phosphor="Clock"
      remixicon="RiTimeLine"
      {...p}
    />
  ),
  page: (p: IconProps) => (
    <IconPlaceholder
      lucide="FileText"
      tabler="IconFileText"
      hugeicons="Task01Icon"
      phosphor="FileText"
      remixicon="RiFileList2Line"
      {...p}
    />
  ),
  tag: (p: IconProps) => (
    <IconPlaceholder
      lucide="Hash"
      tabler="IconHash"
      hugeicons="HashIcon"
      phosphor="Hash"
      remixicon="RiHashtag"
      {...p}
    />
  ),
}

export default function SearchBlock() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return RECENT
    return SUGGESTIONS.filter((item) => item.label.toLowerCase().includes(q))
  }, [query])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => (index + 1) % results.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const picked = results[active]
      if (picked) {
        setQuery(picked.label)
        setOpen(false)
      }
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <section className="flex min-h-svh w-full items-start justify-center bg-background px-6 py-24 text-foreground">
      <div className="w-full max-w-md">
        <div className="relative">
          <div className="relative">
            <IconPlaceholder
              lucide="Search"
              tabler="IconSearch"
              hugeicons="SearchIcon"
              phosphor="MagnifyingGlass"
              remixicon="RiSearchLine"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder="Search docs, pages, and settings…"
              aria-label="Search"
              aria-expanded={open}
              aria-controls="search-suggestions"
              role="combobox"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-border bg-background pr-16 pl-9 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
                setOpen(true)
              }}
              onKeyDown={handleKeyDown}
            />
            <Kbd className="absolute top-1/2 right-3 -translate-y-1/2">/</Kbd>
          </div>

          {open && (
            <div
              id="search-suggestions"
              role="listbox"
              className="absolute z-10 mt-1.5 w-full rounded-lg border border-border bg-popover shadow-md"
            >
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                {query.trim() ? "Suggestions" : "Recent"}
              </p>
              {results.length > 0 ? (
                <ul className="pb-1.5">
                  {results.map((item, index) => {
                    const Icon = iconFor[item.kind]
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                            index === active
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted/60"
                          )}
                          onMouseEnter={() => setActive(index)}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            setQuery(item.label)
                            setOpen(false)
                          }}
                        >
                          <Icon
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="flex-1 truncate text-foreground">
                            {item.label}
                          </span>
                          <IconPlaceholder
                            lucide="ArrowUpRight"
                            tabler="IconArrowUpRight"
                            hugeicons="ArrowUpRightIcon"
                            phosphor="ArrowUpRight"
                            remixicon="RiArrowRightUpLine"
                            className="size-3.5 shrink-0 text-muted-foreground/60"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Press <Kbd>/</Kbd> to focus, <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate,{" "}
          <Kbd>Enter</Kbd> to select.
        </p>
      </div>
    </section>
  )
}
