"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Section = { id: string; title: string; body: string[] }

const sections: Section[] = [
  {
    id: "overview",
    title: "Overview",
    body: [
      "Design tokens are the single source of truth for the visual language of a product. Instead of hard-coding colors and spacing in components, you reference named values that can change in one place.",
      "This guide walks through how we structure tokens, how they map to themes, and how to adopt them without a disruptive migration.",
    ],
  },
  {
    id: "structure",
    title: "Token structure",
    body: [
      "We split tokens into three tiers: primitives, semantic tokens, and component tokens. Primitives are raw values, semantic tokens describe intent, and component tokens bind intent to a specific part.",
      "Keeping these tiers separate means a rebrand touches primitives only, while component code keeps referring to the same semantic names.",
    ],
  },
  {
    id: "theming",
    title: "Theming",
    body: [
      "Each theme remaps the semantic tier. A dark theme overrides background and foreground tokens, and every component that reads those names updates automatically with no per-component work.",
      "Because the contract is the token name, you can ship a new theme without touching a single component file.",
    ],
  },
  {
    id: "adoption",
    title: "Adoption",
    body: [
      "Roll out tokens incrementally. Start with color, then spacing, then typography, shipping each tier behind the same review process you already use.",
      "Within a few sprints the hard-coded values are gone and every surface speaks the same visual language.",
    ],
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
export const copy = { sections }
export type Copy = typeof copy


export default function ArticleBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { sections } = { ...copy, ...override }
  const [active, setActive] = React.useState(sections[0].id)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const update = () => {
      const rootTop = root.getBoundingClientRect().top
      const threshold = root.clientHeight * 0.3
      let current = sections[0].id
      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (el && el.getBoundingClientRect().top - rootTop <= threshold) {
          current = section.id
        }
      }
      const atBottom =
        root.scrollTop + root.clientHeight >= root.scrollHeight - 48
      setActive(atBottom ? sections[sections.length - 1].id : current)
    }

    update()
    root.addEventListener("scroll", update, { passive: true })
    return () => root.removeEventListener("scroll", update)
  }, [])

  return (
    <section className="flex min-h-svh w-full justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <div className="max-w-2xl">
          <Badge variant="secondary" className="mb-4">
            Guide
          </Badge>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
            A practical guide to design tokens
          </h1>
          <div className="mt-5 flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage
                src="https://i.pravatar.cc/80?img=32"
                alt="Priya Nair"
                className="grayscale"
              />
              <AvatarFallback>PN</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Priya Nair</span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">Jun 12, 2026</span>
                <span className="flex items-center gap-1">
                  <IconPlaceholder
                    lucide="Clock"
                    tabler="IconClock"
                    hugeicons="TimeIcon"
                    phosphor="Clock"
                    remixicon="RiTimeLine"
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  8 Min Read
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-10 md:flex-row md:gap-12">
          <div
            ref={scrollRef}
            className="flex min-w-0 flex-1 flex-col gap-10 md:max-h-[26rem] md:overflow-y-auto md:pr-5"
          >
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-2">
                <h2 className="font-heading text-xl font-semibold tracking-tight">
                  {section.title}
                </h2>
                <div className="mt-3 flex flex-col gap-4 text-[15px]/relaxed text-foreground/80">
                  {section.body.map((paragraph, pIndex) => (
                    <p key={`${section.id}-${pIndex}`}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="hidden w-52 shrink-0 md:block">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              On This Page
            </p>
            <nav className="flex flex-col border-l border-border">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={() => setActive(section.id)}
                  aria-current={active === section.id ? "page" : undefined}
                  className={cn(
                    "-ml-px border-l py-1.5 pl-4 text-sm transition-colors",
                    active === section.id
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>
        </div>
      </div>
    </section>
  )
}
