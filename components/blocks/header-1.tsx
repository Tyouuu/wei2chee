"use client"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const navLinks = ["Blocks", "Docs", "Pricing", "Changelog"]

export default function HeaderBlock() {
  return (
    <header className="flex h-16 w-full items-center gap-6 border-b border-border px-4 text-foreground sm:px-6">
      <a href="#" className="flex items-center gap-2">
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
        <span className="text-lg font-bold tracking-tight">Acme</span>
      </a>
      <nav className="hidden items-center gap-6 md:flex">
        {navLinks.map((link) => (
          <a
            key={link}
            href="#"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {link}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Button
         
         
          className="hidden md:inline-flex"
         asChild><a href="#" >
          Get Started
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
              <SheetTitle className="flex items-center gap-2">
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
                  key={link}
                 
                 
                  className="rounded-md px-2 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                 asChild><a href="#" >
                  {link}
                </a></SheetClose>
              ))}
            </nav>
            <div className="mt-auto p-4">
              <Button
               
               
                className="w-full"
               asChild><a href="#" >
                Get Started
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
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
