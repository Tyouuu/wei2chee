"use client"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const navLinks = [
  { label: "Products", href: "#" },
  { label: "Solutions", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Docs", href: "#" },
  { label: "Blog", href: "#" },
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
export const copy = { navLinks }
export type Copy = typeof copy


export default function Header({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { navLinks } = { ...copy, ...override }
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center border-b border-border bg-background/80 px-6 backdrop-blur">
      <a href="#" className="flex shrink-0 items-center gap-2.5">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="size-6 shrink-0 text-primary"
        >
          <rect x="3" y="3" width="8" height="8" transform="rotate(-6 7 7)" />
          <rect x="3" y="13" width="8" height="8" transform="rotate(5 7 17)" />
          <rect
            x="13"
            y="13"
            width="8"
            height="8"
            transform="rotate(-4 17 17)"
          />
          <rect x="13" y="3" width="8" height="8" transform="rotate(15 17 7)" />
        </svg>
        <span className="text-base font-bold tracking-tight">Acme</span>
      </a>

      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
        {navLinks.map((link) => (
          <Button
            key={link.label}
           
           
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
           asChild><a href={link.href} >
            {link.label}
          </a></Button>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <Button
         
         
          variant="ghost"
          className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
         asChild><a href="#" >
          Sign In
        </a></Button>
        <Separator orientation="vertical" className="hidden h-5 sm:block" />
        <Button
         
         
          className="hidden sm:inline-flex"
         asChild><a href="#" >
          Start Free Trial
          <IconPlaceholder
            lucide="ArrowRight"
            tabler="IconArrowRight"
            hugeicons="ArrowRightIcon"
            phosphor="ArrowRight"
            remixicon="RiArrowRightLine"
            data-icon="inline-end"
            aria-hidden="true"
          />
        </a></Button>

        <Sheet>
          <SheetTrigger
           
            aria-label="Open menu"
           asChild><Button variant="outline" size="icon" className="md:hidden"><IconPlaceholder
              lucide="Menu"
              tabler="IconMenu"
              hugeicons="MenuIcon"
              phosphor="List"
              remixicon="RiMenuLine"
              aria-hidden="true"
            /></Button></SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-xs">
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
            <nav className="flex flex-col px-2">
              {navLinks.map((link) => (
                <SheetClose
                  key={link.label}
                 
                 
                  className="rounded-md px-2 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                 asChild><a href={link.href} >
                  {link.label}
                </a></SheetClose>
              ))}
            </nav>
            <SheetFooter>
              <Button
               
               
                variant="ghost"
                className="w-full"
               asChild><a href="#" >
                Sign In
              </a></Button>
              <Button
               
               
                className="w-full"
               asChild><a href="#" >
                Start Free Trial
                <IconPlaceholder
                  lucide="ArrowRight"
                  tabler="IconArrowRight"
                  hugeicons="ArrowRightIcon"
                  phosphor="ArrowRight"
                  remixicon="RiArrowRightLine"
                  data-icon="inline-end"
                  aria-hidden="true"
                />
              </a></Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
