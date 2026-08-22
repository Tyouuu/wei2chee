"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
  { label: "Product", href: "#" },
  { label: "Solutions", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Resources", href: "#" },
]

export default function HeaderBlock() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur">
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

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Button
           
           
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
           asChild><a href="#" >
            Sign in
          </a></Button>
          <Button asChild><a href="#" >
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

            <nav className="flex flex-col px-4">
              {navLinks.map((link) => (
                <SheetClose
                  key={link.label}
                 
                 
                 asChild><a
                      href={link.href}
                      className="border-b border-border py-3 text-sm font-medium text-muted-foreground transition-colors last:border-b-0 hover:text-foreground">{link.label}</a></SheetClose>
              ))}
            </nav>

            <SheetFooter>
              <SheetClose
               
               
               asChild><Button
                   
                   
                    variant="outline"
                    className="w-full" asChild><a href="#" />Sign in</Button></SheetClose>
              <SheetClose
               
               
               asChild><Button
                   
                   
                    className="w-full" asChild><a href="#" />Get Started
                <IconPlaceholder
                  lucide="ArrowRight"
                  tabler="IconArrowRight"
                  hugeicons="ArrowRightIcon"
                  phosphor="ArrowRight"
                  remixicon="RiArrowRightLine"
                  data-icon="inline-end"
                  aria-hidden="true"
                /></Button></SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
