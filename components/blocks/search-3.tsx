"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

/** An icon held in data and rendered later, e.g. `<item.icon className="size-4" />`. */
type IconRenderer = (props: IconProps) => React.ReactNode

type Item = {
  label: string
  meta: string
  icon?: IconRenderer
  avatar?: string
}

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Pages",
    items: [
      {
        label: "Getting started",
        meta: "Docs",
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="FileText"
            tabler="IconFileText"
            hugeicons="File01Icon"
            phosphor="FileText"
            remixicon="RiFileTextLine"
            {...p}
          />
        ),
      },
      {
        label: "Theming and tokens",
        meta: "Docs",
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="FileText"
            tabler="IconFileText"
            hugeicons="File01Icon"
            phosphor="FileText"
            remixicon="RiFileTextLine"
            {...p}
          />
        ),
      },
      {
        label: "Deploying to production",
        meta: "Docs",
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="FileText"
            tabler="IconFileText"
            hugeicons="File01Icon"
            phosphor="FileText"
            remixicon="RiFileTextLine"
            {...p}
          />
        ),
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Priya Nair",
        meta: "Staff Engineer",
        avatar: "https://i.pravatar.cc/64?img=32",
      },
      {
        label: "Leo Tanaka",
        meta: "Product Designer",
        avatar: "https://i.pravatar.cc/64?img=12",
      },
    ],
  },
  {
    label: "Files",
    items: [
      {
        label: "Q3 Roadmap.pdf",
        meta: "2.4 MB",
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="File"
            tabler="IconFile"
            hugeicons="FileIcon"
            phosphor="File"
            remixicon="RiFile3Line"
            {...p}
          />
        ),
      },
    ],
  },
]

export default function SearchBlock() {
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const itemRefs = React.useRef<(HTMLAnchorElement | null)[]>([])

  const q = query.trim().toLowerCase()
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: q
        ? group.items.filter((item) =>
            `${item.label} ${item.meta}`.toLowerCase().includes(q)
          )
        : group.items,
    }))
    .filter((group) => group.items.length > 0)

  // Assign each visible row a flat index so arrow keys can move a highlight
  // across groups.
  let counter = 0
  const indexedGroups = filteredGroups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({ item, idx: counter++ })),
  }))
  const flatCount = counter
  const activeIndex = flatCount ? Math.min(active, flatCount - 1) : 0

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flatCount - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      itemRefs.current[activeIndex]?.click()
    }
  }

  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-background">
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
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Search pages, people, files..."
              aria-label="Search"
              className="pl-9"
            />
          </div>
        </div>

        {flatCount === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No results for &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-3">
            {indexedGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </p>
                {group.items.map(({ item, idx }) => {
                  const isActive = idx === activeIndex
                  return (
                    <a
                      key={item.label}
                      ref={(el) => {
                        itemRefs.current[idx] = el
                      }}
                      href="#"
                      onMouseEnter={() => setActive(idx)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                        isActive ? "bg-muted/60" : "hover:bg-muted/60"
                      )}
                    >
                      {item.avatar ? (
                        <Avatar className="size-5">
                          <AvatarImage
                            src={item.avatar}
                            alt={item.label}
                            className="grayscale"
                          />
                          <AvatarFallback className="text-[9px]">
                            {item.label[0]}
                          </AvatarFallback>
                        </Avatar>
                      ) : item.icon ? (
                        <item.icon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.meta}
                      </span>
                    </a>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <KbdGroup>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
            </KbdGroup>
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>
              <IconPlaceholder
                lucide="CornerDownLeft"
                tabler="IconCornerDownLeft"
                hugeicons="CornerDownLeftIcon"
                phosphor="ArrowElbowDownLeft"
                remixicon="RiCornerDownLeftLine"
                className="size-3"
                aria-hidden="true"
              />
            </Kbd>
            Open
          </span>
        </div>
      </div>
    </section>
  )
}
