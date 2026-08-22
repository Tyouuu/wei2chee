"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type UploadImage = { id: number; src: string; name: string }

const seed: UploadImage[] = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&q=80",
    name: "facade.jpg",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&q=80",
    name: "skyline.jpg",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=400&q=80",
    name: "stairs.jpg",
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1481253127861-534498168948?w=400&q=80",
    name: "bridge.jpg",
  },
  {
    id: 5,
    src: "https://images.unsplash.com/photo-1470723710355-95304d8aece4?w=400&q=80",
    name: "atrium.jpg",
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
export const copy = { seed }
export type Copy = typeof copy


const LIMIT = 8

function Thumbnail({
  image,
  isCover,
  onRemove,
}: {
  image: UploadImage
  isCover: boolean
  onRemove: () => void
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      <img
        src={image.src}
        alt={image.name}
        className="size-full object-cover grayscale"
        loading="lazy"
      />
      {isCover && (
        <Badge variant="secondary" className="absolute top-1.5 left-1.5">
          Cover
        </Badge>
      )}
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        onClick={onRemove}
        aria-label={`Remove ${image.name}`}
        className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <IconPlaceholder
          lucide="X"
          tabler="IconX"
          hugeicons="Cancel01Icon"
          phosphor="X"
          remixicon="RiCloseLine"
          aria-hidden="true"
        />
      </Button>
    </div>
  )
}

export default function FileUploadBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { seed } = { ...copy, ...override }
  const [images, setImages] = React.useState(seed)

  const remove = (id: number) =>
    setImages((prev) => prev.filter((image) => image.id !== id))

  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted">
              <IconPlaceholder
                lucide="Image"
                tabler="IconPhoto"
                hugeicons="ImageIcon"
                phosphor="Image"
                remixicon="RiImageLine"
                className="size-4.5"
                aria-hidden="true"
              />
            </div>
            <div>
              <CardTitle className="text-sm">Gallery Images</CardTitle>
              <p className="text-xs text-muted-foreground tabular-nums">
                {images.length} of {LIMIT} uploaded
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={images.length >= LIMIT}>
            <IconPlaceholder
              lucide="Plus"
              tabler="IconPlus"
              hugeicons="Add01Icon"
              phosphor="Plus"
              remixicon="RiAddLine"
              data-icon="inline-start"
              aria-hidden="true"
            />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {images.map((image, index) => (
              <Thumbnail
                key={image.id}
                image={image}
                isCover={index === 0}
                onRemove={() => remove(image.id)}
              />
            ))}
            {images.length < LIMIT && (
              <button
                type="button"
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <IconPlaceholder
                  lucide="Plus"
                  tabler="IconPlus"
                  hugeicons="Add01Icon"
                  phosphor="Plus"
                  remixicon="RiAddLine"
                  className="size-5"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium">Upload</span>
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            PNG or JPG up to 10MB. The first image is used as the cover.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
