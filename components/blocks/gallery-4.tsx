"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Photo = {
  id: number
  src: string
  title: string
  location: string
}

const photos: Photo[] = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80",
    title: "Financial District",
    location: "New York, USA",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=700&q=80",
    title: "Alpine Fog",
    location: "Grindelwald, CH",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=700&q=80",
    title: "Coastal Dunes",
    location: "Jutland, DK",
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=700&q=80",
    title: "Pine Canopy",
    location: "Bavaria, DE",
  },
  {
    id: 5,
    src: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=700&q=80",
    title: "Still Water",
    location: "Hallstatt, AT",
  },
]

export default function GalleryBlock() {
  const [active, setActive] = React.useState<Photo | null>(null)

  return (
    <section className="flex min-h-svh w-full justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <Badge variant="secondary">Field Notes</Badge>
            <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Selected Work
            </h2>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {photos.length} Photos
          </span>
        </div>

        <Dialog
          open={active !== null}
          onOpenChange={(open) => !open && setActive(null)}
        >
          <div className="grid aspect-[3/2] grid-cols-4 grid-rows-2 gap-2">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActive(photo)}
                className={
                  "group relative overflow-hidden rounded-lg border border-border bg-muted " +
                  (index === 0 ? "col-span-2 row-span-2" : "")
                }
              >
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="size-full object-cover grayscale transition-all duration-300 group-hover:grayscale-0"
                  loading="lazy"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-opacity group-hover:bg-foreground/10 group-hover:opacity-100">
                  <span className="flex size-9 items-center justify-center rounded-md bg-background/90 text-foreground">
                    <IconPlaceholder
                      lucide="ZoomIn"
                      tabler="IconZoomIn"
                      hugeicons="SearchAddIcon"
                      phosphor="MagnifyingGlassPlus"
                      remixicon="RiZoomInLine"
                      className="size-4"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </button>
            ))}
          </div>

          <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
            {active && (
              <>
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <img
                    src={active.src}
                    alt={active.title}
                    className="size-full object-cover"
                  />
                </div>
                <div className="p-4 pt-0">
                  <DialogTitle className="text-base">
                    {active.title}
                  </DialogTitle>
                  <DialogDescription>{active.location}</DialogDescription>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
