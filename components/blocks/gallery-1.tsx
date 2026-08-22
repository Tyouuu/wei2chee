"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useState } from "react"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const tiles = [
  {
    id: 1,
    label: "Mountain sunrise",
    location: "Rocky Mountains, CO",
    contributor: {
      name: "Maya Osei",
      initials: "MO",
      avatar: "https://i.pravatar.cc/40?img=1",
    },
    tag: "Landscape",
    featured: true,
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80&crop=entropy",
    full: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80",
  },
  {
    id: 2,
    label: "City skyline",
    location: "Chicago, IL",
    contributor: {
      name: "Leo Farris",
      initials: "LF",
      avatar: "https://i.pravatar.cc/40?img=2",
    },
    tag: "Urban",
    featured: false,
    src: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80&crop=entropy",
    full: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=80",
  },
  {
    id: 3,
    label: "Forest trail",
    location: "Olympic NP, WA",
    contributor: {
      name: "Sara Kim",
      initials: "SK",
      avatar: "https://i.pravatar.cc/40?img=5",
    },
    tag: "Nature",
    featured: false,
    src: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80&crop=entropy",
    full: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&q=80",
  },
  {
    id: 4,
    label: "Ocean waves",
    location: "Big Sur, CA",
    contributor: {
      name: "Dante Ruiz",
      initials: "DR",
      avatar: "https://i.pravatar.cc/40?img=7",
    },
    tag: "Coastal",
    featured: true,
    src: "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800&q=80&crop=edges",
    full: "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1200&q=80",
  },
  {
    id: 5,
    label: "Desert dunes",
    location: "Sahara, Morocco",
    contributor: {
      name: "Nadia Voss",
      initials: "NV",
      avatar: "https://i.pravatar.cc/40?img=9",
    },
    tag: "Landscape",
    featured: false,
    src: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=800&q=80&crop=entropy",
    full: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1200&q=80",
  },
  {
    id: 6,
    label: "Snowy peaks",
    location: "Lauterbrunnen, CH",
    contributor: {
      name: "Jin Park",
      initials: "JP",
      avatar: "https://i.pravatar.cc/40?img=11",
    },
    tag: "Alpine",
    featured: false,
    src: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80&crop=edges",
    full: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1200&q=80",
  },
  {
    id: 7,
    label: "Autumn leaves",
    location: "Vermont, USA",
    contributor: {
      name: "Fiona Blake",
      initials: "FB",
      avatar: "https://i.pravatar.cc/40?img=13",
    },
    tag: "Seasonal",
    featured: false,
    src: "https://images.unsplash.com/photo-1507371341162-763b5e419408?w=800&q=80&crop=entropy",
    full: "https://images.unsplash.com/photo-1507371341162-763b5e419408?w=1200&q=80",
  },
  {
    id: 8,
    label: "Wildflower field",
    location: "Tuscany, Italy",
    contributor: {
      name: "Arjun Mehta",
      initials: "AM",
      avatar: "https://i.pravatar.cc/40?img=15",
    },
    tag: "Nature",
    featured: true,
    src: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&q=80&crop=edges",
    full: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80",
  },
  {
    id: 9,
    label: "Coastal cliffs",
    location: "Moher, Ireland",
    contributor: {
      name: "Cleo Torres",
      initials: "CT",
      avatar: "https://i.pravatar.cc/40?img=17",
    },
    tag: "Coastal",
    featured: false,
    src: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80&crop=edges",
    full: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200&q=80&crop=edges",
  },
  {
    id: 10,
    label: "River valley",
    location: "Columbia Gorge, OR",
    contributor: {
      name: "Eli Grant",
      initials: "EG",
      avatar: "https://i.pravatar.cc/40?img=19",
    },
    tag: "Landscape",
    featured: false,
    src: "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800&q=80&crop=edges",
    full: "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1200&q=80&crop=edges",
  },
  {
    id: 11,
    label: "Jungle canopy",
    location: "Amazon Basin, BR",
    contributor: {
      name: "Amara Diop",
      initials: "AD",
      avatar: "https://i.pravatar.cc/40?img=21",
    },
    tag: "Nature",
    featured: false,
    src: "https://images.unsplash.com/photo-1445264718234-a623be589d37?w=800&q=80&crop=edges",
    full: "https://images.unsplash.com/photo-1445264718234-a623be589d37?w=1200&q=80&crop=edges",
  },
  {
    id: 12,
    label: "Lakeside dawn",
    location: "Lake Bled, SI",
    contributor: {
      name: "Theo Hartmann",
      initials: "TH",
      avatar: "https://i.pravatar.cc/40?img=23",
    },
    tag: "Landscape",
    featured: false,
    src: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80&crop=entropy",
    full: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200&q=80&crop=entropy",
  },
]

const ALL_TAG = "All"
const tags = [ALL_TAG, ...Array.from(new Set(tiles.map((t) => t.tag)))]

export default function GalleryBlock() {
  const [active, setActive] = useState(ALL_TAG)

  const visible =
    active === ALL_TAG ? tiles : tiles.filter((t) => t.tag === active)

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Gallery
          </span>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Acme in the wild
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            A curated selection of places and moments captured by our community
            around the world.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 border-b border-border pb-6">
          <ToggleGroup type="multiple"
            variant="outline"
            size="sm"
            value={[active]}
            onValueChange={(value) => {
              const next = value[0]
              if (next) setActive(next)
            }}
            aria-label="Filter photos by tag"
            className="flex-wrap justify-center"
          >
            {tags.map((tag) => (
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

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-3 md:grid-cols-4">
          {visible.map((tile) => (
            <Dialog key={tile.id}>
              <DialogTrigger
               
               asChild><button
                    type="button"
                    aria-label={`View ${tile.label}`}
                    className="group relative aspect-square overflow-hidden bg-muted text-left focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"><img
                  src={tile.src}
                  alt={tile.label}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 flex flex-col justify-between bg-foreground/0 p-3 transition-colors duration-300 group-hover:bg-foreground/70">
                  <div className="flex items-start justify-between opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-semibold tracking-wide"
                    >
                      {tile.tag}
                    </Badge>
                    {tile.featured && (
                      <span className="size-1.5 bg-primary" title="Featured" />
                    )}
                  </div>

                  <div className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="text-xs font-semibold tracking-wide text-background">
                      {tile.label}
                    </p>
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
                      <span className="truncate text-[10px] text-background/70">
                        {tile.location}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 border-t border-background/20 pt-2">
                      <Avatar className="size-5">
                        <AvatarImage
                          src={tile.contributor.avatar}
                          alt={tile.contributor.name}
                          className="grayscale"
                        />
                        <AvatarFallback className="text-[8px]">
                          {tile.contributor.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-[10px] text-background/80">
                        {tile.contributor.name}
                      </span>
                    </div>
                  </div>
                </div></button></DialogTrigger>

              <DialogContent showCloseButton className="gap-0 p-0 sm:max-w-2xl">
                <DialogTitle className="sr-only">{tile.label}</DialogTitle>
                <DialogDescription className="sr-only">
                  {tile.label}, {tile.location}, photographed by{" "}
                  {tile.contributor.name}.
                </DialogDescription>
                <div className="aspect-[4/3] w-full overflow-hidden rounded-t-[inherit] border-b border-border bg-muted">
                  <img
                    src={tile.full}
                    alt={tile.label}
                    className="size-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold tracking-tight text-foreground">
                        {tile.label}
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
                        {tile.location}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-semibold tracking-wide uppercase"
                    >
                      {tile.tag}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage
                          src={tile.contributor.avatar}
                          alt={tile.contributor.name}
                          className="grayscale"
                        />
                        <AvatarFallback className="text-[9px]">
                          {tile.contributor.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-foreground">
                        {tile.contributor.name}
                      </span>
                    </div>
                    <DialogClose
                     
                     asChild><Button variant="outline" size="sm" >
                      Close
                    </Button></DialogClose>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            Showing {visible.length} of {tiles.length} photos
          </p>
          <Button
            variant="ghost"
            className="gap-1.5 text-xs font-medium"
           
           
           asChild><a href="#" >
            View Full Collection
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
