"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const pillSpring = { type: "spring" as const, stiffness: 400, damping: 34 }

// The nav mirrors real page sections; the pill tracks whichever is in view.
const sections = [
  { id: "overview", label: "Overview" },
  { id: "features", label: "Features" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
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
export const copy = { sections }
export type Copy = typeof copy


export default function HeaderBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { sections } = { ...copy, ...override }
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const navRef = useRef<HTMLElement>(null)

  const { anchorRef, scrolled } = useAncestorScroll()

  // Scroll-spy: highlight the section crossing a band near the top. No-ops when
  // the ids are absent, which is the case in a standalone block preview.
  useEffect(() => {
    const root = findScrollParent(navRef.current)
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = els.indexOf(entry.target as HTMLElement)
          if (index !== -1) setActive(index)
        }
      },
      { root, rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const shown = hovered ?? active

  return (
    // No call to action anywhere in the bar, on purpose. On a page that is read
    // rather than converted on — a changelog, a status page, documentation — a
    // persistent CTA competes with what the visitor actually came for, and the
    // one real ask belongs in its own section further down.
    <header
      ref={anchorRef}
      className={cn(
        "sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur transition-colors duration-300",
        scrolled ? "border-border" : "border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6">
        <a href="#" className="flex shrink-0 items-center gap-2.5">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="size-6 shrink-0 text-primary"
          >
            <rect x="3" y="3" width="8" height="8" transform="rotate(-6 7 7)" />
            <rect
              x="3"
              y="13"
              width="8"
              height="8"
              transform="rotate(5 7 17)"
            />
            <rect
              x="13"
              y="13"
              width="8"
              height="8"
              transform="rotate(-4 17 17)"
            />
            <rect
              x="13"
              y="3"
              width="8"
              height="8"
              transform="rotate(15 17 7)"
            />
          </svg>
          <span className="text-base font-bold tracking-tight">Acme</span>
        </a>

        {/* One muted capsule on the right. The active pill slides between items
            with a shared layoutId rather than fading, so the nav reads as a
            single control instead of four separate links. */}
        <nav
          ref={navRef}
          onMouseLeave={() => setHovered(null)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setHovered(null)
          }}
          className="ml-auto hidden items-center gap-0.5 rounded-[calc(var(--radius-md)+4px)] border border-border bg-muted/60 p-1 backdrop-blur md:flex"
        >
          {sections.map((s, i) => {
            const isShown = shown === i
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={active === i ? "true" : undefined}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onClick={() => setActive(i)}
                className={cn(
                  "relative rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isShown
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isShown && (
                  <motion.span
                    layoutId="header-14-pill"
                    aria-hidden="true"
                    transition={reduce ? { duration: 0 } : pillSpring}
                    className="absolute inset-0 -z-10 rounded-md bg-background shadow-sm"
                  />
                )}
                {s.label}
              </a>
            )
          })}
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
           
           asChild><Button
                variant="outline"
                size="icon"
                aria-label="Open menu"
                className="ml-auto md:hidden"><IconPlaceholder
              lucide="Menu"
              tabler="IconMenu"
              hugeicons="MenuIcon"
              phosphor="List"
              remixicon="RiMenuLine"
              aria-hidden="true"
            /></Button></SheetTrigger>
          <SheetContent side="right" className="w-3/4 max-w-xs">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="size-5 shrink-0 text-primary"
                >
                  <rect
                    x="3"
                    y="3"
                    width="8"
                    height="8"
                    transform="rotate(-6 7 7)"
                  />
                  <rect
                    x="3"
                    y="13"
                    width="8"
                    height="8"
                    transform="rotate(5 7 17)"
                  />
                  <rect
                    x="13"
                    y="13"
                    width="8"
                    height="8"
                    transform="rotate(-4 17 17)"
                  />
                  <rect
                    x="13"
                    y="3"
                    width="8"
                    height="8"
                    transform="rotate(15 17 7)"
                  />
                </svg>
                Acme
              </SheetTitle>
            </SheetHeader>

            {/* The sheet has no CTA footer either: the variant is the absence of
                the call to action, and putting one back on mobile would undo it
                on the surface where it is most intrusive. */}
            <nav className="flex flex-col px-4">
              {sections.map((s, i) => (
                <SheetClose
                  key={s.id}
                 
                 
                 asChild><a
                      href={`#${s.id}`}
                      className={cn(
                        "border-l-2 py-3 pl-3 text-sm font-medium transition-colors",
                        active === i
                          ? "border-primary bg-muted/60 text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}>{s.label}</a></SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null
  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el
    }
    el = el.parentElement
  }
  return null
}

// The preview shell scrolls an inner element rather than the window, so the
// header reads scroll from the nearest scrollable ancestor and falls back to
// the window when there is none.
function useAncestorScroll() {
  const anchorRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const scroller = findScrollParent(anchor)
    const target: HTMLElement | Window = scroller ?? window
    const read = () =>
      setScrolled((scroller ? scroller.scrollTop : window.scrollY) > 8)
    read()
    target.addEventListener("scroll", read, { passive: true })
    window.addEventListener("resize", read)
    return () => {
      target.removeEventListener("scroll", read)
      window.removeEventListener("resize", read)
    }
  }, [])

  return { anchorRef, scrolled }
}
