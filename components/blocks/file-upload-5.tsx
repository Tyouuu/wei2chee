"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function FileUploadBlock() {
  const [preview, setPreview] = useState<string | null>(
    "https://i.pravatar.cc/160?img=45"
  )
  const inputRef = useRef<HTMLInputElement>(null)
  // Track the object URL we created so we can release it before replacing it.
  const objectUrlRef = useRef<string | null>(null)

  function setObjectUrl(url: string | null) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = url
    setPreview(url)
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) setObjectUrl(URL.createObjectURL(file))
  }

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Profile photo
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This will be shown on your profile and in comments.
        </p>

        <div className="mt-6 flex items-center gap-5">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {preview ? (
              <img
                src={preview}
                alt="Avatar preview"
                className="size-full object-cover grayscale"
              />
            ) : (
              <IconPlaceholder
                lucide="User"
                tabler="IconUser"
                hugeicons="UserIcon"
                phosphor="User"
                remixicon="RiUser3Line"
                className="size-8 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </span>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <IconPlaceholder
                  lucide="Upload"
                  tabler="IconUpload"
                  hugeicons="UploadIcon"
                  phosphor="Upload"
                  remixicon="RiUploadLine"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                Change
              </Button>
              {preview && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setObjectUrl(null)}
                  aria-label="Remove photo"
                >
                  <IconPlaceholder
                    lucide="Trash"
                    tabler="IconTrash"
                    hugeicons="Delete02Icon"
                    phosphor="Trash"
                    remixicon="RiDeleteBinLine"
                    className="size-4"
                    aria-hidden="true"
                  />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG or GIF. Max 2&nbsp;MB.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>
    </section>
  )
}
