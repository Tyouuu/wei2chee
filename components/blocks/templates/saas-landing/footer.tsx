"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const columns = [
  {
    title: "Product",
    links: ["Features", "Integrations", "Pricing", "Changelog", "Roadmap"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Blog", "Press", "Contact"],
  },
  {
    title: "Resources",
    links: [
      "Documentation",
      "Guides",
      "Help Center",
      "API Status",
      "Community",
    ],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security", "Cookies", "Licenses"],
  },
]

const socials = [
  { label: "X", icon: (p: IconProps) => <XOutlineMark {...p} /> },
  { label: "GitHub", icon: (p: IconProps) => <GithubMark {...p} /> },
  { label: "LinkedIn", icon: (p: IconProps) => <LinkedinBoxMark {...p} /> },
]

const locales = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "ja", label: "日本語" },
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
export const copy = { columns, locales }
export type Copy = typeof copy


export default function Footer({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { columns, locales } = { ...copy, ...override }
  const [locale, setLocale] = React.useState(locales[0])

  return (
    <section className="flex w-full items-center justify-center px-6 py-16">
      <footer className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="size-7 shrink-0 text-primary"
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
              <span className="text-lg font-semibold tracking-tight">Acme</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The composable platform teams use to ship polished products
              faster, from first prototype to global scale.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {socials.map((social) => (
                <Button
                  key={social.label}
                  variant="outline"
                  size="icon"
                  aria-label={social.label}
                  className="rounded-lg"
                >
                  <social.icon className="size-4" />
                </Button>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <nav key={column.title} className="flex flex-col gap-3">
              <h3 className="font-heading text-sm font-semibold text-foreground">
                {column.title}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
            Acme, Inc. All rights reserved.
          </p>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
               
               asChild><Button variant="outline" size="sm" className="rounded-lg">{locale.label}
                <IconPlaceholder
                  lucide="ChevronDown"
                  tabler="IconChevronDown"
                  hugeicons="ArrowDown01Icon"
                  phosphor="CaretDown"
                  remixicon="RiArrowDownSLine"
                  className="size-4 text-muted-foreground"
                  data-icon="inline-start"
                /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-lg">
                {locales.map((item) => (
                  <DropdownMenuItem
                    key={item.code}
                    onClick={() => setLocale(item)}
                    className={cn(
                      "rounded-lg",
                      item.code === locale.code && "font-medium text-foreground"
                    )}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* The light/dark toggle that shipped here was removed with its
                next-themes dependency. On a page a customer's own customers
                read, the light/dark question is not theirs to answer: the
                page wears the register its owner picked, which is the rule
                the whole product is built on. A toggle here would offer a
                choice that overrides that, and a dead one would be worse. */}
          </div>
        </div>
      </footer>
    </section>
  )
}

// Brand marks are inlined rather than imported from an icon library: the rest
// of this file uses IconPlaceholder, which resolves to whichever icon set the
// consumer already has, and one brand import would drag a whole extra package
// into their install for a handful of glyphs.
type MarkProps = React.ComponentProps<"svg"> & { size?: number | string }

function GithubMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12.001 2C6.47598 2 2.00098 6.475 2.00098 12C2.00098 16.425 4.86348 20.1625 8.83848 21.4875C9.33848 21.575 9.52598 21.275 9.52598 21.0125C9.52598 20.775 9.51348 19.9875 9.51348 19.15C7.00098 19.6125 6.35098 18.5375 6.15098 17.975C6.03848 17.6875 5.55098 16.8 5.12598 16.5625C4.77598 16.375 4.27598 15.9125 5.11348 15.9C5.90098 15.8875 6.46348 16.625 6.65098 16.925C7.55098 18.4375 8.98848 18.0125 9.56348 17.75C9.65098 17.1 9.91348 16.6625 10.201 16.4125C7.97598 16.1625 5.65098 15.3 5.65098 11.475C5.65098 10.3875 6.03848 9.4875 6.67598 8.7875C6.57598 8.5375 6.22598 7.5125 6.77598 6.1375C6.77598 6.1375 7.61348 5.875 9.52598 7.1625C10.326 6.9375 11.176 6.825 12.026 6.825C12.876 6.825 13.726 6.9375 14.526 7.1625C16.4385 5.8625 17.276 6.1375 17.276 6.1375C17.826 7.5125 17.476 8.5375 17.376 8.7875C18.0135 9.4875 18.401 10.375 18.401 11.475C18.401 15.3125 16.0635 16.1625 13.8385 16.4125C14.201 16.725 14.5135 17.325 14.5135 18.2625C14.5135 19.6 14.501 20.675 14.501 21.0125C14.501 21.275 14.6885 21.5875 15.1885 21.4875C19.259 20.1133 21.9999 16.2963 22.001 12C22.001 6.475 17.526 2 12.001 2Z" />
    </svg>
  )
}

function LinkedinBoxMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M18.3362 18.339H15.6707V14.1622C15.6707 13.1662 15.6505 11.8845 14.2817 11.8845C12.892 11.8845 12.6797 12.9683 12.6797 14.0887V18.339H10.0142V9.75H12.5747V10.9207H12.6092C12.967 10.2457 13.837 9.53325 15.1367 9.53325C17.8375 9.53325 18.337 11.3108 18.337 13.6245V18.339H18.3362ZM7.00373 8.57475C6.14573 8.57475 5.45648 7.88025 5.45648 7.026C5.45648 6.1725 6.14648 5.47875 7.00373 5.47875C7.85873 5.47875 8.55173 6.1725 8.55173 7.026C8.55173 7.88025 7.85798 8.57475 7.00373 8.57475ZM8.34023 18.339H5.66723V9.75H8.34023V18.339ZM19.6697 3H4.32923C3.59498 3 3.00098 3.5805 3.00098 4.29675V19.7033C3.00098 20.4202 3.59498 21 4.32923 21H19.6675C20.401 21 21.001 20.4202 21.001 19.7033V4.29675C21.001 3.5805 20.401 3 19.6675 3H19.6697Z" />
    </svg>
  )
}

function XOutlineMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M10.4883 14.651L15.25 21H22.25L14.3917 10.5223L20.9308 3H18.2808L13.1643 8.88578L8.75 3H1.75L9.26086 13.0145L2.31915 21H4.96917L10.4883 14.651ZM16.25 19L5.75 5H7.75L18.25 19H16.25Z" />
    </svg>
  )
}
