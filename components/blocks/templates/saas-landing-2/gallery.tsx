"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const screens = [
  {
    id: 1,
    label: "Acme Dashboard: Overview",
    url: "app.acme.io/dashboard",
    version: "v2.4",
    description:
      "A unified command center for monitoring pipeline health, active deployments, and real-time system metrics across all environments.",
    src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
    alt: "Acme dashboard overview showing pipeline metrics",
  },
  {
    id: 2,
    label: "Analytics",
    url: "app.acme.io/analytics",
    description:
      "Deep-dive into usage trends, funnel conversion, and retention cohorts.",
    src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=75",
    alt: "Analytics charts and metrics",
  },
  {
    id: 3,
    label: "Deployments",
    url: "app.acme.io/deployments",
    description:
      "Track every release: status, rollback controls, and canary traffic splits.",
    src: "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=75",
    alt: "Deployment pipeline and release status",
  },
  {
    id: 4,
    label: "Team Settings",
    url: "app.acme.io/team",
    description:
      "Manage members, roles, SSO configuration, and access policies.",
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=75",
    alt: "Team settings and member management",
  },
  {
    id: 5,
    label: "Audit Logs",
    url: "app.acme.io/audit",
    description:
      "Immutable event history with filtering, export, and alert rules.",
    src: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=75",
    alt: "Audit log event timeline",
  },
  {
    id: 6,
    label: "API Keys",
    url: "app.acme.io/api-keys",
    description:
      "Generate, rotate, and scope API credentials with fine-grained permissions.",
    src: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=75",
    alt: "API key management interface",
  },
]

export default function Gallery() {
  const [activeId, setActiveId] = useState(screens[0].id)
  const active = screens.find((screen) => screen.id === activeId) ?? screens[0]
  const thumbnails = screens.slice(1)

  return (
    <section className="flex w-full items-center justify-center px-6 py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <span className="block text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Product Screenshots
          </span>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            See Acme in action
          </h2>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5 rounded-t-xl border-b border-border bg-muted px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 border border-border bg-background" />
              <span className="size-2.5 border border-border bg-background" />
              <span className="size-2.5 border border-border bg-background" />
            </div>
            <div className="mx-2 flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-1">
              <span className="size-1.5 bg-muted-foreground/30" />
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {active.url}
              </span>
            </div>
            <IconPlaceholder
              lucide="ZoomIn"
              tabler="IconZoomIn"
              hugeicons="SearchAddIcon"
              phosphor="MagnifyingGlassPlus"
              remixicon="RiZoomInLine"
              className="size-4 shrink-0 text-muted-foreground/40"
              aria-hidden="true"
            />
          </div>

          <Dialog>
            <DialogTrigger
             
             asChild><button
                  type="button"
                  aria-label={`Enlarge ${active.label}`}
                  className="group relative block aspect-video w-full cursor-zoom-in overflow-hidden rounded-b-xl bg-muted text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"><img
                key={active.id}
                src={active.src}
                alt={active.alt}
                className="size-full object-cover grayscale transition-[transform,filter] duration-300 group-hover:scale-[1.02] group-hover:grayscale-0"
              />
              <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-foreground/70 px-2 py-1 text-[10px] font-medium tracking-wide text-background opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                <IconPlaceholder
                  lucide="ZoomIn"
                  tabler="IconZoomIn"
                  hugeicons="SearchAddIcon"
                  phosphor="MagnifyingGlassPlus"
                  remixicon="RiZoomInLine"
                  className="size-3.5"
                  aria-hidden="true"
                />
                Enlarge
              </span></button></DialogTrigger>

            <DialogContent showCloseButton className="gap-0 p-0 sm:max-w-3xl">
              <DialogTitle className="sr-only">{active.label}</DialogTitle>
              <DialogDescription className="sr-only">
                {active.description}
              </DialogDescription>
              <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
                <img
                  src={active.src}
                  alt={active.alt}
                  className="size-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  {active.label}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {active.url}
                </span>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight">
                {active.label}
              </span>
              {active.version && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium tracking-wide"
                >
                  {active.version}
                </Badge>
              )}
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {active.description}
            </p>
          </div>
          <Button
           
           
            variant="outline"
            className="shrink-0 gap-2 text-xs font-medium"
           asChild><a href="#" >
            <IconPlaceholder
              lucide="ExternalLink"
              tabler="IconExternalLink"
              hugeicons="ExternalLinkIcon"
              phosphor="ArrowSquareOut"
              remixicon="RiExternalLinkLine"
              className="size-3.5"
              aria-hidden="true"
            />
            View Live Demo
          </a></Button>
        </div>

        <div className="border-t border-border" />

        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            More Screens
          </span>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {thumbnails.map((thumb) => {
              const isActive = thumb.id === activeId
              return (
                <button
                  key={thumb.id}
                  type="button"
                  onClick={() => setActiveId(thumb.id)}
                  className="group flex cursor-pointer flex-col gap-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div
                    className={[
                      "relative aspect-video w-full overflow-hidden rounded-md border transition-all duration-200",
                      isActive
                        ? "border-foreground/60 ring-1 ring-foreground/20"
                        : "border-border group-hover:border-foreground/30",
                    ].join(" ")}
                  >
                    <img
                      src={thumb.src}
                      alt={thumb.alt}
                      className="size-full object-cover grayscale transition-[transform,filter] duration-300 group-hover:scale-[1.04] group-hover:grayscale-0"
                    />
                    {!isActive && (
                      <div className="absolute inset-0 bg-foreground/0 transition-colors duration-200 group-hover:bg-foreground/5" />
                    )}
                  </div>
                  <span
                    className={[
                      "truncate text-xs font-medium transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground/70",
                    ].join(" ")}
                  >
                    {thumb.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
