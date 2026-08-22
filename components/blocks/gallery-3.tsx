"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Tile = {
  id: number
  title: string
  meta: string
  tag: string
  ratio: string
  src: string
  full: string
}

const tiles: Tile[] = [
  {
    id: 1,
    title: "Mountain sunrise",
    meta: "Rocky Mountains, CO",
    tag: "Landscape",
    ratio: "aspect-[4/5]",
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    full: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80",
  },
  {
    id: 2,
    title: "City skyline",
    meta: "Chicago, IL",
    tag: "Urban",
    ratio: "aspect-square",
    src: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80",
    full: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=80",
  },
  {
    id: 3,
    title: "Forest trail",
    meta: "Olympic NP, WA",
    tag: "Nature",
    ratio: "aspect-[3/4]",
    src: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80",
    full: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&q=80",
  },
  {
    id: 4,
    title: "Ocean waves",
    meta: "Big Sur, CA",
    tag: "Coastal",
    ratio: "aspect-[4/3]",
    src: "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800&q=80",
    full: "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1200&q=80",
  },
  {
    id: 5,
    title: "Desert dunes",
    meta: "Sahara, Morocco",
    tag: "Landscape",
    ratio: "aspect-[5/6]",
    src: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=800&q=80",
    full: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1200&q=80",
  },
  {
    id: 6,
    title: "Snowy peaks",
    meta: "Lauterbrunnen, CH",
    tag: "Alpine",
    ratio: "aspect-square",
    src: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80",
    full: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1200&q=80",
  },
  {
    id: 7,
    title: "Wildflower field",
    meta: "Tuscany, Italy",
    tag: "Nature",
    ratio: "aspect-[4/5]",
    src: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&q=80",
    full: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80",
  },
  {
    id: 8,
    title: "Coastal cliffs",
    meta: "Moher, Ireland",
    tag: "Coastal",
    ratio: "aspect-[3/4]",
    src: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80",
    full: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200&q=80",
  },
]

const ALL_TAG = "All"
const tagList = [ALL_TAG, ...Array.from(new Set(tiles.map((t) => t.tag)))]

export default function GalleryBlock() {
  const [active, setActive] = useState(ALL_TAG)

  const visible =
    active === ALL_TAG ? tiles : tiles.filter((t) => t.tag === active)

  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="gap-1.5 text-xs font-medium">
            <IconPlaceholder
              lucide="Camera"
              tabler="IconCamera"
              hugeicons="CameraIcon"
              phosphor="Camera"
              remixicon="RiCameraLine"
              data-icon="inline-start"
              className="size-3.5"
              aria-hidden="true"
            />
            Field Collection
          </Badge>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Acme in the wild
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            A curated set of places and moments captured by our community.
            Filter by theme, then open any frame to see the full story.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <ToggleGroup type="multiple"
            variant="outline"
            size="sm"
            value={[active]}
            onValueChange={(value) => {
              const next = value[0]
              if (next) setActive(next)
            }}
            aria-label="Filter photos by theme"
            className="flex-wrap justify-center"
          >
            {tagList.map((tag) => (
              <ToggleGroupItem
                key={tag}
                value={tag}
                aria-label={`Show ${tag} photos`}
                className="text-xs font-medium tracking-wide"
              >
                {tag}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mt-10 gap-4 [column-fill:_balance] sm:columns-2 lg:columns-3">
          {visible.map((tile) => (
            <Dialog key={tile.id}>
              <DialogTrigger
               
               asChild><button
                    type="button"
                    aria-label={`View ${tile.title}`}
                    className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-lg border border-border bg-card text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"><figure>
                  <div
                    className={cn(
                      "relative w-full overflow-hidden rounded-lg bg-muted",
                      tile.ratio
                    )}
                  >
                    <img
                      src={tile.src}
                      alt={tile.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-transparent p-4">
                      <Badge
                        variant="secondary"
                        className="mb-2 text-[10px] font-semibold tracking-wide"
                      >
                        {tile.tag}
                      </Badge>
                      <figcaption className="text-sm font-semibold tracking-tight text-background">
                        {tile.title}
                      </figcaption>
                      <div className="mt-1 flex items-center gap-1.5">
                        <IconPlaceholder
                          lucide="MapPin"
                          tabler="IconMapPin"
                          hugeicons="MapPinIcon"
                          phosphor="MapPin"
                          remixicon="RiMapPinLine"
                          className="size-3 shrink-0 text-background/70"
                          aria-hidden="true"
                        />
                        <span className="truncate text-xs text-background/70">
                          {tile.meta}
                        </span>
                      </div>
                    </div>
                  </div>
                </figure></button></DialogTrigger>

              <DialogContent className="gap-0 p-0 sm:max-w-2xl">
                <DialogTitle className="sr-only">{tile.title}</DialogTitle>
                <DialogDescription className="sr-only">
                  {tile.title}, {tile.meta}.
                </DialogDescription>
                <div className="w-full overflow-hidden rounded-t-[inherit] border-b border-border bg-muted">
                  <img
                    src={tile.full}
                    alt={tile.title}
                    className="max-h-[70vh] w-full object-contain"
                  />
                </div>
                <div className="flex items-start justify-between gap-3 p-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                      {tile.title}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <IconPlaceholder
                        lucide="MapPin"
                        tabler="IconMapPin"
                        hugeicons="MapPinIcon"
                        phosphor="MapPin"
                        remixicon="RiMapPinLine"
                        className="size-3 shrink-0"
                        aria-hidden="true"
                      />
                      {tile.meta}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold tracking-wide uppercase"
                  >
                    {tile.tag}
                  </Badge>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Showing {visible.length} of {tiles.length} photos
          </p>
          <Button
           
           
            variant="outline"
            className="gap-1.5 text-xs font-medium"
           asChild><a href="#" >
            Explore Full Gallery
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              className="size-3.5"
              aria-hidden="true"
            />
          </a></Button>
        </div>
      </div>
    </section>
  )
}
